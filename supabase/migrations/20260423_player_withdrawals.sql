-- ============================================================
-- Sistema de saque de jogadores
-- ============================================================

CREATE TABLE IF NOT EXISTS public.withdrawals (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount           integer     NOT NULL,            -- valor solicitado (coins = reais)
  fee_amount       integer     NOT NULL DEFAULT 0,  -- taxa calculada (coins)
  net_amount       integer     NOT NULL,            -- amount - fee_amount (enviado ao jogador)
  pix_key_type     text        NOT NULL,            -- CPF | CNPJ | EMAIL | PHONE | EVP
  pix_key          text        NOT NULL,
  destination_name text        NOT NULL DEFAULT '',
  destination_doc  text        NOT NULL DEFAULT '',
  status           text        NOT NULL DEFAULT 'pending',
    -- pending | processing | paid | rejected | failed
  external_ref     text        UNIQUE NOT NULL,
  orama_id         text,
  e2e_id           text,
  admin_notes      text,
  paid_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS withdrawals_user_idx    ON public.withdrawals (user_id);
CREATE INDEX IF NOT EXISTS withdrawals_status_idx  ON public.withdrawals (status);
CREATE INDEX IF NOT EXISTS withdrawals_ext_ref_idx ON public.withdrawals (external_ref);

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "withdrawals_select_own" ON public.withdrawals;
CREATE POLICY "withdrawals_select_own" ON public.withdrawals
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "withdrawals_admin_all" ON public.withdrawals;
CREATE POLICY "withdrawals_admin_all" ON public.withdrawals
  FOR ALL USING (public.is_admin());

-- ── RPC: request_player_withdrawal ───────────────────────────
CREATE OR REPLACE FUNCTION public.request_player_withdrawal(
  p_amount       integer,
  p_pix_key_type text,
  p_pix_key      text,
  p_dest_name    text,
  p_dest_doc     text
)
RETURNS uuid   -- retorna o id do saque criado
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid              uuid    := auth.uid();
  v_settings         public.site_settings%ROWTYPE;
  v_balance          integer;
  v_fee_pct          numeric;
  v_fee_amount       integer;
  v_net_amount       integer;
  v_daily_count      integer;
  v_total_deposited  numeric;
  v_total_wagered    numeric;
  v_required_wager   numeric;
  v_ext_ref          text    := 'wd-' || gen_random_uuid()::text;
  v_withdrawal_id    uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;

  -- Carrega configurações
  SELECT * INTO v_settings FROM public.site_settings WHERE id = 1 LIMIT 1;

  -- Valida valor mínimo / máximo
  IF p_amount < COALESCE(v_settings.player_min_withdrawal, 20) THEN
    RAISE EXCEPTION 'Valor mínimo de saque: R$ %', COALESCE(v_settings.player_min_withdrawal, 20);
  END IF;
  IF p_amount > COALESCE(v_settings.player_max_withdrawal, 5000) THEN
    RAISE EXCEPTION 'Valor máximo de saque: R$ %', COALESCE(v_settings.player_max_withdrawal, 5000);
  END IF;

  -- Limite diário
  SELECT COUNT(*) INTO v_daily_count
    FROM public.withdrawals
   WHERE user_id    = v_uid
     AND status    != 'rejected'
     AND status    != 'failed'
     AND created_at >= current_date;

  IF v_daily_count >= COALESCE(v_settings.player_daily_withdrawals, 3) THEN
    RAISE EXCEPTION 'Limite de % saques por dia atingido.', COALESCE(v_settings.player_daily_withdrawals, 3);
  END IF;

  -- Verifica rollover
  IF COALESCE(v_settings.player_rollover, 1) > 0 THEN
    SELECT COALESCE(SUM(amount_reais), 0) INTO v_total_deposited
      FROM public.deposits
     WHERE user_id = v_uid AND status = 'paid';

    SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_total_wagered
      FROM public.wallet_transactions
     WHERE user_id = v_uid
       AND amount  < 0
       AND title   = 'Entrada na partida';

    v_required_wager := v_total_deposited * COALESCE(v_settings.player_rollover, 1);

    IF v_total_wagered < v_required_wager THEN
      RAISE EXCEPTION 'Rollover não atingido. Apostado: % / Necessário: %',
        ROUND(v_total_wagered), ROUND(v_required_wager);
    END IF;
  END IF;

  -- Calcula taxa e valor líquido
  v_fee_pct    := COALESCE(v_settings.player_withdrawal_fee, 0);
  v_fee_amount := FLOOR(p_amount * v_fee_pct / 100.0)::integer;
  v_net_amount := p_amount - v_fee_amount;

  -- Verifica saldo
  SELECT balance INTO v_balance FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente.';
  END IF;

  -- Debita saldo e registra transação
  UPDATE public.profiles
     SET balance    = balance - p_amount,
         updated_at = now()
   WHERE id = v_uid;

  INSERT INTO public.wallet_transactions (user_id, title, description, amount, highlight)
  VALUES (v_uid, 'Saque solicitado', 'Em análise · PIX ' || p_pix_key_type, -p_amount, 'muted');

  -- Cria saque
  INSERT INTO public.withdrawals
    (user_id, amount, fee_amount, net_amount, pix_key_type, pix_key,
     destination_name, destination_doc, external_ref)
  VALUES
    (v_uid, p_amount, v_fee_amount, v_net_amount, upper(p_pix_key_type), p_pix_key,
     p_dest_name, p_dest_doc, v_ext_ref)
  RETURNING id INTO v_withdrawal_id;

  RETURN v_withdrawal_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.request_player_withdrawal(integer, text, text, text, text) TO authenticated;

-- ── RPC: get_my_withdrawals ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_withdrawals()
RETURNS TABLE (
  id           uuid,
  amount       integer,
  fee_amount   integer,
  net_amount   integer,
  pix_key_type text,
  pix_key      text,
  status       text,
  admin_notes  text,
  created_at   timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
    SELECT w.id, w.amount, w.fee_amount, w.net_amount,
           w.pix_key_type, w.pix_key, w.status, w.admin_notes, w.created_at
      FROM public.withdrawals w
     WHERE w.user_id = auth.uid()
     ORDER BY w.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_withdrawals() TO authenticated;

-- ── RPC: admin_list_player_withdrawals ────────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_player_withdrawals(
  p_status text DEFAULT NULL
)
RETURNS TABLE (
  id               uuid,
  user_id          uuid,
  user_name        text,
  user_email       text,
  amount           integer,
  fee_amount       integer,
  net_amount       integer,
  pix_key_type     text,
  pix_key          text,
  destination_name text,
  destination_doc  text,
  status           text,
  external_ref     text,
  orama_id         text,
  admin_notes      text,
  created_at       timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  RETURN QUERY
    SELECT w.id, w.user_id,
           p.display_name, p.email,
           w.amount, w.fee_amount, w.net_amount,
           w.pix_key_type, w.pix_key, w.destination_name, w.destination_doc,
           w.status, w.external_ref, w.orama_id, w.admin_notes, w.created_at
      FROM public.withdrawals w
      JOIN public.profiles p ON p.id = w.user_id
     WHERE p_status IS NULL OR w.status = p_status
     ORDER BY w.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_player_withdrawals(text) TO authenticated;

-- ── RPC: admin_set_withdrawal_processing ─────────────────────
-- Chamado pelo backend após enviar o PIX-out à OramaPay com sucesso
CREATE OR REPLACE FUNCTION public.admin_set_withdrawal_processing(
  p_withdrawal_id uuid,
  p_orama_id      text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  UPDATE public.withdrawals
     SET status     = 'processing',
         orama_id   = p_orama_id,
         updated_at = now()
   WHERE id = p_withdrawal_id AND status = 'pending';
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_withdrawal_processing(uuid, text) TO authenticated;

-- ── RPC: admin_reject_withdrawal ─────────────────────────────
-- Rejeita e devolve o saldo ao jogador
CREATE OR REPLACE FUNCTION public.admin_reject_withdrawal(
  p_withdrawal_id uuid,
  p_notes         text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_wd public.withdrawals%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;

  SELECT * INTO v_wd FROM public.withdrawals WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Saque não encontrado.'; END IF;
  IF v_wd.status NOT IN ('pending', 'processing') THEN
    RAISE EXCEPTION 'Saque não pode ser rejeitado no status atual.';
  END IF;

  UPDATE public.withdrawals
     SET status      = 'rejected',
         admin_notes = p_notes,
         updated_at  = now()
   WHERE id = p_withdrawal_id;

  -- Devolve saldo ao jogador
  UPDATE public.profiles
     SET balance    = balance + v_wd.amount,
         updated_at = now()
   WHERE id = v_wd.user_id;

  INSERT INTO public.wallet_transactions (user_id, title, description, amount, highlight)
  VALUES (v_wd.user_id, 'Saque recusado', COALESCE(NULLIF(p_notes,''), 'Solicitação não aprovada'), v_wd.amount, 'muted');
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_reject_withdrawal(uuid, text) TO authenticated;

-- ── RPC: confirm_player_withdrawal ────────────────────────────
-- Chamado pelo webhook quando OramaPay confirma o pagamento
CREATE OR REPLACE FUNCTION public.confirm_player_withdrawal(
  p_external_ref text,
  p_orama_id     text,
  p_e2e_id       text,
  p_paid_at      timestamptz
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_wd public.withdrawals%ROWTYPE;
BEGIN
  SELECT * INTO v_wd FROM public.withdrawals WHERE external_ref = p_external_ref LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Saque não encontrado: %', p_external_ref; END IF;
  IF v_wd.status = 'paid' THEN RETURN; END IF;

  UPDATE public.withdrawals
     SET status     = 'paid',
         orama_id   = p_orama_id,
         e2e_id     = p_e2e_id,
         paid_at    = p_paid_at,
         updated_at = now()
   WHERE id = v_wd.id;

  INSERT INTO public.wallet_transactions (user_id, title, description, amount, highlight)
  VALUES (v_wd.user_id, 'Saque concluído', 'PIX enviado · ' || v_wd.pix_key_type, -v_wd.fee_amount, 'muted')
  ON CONFLICT DO NOTHING;
END;
$$;
GRANT EXECUTE ON FUNCTION public.confirm_player_withdrawal(text, text, text, timestamptz) TO anon;
GRANT EXECUTE ON FUNCTION public.confirm_player_withdrawal(text, text, text, timestamptz) TO authenticated;

-- ============================================================
-- Affiliate withdrawals — fluxo de aprovação admin + PIX-out
-- 1. Adiciona external_ref e orama_id na tabela
-- 2. Recria request_affiliate_withdrawal gerando external_ref
-- 3. admin_list_affiliate_withdrawals
-- 4. admin_set_affiliate_withdrawal_processing
-- 5. admin_reject_affiliate_withdrawal (estorna saldo)
-- 6. confirm_affiliate_withdrawal (webhook PIX-out)
-- ============================================================

-- ── 1. Novas colunas ─────────────────────────────────────────
ALTER TABLE public.affiliate_withdrawals
  ADD COLUMN IF NOT EXISTS external_ref  text UNIQUE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS orama_id      text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS orama_status  text DEFAULT NULL;

-- Gera external_ref para linhas antigas que não têm
UPDATE public.affiliate_withdrawals
   SET external_ref = 'awd-' || gen_random_uuid()::text
 WHERE external_ref IS NULL;

-- Agora torna NOT NULL
ALTER TABLE public.affiliate_withdrawals
  ALTER COLUMN external_ref SET NOT NULL,
  ALTER COLUMN external_ref SET DEFAULT ('awd-' || gen_random_uuid()::text);

-- ── 2. request_affiliate_withdrawal — gera external_ref ──────
CREATE OR REPLACE FUNCTION public.request_affiliate_withdrawal(p_amount numeric)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_affiliate public.affiliates%ROWTYPE;
  v_settings  public.site_settings%ROWTYPE;
  v_min_wd    numeric;
  v_max_wd    numeric;
  v_ext_ref   text := 'awd-' || gen_random_uuid()::text;
BEGIN
  SELECT * INTO v_affiliate FROM public.affiliates WHERE profile_id = v_uid LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil de afiliado não encontrado.'; END IF;
  IF v_affiliate.status != 'approved' THEN RAISE EXCEPTION 'Afiliado não aprovado.'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Valor inválido.'; END IF;
  IF p_amount > v_affiliate.balance THEN RAISE EXCEPTION 'Saldo insuficiente.'; END IF;
  IF v_affiliate.pix_key IS NULL THEN RAISE EXCEPTION 'Cadastre uma chave PIX antes de sacar.'; END IF;

  SELECT * INTO v_settings FROM public.site_settings WHERE id = 1 LIMIT 1;
  v_min_wd := COALESCE(v_settings.aff_min_withdrawal, 50);
  v_max_wd := COALESCE(v_settings.aff_max_withdrawal, 10000);

  IF p_amount < v_min_wd THEN
    RAISE EXCEPTION 'Valor mínimo de saque: R$ %', v_min_wd;
  END IF;
  IF p_amount > v_max_wd THEN
    RAISE EXCEPTION 'Valor máximo de saque: R$ %', v_max_wd;
  END IF;

  -- Reserva saldo (debita imediatamente, estorna se rejeitado)
  UPDATE public.affiliates
     SET balance = balance - p_amount
   WHERE id = v_affiliate.id;

  INSERT INTO public.affiliate_withdrawals
    (affiliate_id, amount, pix_key_type, pix_key, external_ref, status)
  VALUES
    (v_affiliate.id, p_amount,
     COALESCE(v_affiliate.pix_key_type, ''),
     COALESCE(v_affiliate.pix_key, ''),
     v_ext_ref, 'pending');
END;
$$;
GRANT EXECUTE ON FUNCTION public.request_affiliate_withdrawal(numeric) TO authenticated;

-- ── 3. admin_list_affiliate_withdrawals ──────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_affiliate_withdrawals(
  p_status text DEFAULT NULL
)
RETURNS TABLE (
  id               uuid,
  affiliate_id     uuid,
  affiliate_name   text,
  affiliate_email  text,
  destination_name text,
  destination_doc  text,
  amount           numeric,
  pix_key_type     text,
  pix_key          text,
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
    SELECT
      aw.id,
      aw.affiliate_id,
      a.name               AS affiliate_name,
      a.email              AS affiliate_email,
      p.display_name       AS destination_name,
      COALESCE(p.cpf, '')  AS destination_doc,
      aw.amount,
      aw.pix_key_type,
      aw.pix_key,
      aw.status,
      aw.external_ref,
      aw.orama_id,
      aw.admin_notes,
      aw.created_at
    FROM public.affiliate_withdrawals aw
    JOIN public.affiliates    a ON a.id         = aw.affiliate_id
    JOIN public.profiles      p ON p.id         = a.profile_id
    WHERE (p_status IS NULL OR aw.status = p_status)
    ORDER BY aw.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_affiliate_withdrawals(text) TO authenticated;

-- ── 4. admin_set_affiliate_withdrawal_processing ─────────────
CREATE OR REPLACE FUNCTION public.admin_set_affiliate_withdrawal_processing(
  p_withdrawal_id uuid,
  p_orama_id      text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;

  UPDATE public.affiliate_withdrawals
     SET status     = 'processing',
         orama_id   = p_orama_id,
         updated_at = now()
   WHERE id = p_withdrawal_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_affiliate_withdrawal_processing(uuid, text) TO authenticated;

-- ── 5. admin_reject_affiliate_withdrawal (estorna saldo) ─────
CREATE OR REPLACE FUNCTION public.admin_reject_affiliate_withdrawal(
  p_withdrawal_id uuid,
  p_notes         text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_wd public.affiliate_withdrawals%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;

  SELECT * INTO v_wd FROM public.affiliate_withdrawals WHERE id = p_withdrawal_id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Saque não encontrado.'; END IF;
  IF v_wd.status NOT IN ('pending', 'processing') THEN
    RAISE EXCEPTION 'Saque já foi finalizado.';
  END IF;

  -- Estorna saldo ao afiliado
  UPDATE public.affiliates
     SET balance = balance + v_wd.amount
   WHERE id = v_wd.affiliate_id;

  UPDATE public.affiliate_withdrawals
     SET status      = 'rejected',
         admin_notes = p_notes,
         updated_at  = now()
   WHERE id = p_withdrawal_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_reject_affiliate_withdrawal(uuid, text) TO authenticated;

-- ── 6. confirm_affiliate_withdrawal (webhook) ─────────────────
CREATE OR REPLACE FUNCTION public.confirm_affiliate_withdrawal(
  p_external_ref text,
  p_orama_id     text,
  p_paid_at      timestamptz
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_wd public.affiliate_withdrawals%ROWTYPE;
BEGIN
  SELECT * INTO v_wd
    FROM public.affiliate_withdrawals
   WHERE external_ref = p_external_ref
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saque não encontrado: %', p_external_ref;
  END IF;

  -- Idempotência
  IF v_wd.status = 'paid' THEN RETURN; END IF;

  UPDATE public.affiliate_withdrawals
     SET status      = 'paid',
         orama_id    = p_orama_id,
         orama_status = 'paid',
         updated_at  = now()
   WHERE id = v_wd.id;

  -- Atualiza total_withdrawn do afiliado
  UPDATE public.affiliates
     SET total_withdrawn = total_withdrawn + v_wd.amount
   WHERE id = v_wd.affiliate_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.confirm_affiliate_withdrawal(text, text, timestamptz) TO anon;
GRANT EXECUTE ON FUNCTION public.confirm_affiliate_withdrawal(text, text, timestamptz) TO authenticated;

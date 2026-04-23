-- ============================================================
-- Aplica as configurações de site_settings em toda a plataforma
-- 1. get_player_settings() — RPC pública para o app frontend
-- 2. create_deposit_intent — valida depósito mínimo do banco
-- 3. confirm_deposit — respeita aff_baseline e aff_chance_cpa
-- ============================================================

-- ── 1. RPC pública: get_player_settings ──────────────────────
-- Retorna apenas os campos relevantes para o jogador.
-- Acessível sem ser admin (usado no app para mostrar limites).
CREATE OR REPLACE FUNCTION public.get_player_settings()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.site_settings%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.site_settings WHERE id = 1 LIMIT 1;
  IF NOT FOUND THEN
    -- Retorna defaults se a tabela ainda não tiver sido populada
    RETURN jsonb_build_object(
      'player_min_deposit',         1,
      'player_min_withdrawal',      20,
      'player_rollover',            1,
      'player_max_withdrawal',      5000,
      'player_withdrawal_fee',      0,
      'player_first_deposit_bonus', 0,
      'player_daily_withdrawals',   3
    );
  END IF;
  RETURN jsonb_build_object(
    'player_min_deposit',         v_row.player_min_deposit,
    'player_min_withdrawal',      v_row.player_min_withdrawal,
    'player_rollover',            v_row.player_rollover,
    'player_max_withdrawal',      v_row.player_max_withdrawal,
    'player_withdrawal_fee',      v_row.player_withdrawal_fee,
    'player_first_deposit_bonus', v_row.player_first_deposit_bonus,
    'player_daily_withdrawals',   v_row.player_daily_withdrawals
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_player_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_player_settings() TO anon;

-- ── 2. create_deposit_intent — valida contra depósito mínimo ─
CREATE OR REPLACE FUNCTION public.create_deposit_intent(
  p_amount_reais    numeric,
  p_amount_centavos integer
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid     uuid    := auth.uid();
  v_ref     uuid    := gen_random_uuid();
  v_min_dep numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF p_amount_reais <= 0 THEN RAISE EXCEPTION 'Valor inválido.'; END IF;

  -- Lê depósito mínimo configurado
  SELECT player_min_deposit INTO v_min_dep
    FROM public.site_settings WHERE id = 1 LIMIT 1;
  v_min_dep := COALESCE(v_min_dep, 1);

  IF p_amount_reais < v_min_dep THEN
    RAISE EXCEPTION 'Valor mínimo de depósito: R$ %', v_min_dep;
  END IF;

  INSERT INTO public.deposits (user_id, amount_reais, amount_centavos, external_ref)
  VALUES (v_uid, p_amount_reais, p_amount_centavos, v_ref::text);

  RETURN v_ref;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_deposit_intent(numeric, integer) TO authenticated;

-- ── 3. confirm_deposit — com afiliado + baseline + chance CPA ─
CREATE OR REPLACE FUNCTION public.confirm_deposit(
  p_external_ref text,
  p_orama_id     text,
  p_e2e_id       text,
  p_paid_at      timestamptz
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_deposit    public.deposits%ROWTYPE;
  v_referral   public.affiliate_referrals%ROWTYPE;
  v_affiliate  public.affiliates%ROWTYPE;
  v_settings   public.site_settings%ROWTYPE;
  v_cpa        numeric;
  v_baseline   numeric;
  v_chance     integer;
  v_roll       integer;
BEGIN
  -- ── 1. Buscar depósito ──────────────────────────────────────
  SELECT * INTO v_deposit
    FROM public.deposits
   WHERE external_ref = p_external_ref
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Depósito não encontrado: %', p_external_ref;
  END IF;

  -- Idempotência
  IF v_deposit.status = 'paid' THEN
    RETURN;
  END IF;

  -- ── 2. Marca depósito como pago ────────────────────────────
  UPDATE public.deposits
     SET status     = 'paid',
         orama_id   = p_orama_id,
         e2e_id     = p_e2e_id,
         paid_at    = p_paid_at,
         updated_at = now()
   WHERE id = v_deposit.id;

  -- ── 3. Credita saldo do jogador ────────────────────────────
  UPDATE public.profiles
     SET balance    = balance + v_deposit.amount_reais::integer,
         updated_at = now()
   WHERE id = v_deposit.user_id;

  -- ── 4. Configurações globais ───────────────────────────────
  SELECT * INTO v_settings FROM public.site_settings WHERE id = 1 LIMIT 1;
  v_baseline := COALESCE(v_settings.aff_baseline, 0);
  v_chance   := COALESCE(v_settings.aff_chance_cpa, 100);

  -- ── 5. Contabiliza no painel do afiliado ───────────────────
  SELECT * INTO v_referral
    FROM public.affiliate_referrals
   WHERE user_id = v_deposit.user_id
   LIMIT 1;

  IF FOUND THEN
    -- Acumula totais do referral
    UPDATE public.affiliate_referrals
       SET has_deposited = true,
           deposit_total = deposit_total + v_deposit.amount_reais
     WHERE id = v_referral.id;

    -- Paga CPA na primeira vez se:
    --   • cpa_paid = false
    --   • depósito >= baseline configurado
    --   • sorteio da chance CPA (ex: 80 → 80% de chances)
    IF NOT v_referral.cpa_paid
       AND v_deposit.amount_reais >= v_baseline
    THEN
      -- Sorteio: gera número 1–100, paga se <= v_chance
      v_roll := floor(random() * 100)::integer + 1;

      IF v_roll <= v_chance THEN
        SELECT * INTO v_affiliate
          FROM public.affiliates
         WHERE id = v_referral.affiliate_id
         LIMIT 1;

        IF FOUND AND v_affiliate.status = 'approved' THEN
          v_cpa := v_affiliate.cpa_amount;

          UPDATE public.affiliates
             SET balance      = balance + v_cpa,
                 total_earned = total_earned + v_cpa
           WHERE id = v_affiliate.id;
        END IF;
      END IF;

      -- Marca cpa_paid independentemente do sorteio
      -- (evita tentar de novo em depósitos futuros)
      UPDATE public.affiliate_referrals
         SET cpa_paid = true
       WHERE id = v_referral.id;
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_deposit(text, text, text, timestamptz) TO anon;
GRANT EXECUTE ON FUNCTION public.confirm_deposit(text, text, text, timestamptz) TO authenticated;

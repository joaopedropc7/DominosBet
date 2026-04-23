-- ============================================================
-- confirm_deposit — versão final com:
--   1. wallet_transaction registrada para o depósito
--   2. Bônus de primeiro depósito (player_first_deposit_bonus %)
--   3. Affiliate: deposit_total, has_deposited, CPA com baseline + chance
-- ============================================================

CREATE OR REPLACE FUNCTION public.confirm_deposit(
  p_external_ref text,
  p_orama_id     text,
  p_e2e_id       text,
  p_paid_at      timestamptz
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_deposit      public.deposits%ROWTYPE;
  v_referral     public.affiliate_referrals%ROWTYPE;
  v_affiliate    public.affiliates%ROWTYPE;
  v_settings     public.site_settings%ROWTYPE;
  v_prev_count   bigint;
  v_bonus_pct    integer;
  v_bonus_amount integer;
  v_baseline     numeric;
  v_chance       integer;
  v_roll         integer;
  v_cpa          numeric;
BEGIN
  -- ── 1. Buscar depósito ──────────────────────────────────────
  SELECT * INTO v_deposit
    FROM public.deposits
   WHERE external_ref = p_external_ref
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Depósito não encontrado: %', p_external_ref;
  END IF;

  IF v_deposit.status = 'paid' THEN RETURN; END IF;

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

  -- ── 4. Registra na carteira do jogador ────────────────────
  INSERT INTO public.wallet_transactions (user_id, title, description, amount, highlight)
  VALUES (
    v_deposit.user_id,
    'Depósito via PIX',
    'R$ ' || to_char(v_deposit.amount_reais, 'FM999999990.00') || ' depositado',
    v_deposit.amount_reais::integer,
    'cyan'
  );

  -- ── 5. Bônus de primeiro depósito ─────────────────────────
  SELECT COUNT(*) INTO v_prev_count
    FROM public.deposits
   WHERE user_id = v_deposit.user_id
     AND status  = 'paid'
     AND id     != v_deposit.id;

  IF v_prev_count = 0 THEN
    SELECT player_first_deposit_bonus INTO v_bonus_pct
      FROM public.site_settings WHERE id = 1 LIMIT 1;
    v_bonus_pct := COALESCE(v_bonus_pct, 0);

    IF v_bonus_pct > 0 THEN
      v_bonus_amount := FLOOR(v_deposit.amount_reais * v_bonus_pct / 100.0)::integer;

      UPDATE public.profiles
         SET balance    = balance + v_bonus_amount,
             updated_at = now()
       WHERE id = v_deposit.user_id;

      INSERT INTO public.wallet_transactions (user_id, title, description, amount, highlight)
      VALUES (
        v_deposit.user_id,
        'Bônus de Primeiro Depósito',
        v_bonus_pct || '% creditado automaticamente',
        v_bonus_amount,
        'cyan'
      );
    END IF;
  END IF;

  -- ── 6. Afiliado: contabiliza depósito ──────────────────────
  SELECT * INTO v_settings FROM public.site_settings WHERE id = 1 LIMIT 1;
  v_baseline := COALESCE(v_settings.aff_baseline,   0);
  v_chance   := COALESCE(v_settings.aff_chance_cpa, 100);

  SELECT * INTO v_referral
    FROM public.affiliate_referrals
   WHERE user_id = v_deposit.user_id
   LIMIT 1;

  IF FOUND THEN
    UPDATE public.affiliate_referrals
       SET has_deposited = true,
           deposit_total = deposit_total + v_deposit.amount_reais
     WHERE id = v_referral.id;

    -- CPA: apenas na primeira vez, acima do baseline, respeitando chance
    IF NOT v_referral.cpa_paid
       AND v_deposit.amount_reais >= v_baseline
    THEN
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

      UPDATE public.affiliate_referrals
         SET cpa_paid = true
       WHERE id = v_referral.id;
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_deposit(text, text, text, timestamptz) TO anon;
GRANT EXECUTE ON FUNCTION public.confirm_deposit(text, text, text, timestamptz) TO authenticated;

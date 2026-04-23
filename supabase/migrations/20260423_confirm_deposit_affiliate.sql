-- Atualiza confirm_deposit para contabilizar depósitos no painel do afiliado
-- Lógica adicionada:
--   1. Atualiza affiliate_referrals: has_deposited=true, acumula deposit_total
--   2. Paga CPA ao afiliado na primeira vez que o indicado deposita (cpa_paid=false)
--   3. Credita balance e total_earned do afiliado

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
  v_cpa        numeric;
BEGIN
  -- ── 1. Buscar depósito ──────────────────────────────────────
  SELECT * INTO v_deposit
    FROM public.deposits
   WHERE external_ref = p_external_ref
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Depósito não encontrado: %', p_external_ref;
  END IF;

  -- Idempotência: ignora se já foi confirmado
  IF v_deposit.status = 'paid' THEN
    RETURN;
  END IF;

  -- ── 2. Marca o depósito como pago ──────────────────────────
  UPDATE public.deposits
     SET status     = 'paid',
         orama_id   = p_orama_id,
         e2e_id     = p_e2e_id,
         paid_at    = p_paid_at,
         updated_at = now()
   WHERE id = v_deposit.id;

  -- ── 3. Credita o saldo do jogador ──────────────────────────
  UPDATE public.profiles
     SET balance    = balance + v_deposit.amount_reais::integer,
         updated_at = now()
   WHERE id = v_deposit.user_id;

  -- ── 4. Contabiliza no painel do afiliado ───────────────────
  SELECT * INTO v_referral
    FROM public.affiliate_referrals
   WHERE user_id = v_deposit.user_id
   LIMIT 1;

  IF FOUND THEN
    -- Atualiza totais do referral
    UPDATE public.affiliate_referrals
       SET has_deposited = true,
           deposit_total = deposit_total + v_deposit.amount_reais
     WHERE id = v_referral.id;

    -- Paga CPA somente na primeira vez (cpa_paid = false)
    IF NOT v_referral.cpa_paid THEN
      SELECT * INTO v_affiliate
        FROM public.affiliates
       WHERE id = v_referral.affiliate_id
       LIMIT 1;

      IF FOUND AND v_affiliate.status = 'approved' THEN
        v_cpa := v_affiliate.cpa_amount;

        -- Credita o afiliado
        UPDATE public.affiliates
           SET balance      = balance + v_cpa,
               total_earned = total_earned + v_cpa
         WHERE id = v_affiliate.id;

        -- Marca CPA como pago para não pagar de novo
        UPDATE public.affiliate_referrals
           SET cpa_paid = true
         WHERE id = v_referral.id;
      END IF;
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_deposit(text, text, text, timestamptz) TO anon;
GRANT EXECUTE ON FUNCTION public.confirm_deposit(text, text, text, timestamptz) TO authenticated;

-- Atualiza confirm_player_withdrawal e confirm_affiliate_withdrawal
-- para aceitar lookup por orama_id (data.id do webhook da OramaPay)
-- além do external_ref existente.

-- ── confirm_player_withdrawal ────────────────────────────────
CREATE OR REPLACE FUNCTION public.confirm_player_withdrawal(
  p_external_ref text        DEFAULT NULL,
  p_orama_id     text        DEFAULT NULL,
  p_e2e_id       text        DEFAULT '',
  p_paid_at      timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_wd public.withdrawals%ROWTYPE;
BEGIN
  -- Busca por external_ref OU por orama_id
  SELECT * INTO v_wd
    FROM public.withdrawals
   WHERE (p_external_ref IS NOT NULL AND external_ref = p_external_ref)
      OR (p_orama_id     IS NOT NULL AND orama_id     = p_orama_id)
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saque não encontrado (external_ref=%, orama_id=%)', p_external_ref, p_orama_id;
  END IF;

  -- Idempotência
  IF v_wd.status = 'paid' THEN RETURN; END IF;

  UPDATE public.withdrawals
     SET status     = 'paid',
         orama_id   = COALESCE(p_orama_id, orama_id),
         e2e_id     = COALESCE(NULLIF(p_e2e_id, ''), e2e_id),
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

-- ── confirm_affiliate_withdrawal ─────────────────────────────
CREATE OR REPLACE FUNCTION public.confirm_affiliate_withdrawal(
  p_external_ref text        DEFAULT NULL,
  p_orama_id     text        DEFAULT NULL,
  p_paid_at      timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_wd public.affiliate_withdrawals%ROWTYPE;
BEGIN
  SELECT * INTO v_wd
    FROM public.affiliate_withdrawals
   WHERE (p_external_ref IS NOT NULL AND external_ref = p_external_ref)
      OR (p_orama_id     IS NOT NULL AND orama_id     = p_orama_id)
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saque não encontrado (external_ref=%, orama_id=%)', p_external_ref, p_orama_id;
  END IF;

  IF v_wd.status = 'paid' THEN RETURN; END IF;

  UPDATE public.affiliate_withdrawals
     SET status       = 'paid',
         orama_id     = COALESCE(p_orama_id, orama_id),
         orama_status = 'paid',
         updated_at   = now()
   WHERE id = v_wd.id;

  UPDATE public.affiliates
     SET total_withdrawn = total_withdrawn + v_wd.amount
   WHERE id = v_wd.affiliate_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.confirm_affiliate_withdrawal(text, text, timestamptz) TO anon;
GRANT EXECUTE ON FUNCTION public.confirm_affiliate_withdrawal(text, text, timestamptz) TO authenticated;

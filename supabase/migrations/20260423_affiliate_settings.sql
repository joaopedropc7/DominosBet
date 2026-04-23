-- ============================================================
-- get_affiliate_settings() — configurações públicas do programa
-- de afiliados (mínimo de saque, máximo, saques diários)
-- Também corrige request_affiliate_withdrawal para ler o mínimo do DB
-- ============================================================

-- ── 1. RPC pública: get_affiliate_settings ────────────────────
CREATE OR REPLACE FUNCTION public.get_affiliate_settings()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.site_settings%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.site_settings WHERE id = 1 LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'aff_min_withdrawal',    50,
      'aff_max_withdrawal',    10000,
      'aff_daily_withdrawals', 1
    );
  END IF;
  RETURN jsonb_build_object(
    'aff_min_withdrawal',    v_row.aff_min_withdrawal,
    'aff_max_withdrawal',    v_row.aff_max_withdrawal,
    'aff_daily_withdrawals', v_row.aff_daily_withdrawals
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_affiliate_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_affiliate_settings() TO anon;

-- ── 2. request_affiliate_withdrawal — valida contra DB ────────
CREATE OR REPLACE FUNCTION public.request_affiliate_withdrawal(p_amount numeric)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_affiliate public.affiliates%ROWTYPE;
  v_settings  public.site_settings%ROWTYPE;
  v_min_wd    numeric;
  v_max_wd    numeric;
BEGIN
  SELECT * INTO v_affiliate FROM public.affiliates WHERE profile_id = v_uid LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil de afiliado não encontrado.'; END IF;
  IF v_affiliate.status != 'approved' THEN RAISE EXCEPTION 'Afiliado não aprovado.'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Valor inválido.'; END IF;
  IF p_amount > v_affiliate.balance THEN RAISE EXCEPTION 'Saldo insuficiente.'; END IF;
  IF v_affiliate.pix_key IS NULL THEN RAISE EXCEPTION 'Cadastre uma chave PIX antes de sacar.'; END IF;

  -- Lê limites configurados pelo admin
  SELECT * INTO v_settings FROM public.site_settings WHERE id = 1 LIMIT 1;
  v_min_wd := COALESCE(v_settings.aff_min_withdrawal, 50);
  v_max_wd := COALESCE(v_settings.aff_max_withdrawal, 10000);

  IF p_amount < v_min_wd THEN
    RAISE EXCEPTION 'Valor mínimo de saque: R$ %', v_min_wd;
  END IF;
  IF p_amount > v_max_wd THEN
    RAISE EXCEPTION 'Valor máximo de saque: R$ %', v_max_wd;
  END IF;

  UPDATE public.affiliates
     SET balance = balance - p_amount
   WHERE id = v_affiliate.id;

  INSERT INTO public.affiliate_withdrawals (affiliate_id, amount, pix_key_type, pix_key)
  VALUES (v_affiliate.id, p_amount, COALESCE(v_affiliate.pix_key_type, ''), COALESCE(v_affiliate.pix_key, ''));
END;
$$;
GRANT EXECUTE ON FUNCTION public.request_affiliate_withdrawal(numeric) TO authenticated;

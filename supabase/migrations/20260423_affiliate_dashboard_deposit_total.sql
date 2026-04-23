-- Adiciona deposit_total_sum ao get_affiliate_dashboard
-- Soma todos os depósitos dos indicados deste afiliado

CREATE OR REPLACE FUNCTION public.get_affiliate_dashboard(
  p_from date DEFAULT NULL,
  p_to   date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid              uuid := auth.uid();
  v_affiliate        public.affiliates%ROWTYPE;
  v_registros        bigint;
  v_ftds             bigint;
  v_deposit_total    numeric;
BEGIN
  SELECT * INTO v_affiliate FROM public.affiliates WHERE profile_id = v_uid LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil de afiliado não encontrado.'; END IF;

  SELECT COUNT(*) INTO v_registros
    FROM public.affiliate_referrals
   WHERE affiliate_id = v_affiliate.id
     AND (p_from IS NULL OR created_at::date >= p_from)
     AND (p_to   IS NULL OR created_at::date <= p_to);

  SELECT COUNT(*) INTO v_ftds
    FROM public.affiliate_referrals
   WHERE affiliate_id = v_affiliate.id
     AND has_deposited = true
     AND (p_from IS NULL OR created_at::date >= p_from)
     AND (p_to   IS NULL OR created_at::date <= p_to);

  SELECT COALESCE(SUM(deposit_total), 0) INTO v_deposit_total
    FROM public.affiliate_referrals
   WHERE affiliate_id = v_affiliate.id;

  RETURN jsonb_build_object(
    'balance',             v_affiliate.balance,
    'total_earned',        v_affiliate.total_earned,
    'total_withdrawn',     v_affiliate.total_withdrawn,
    'registros',           v_registros,
    'ftds',                v_ftds,
    'deposit_total_sum',   v_deposit_total,
    'revshare_percent',    v_affiliate.revshare_percent,
    'cpa_amount',          v_affiliate.cpa_amount,
    'sub_affiliate_percent', v_affiliate.sub_affiliate_percent
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_affiliate_dashboard(date, date) TO authenticated;

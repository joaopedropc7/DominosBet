-- ============================================================
-- admin_list_all_withdrawals — visão unificada de saques
-- Retorna saques de jogadores + saques de afiliados em uma
-- única lista ordenada por data, com campo "kind" distinguindo
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_list_all_withdrawals(
  p_status text    DEFAULT NULL,  -- NULL = todos
  p_kind   text    DEFAULT NULL,  -- 'player' | 'affiliate' | NULL = ambos
  p_limit  integer DEFAULT 200,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id               uuid,
  kind             text,    -- 'player' | 'affiliate'
  subject_name     text,
  subject_email    text,
  amount           numeric,
  net_amount       numeric,
  pix_key_type     text,
  pix_key          text,
  status           text,
  external_ref     text,
  admin_notes      text,
  created_at       timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;

  RETURN QUERY
    -- Saques de jogadores
    SELECT
      w.id,
      'player'::text                          AS kind,
      p.display_name                          AS subject_name,
      p.email                                 AS subject_email,
      w.amount::numeric,
      w.net_amount::numeric,
      w.pix_key_type,
      w.pix_key,
      w.status,
      w.external_ref,
      w.admin_notes,
      w.created_at
    FROM public.withdrawals w
    JOIN public.profiles p ON p.id = w.user_id
    WHERE (p_status IS NULL OR w.status = p_status)
      AND (p_kind IS NULL OR p_kind = 'player')

    UNION ALL

    -- Saques de afiliados
    SELECT
      aw.id,
      'affiliate'::text                       AS kind,
      a.name                                  AS subject_name,
      a.email                                 AS subject_email,
      aw.amount::numeric,
      aw.amount::numeric                      AS net_amount, -- sem taxa
      aw.pix_key_type,
      aw.pix_key,
      aw.status,
      aw.external_ref,
      aw.admin_notes,
      aw.created_at
    FROM public.affiliate_withdrawals aw
    JOIN public.affiliates a ON a.id = aw.affiliate_id
    WHERE (p_status IS NULL OR aw.status = p_status)
      AND (p_kind IS NULL OR p_kind = 'affiliate')

    ORDER BY created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_all_withdrawals(text, text, integer, integer) TO authenticated;

-- ============================================================
-- admin_financial_summary — totais consolidados
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_financial_summary()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_deposits_total       numeric;
  v_deposits_pending     numeric;
  v_player_wd_paid       numeric;
  v_player_wd_pending    numeric;
  v_affiliate_wd_paid    numeric;
  v_affiliate_wd_pending numeric;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;

  SELECT COALESCE(SUM(amount_reais), 0) INTO v_deposits_total
    FROM public.deposits WHERE status = 'paid';

  SELECT COALESCE(SUM(amount_reais), 0) INTO v_deposits_pending
    FROM public.deposits WHERE status = 'pending';

  SELECT COALESCE(SUM(net_amount), 0) INTO v_player_wd_paid
    FROM public.withdrawals WHERE status = 'paid';

  SELECT COALESCE(SUM(net_amount), 0) INTO v_player_wd_pending
    FROM public.withdrawals WHERE status IN ('pending', 'processing');

  SELECT COALESCE(SUM(amount), 0) INTO v_affiliate_wd_paid
    FROM public.affiliate_withdrawals WHERE status = 'paid';

  SELECT COALESCE(SUM(amount), 0) INTO v_affiliate_wd_pending
    FROM public.affiliate_withdrawals WHERE status IN ('pending', 'processing');

  RETURN jsonb_build_object(
    'deposits_total',        v_deposits_total,
    'deposits_pending',      v_deposits_pending,
    'player_wd_paid',        v_player_wd_paid,
    'player_wd_pending',     v_player_wd_pending,
    'affiliate_wd_paid',     v_affiliate_wd_paid,
    'affiliate_wd_pending',  v_affiliate_wd_pending,
    'net_revenue',           v_deposits_total - v_player_wd_paid - v_affiliate_wd_paid
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_financial_summary() TO authenticated;

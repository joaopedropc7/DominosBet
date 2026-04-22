-- ============================================================
-- admin_list_affiliates v2 — adds metrics + search
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_list_affiliates(
  p_status text DEFAULT NULL,  -- NULL = todos
  p_search text DEFAULT NULL   -- filtra por nome ou e-mail (ilike)
)
RETURNS TABLE (
  id                    uuid,
  name                  text,
  email                 text,
  phone                 text,
  cpf                   text,
  referral_code         text,
  status                text,
  own_code              text,
  admin_notes           text,
  revshare_percent      integer,
  cpa_amount            numeric,
  sub_affiliate_percent integer,
  balance               numeric,
  total_earned          numeric,
  total_withdrawn       numeric,
  referrals_count       bigint,   -- jogadores indicados
  deposits_total        numeric,  -- soma dos depósitos trazidos
  created_at            timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  RETURN QUERY
    SELECT
      a.id,
      a.name,
      a.email,
      a.phone,
      a.cpf,
      a.referral_code,
      a.status,
      a.own_code,
      a.admin_notes,
      a.revshare_percent,
      a.cpa_amount,
      a.sub_affiliate_percent,
      a.balance,
      a.total_earned,
      a.total_withdrawn,
      COALESCE(r.referrals_count, 0)  AS referrals_count,
      COALESCE(r.deposits_total,  0)  AS deposits_total,
      a.created_at
    FROM public.affiliates a
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)              AS referrals_count,
        SUM(deposit_total)    AS deposits_total
      FROM public.affiliate_referrals
      WHERE affiliate_id = a.id
    ) r ON true
    WHERE
      (p_status IS NULL OR a.status = p_status)
      AND (
        p_search IS NULL
        OR a.name  ILIKE '%' || p_search || '%'
        OR a.email ILIKE '%' || p_search || '%'
      )
    ORDER BY a.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_affiliates(text, text) TO authenticated;

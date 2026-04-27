-- Corrige admin_list_affiliate_withdrawals para usar affiliates.cpf
-- como destination_doc (em vez de profiles.cpf que costuma estar vazio)
-- e affiliates.name como destination_name (nome real do afiliado).

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
      a.name                                AS affiliate_name,
      a.email                               AS affiliate_email,
      COALESCE(a.name, p.display_name, '')  AS destination_name,
      -- Prioriza CPF do afiliado; cai para CPF do perfil; depois para a chave se for CPF
      COALESCE(
        NULLIF(a.cpf, ''),
        NULLIF(p.cpf,  ''),
        CASE WHEN UPPER(aw.pix_key_type) = 'CPF' THEN aw.pix_key ELSE '' END
      )                                     AS destination_doc,
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

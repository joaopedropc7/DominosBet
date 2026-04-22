-- ============================================================
-- Adiciona CPF e telefone ao perfil do jogador
-- Necessário para geração de PIX (OramaPay exige documento)
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf   text,
  ADD COLUMN IF NOT EXISTS phone text;

-- ── RPC: update_profile_document ────────────────────────────
-- Chamada antes de gerar o PIX quando o usuário ainda não tem CPF salvo.
CREATE OR REPLACE FUNCTION public.update_profile_document(
  p_cpf   text,
  p_phone text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles
     SET cpf        = trim(p_cpf),
         phone      = CASE WHEN p_phone IS NOT NULL THEN trim(p_phone) ELSE phone END,
         updated_at = now()
   WHERE id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_profile_document(text, text) TO authenticated;

-- ── RPC: admin_list_deposits ─────────────────────────────────
-- Lista todos os depósitos para o painel admin.
CREATE OR REPLACE FUNCTION public.admin_list_deposits(
  p_status text   DEFAULT NULL,
  p_limit  integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id               uuid,
  user_id          uuid,
  display_name     text,
  email            text,
  amount_reais     numeric,
  status           text,
  orama_id         text,
  external_ref     text,
  pix_expires_at   timestamptz,
  paid_at          timestamptz,
  created_at       timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  RETURN QUERY
    SELECT
      d.id,
      d.user_id,
      p.display_name,
      p.email,
      d.amount_reais,
      d.status,
      d.orama_id,
      d.external_ref,
      d.pix_expires_at,
      d.paid_at,
      d.created_at
    FROM public.deposits d
    JOIN public.profiles p ON p.id = d.user_id
    WHERE (p_status IS NULL OR d.status = p_status)
    ORDER BY d.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;
-- Apenas admins (via is_admin() check interno)
GRANT EXECUTE ON FUNCTION public.admin_list_deposits(text, integer, integer) TO authenticated;

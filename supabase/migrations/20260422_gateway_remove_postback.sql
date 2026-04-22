-- Remove postback_url do RPC de update (a URL é gerada automaticamente na Edge Function)

-- Recria admin_get_gateway_settings sem postback_url
CREATE OR REPLACE FUNCTION public.admin_get_gateway_settings()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  RETURN (
    SELECT jsonb_build_object(
      'id',         g.id,
      'api_key',    g.api_key,
      'public_key', g.public_key,
      'is_live',    g.is_live,
      'updated_at', g.updated_at
    )
    FROM public.gateway_settings g
    WHERE g.provider = 'oramapay'
    LIMIT 1
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_gateway_settings() TO authenticated;

-- Remove a assinatura antiga (com p_postback_url) e recria sem ela
DROP FUNCTION IF EXISTS public.admin_update_gateway_settings(text, text, boolean, text);

CREATE OR REPLACE FUNCTION public.admin_update_gateway_settings(
  p_api_key    text,
  p_public_key text,
  p_is_live    boolean
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;

  UPDATE public.gateway_settings
     SET api_key    = trim(p_api_key),
         public_key = trim(p_public_key),
         is_live    = p_is_live,
         updated_at = now()
   WHERE provider = 'oramapay';
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_update_gateway_settings(text, text, boolean) TO authenticated;

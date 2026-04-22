-- ============================================================
-- Gateway settings — armazena credenciais de pagamento
-- ============================================================

CREATE TABLE IF NOT EXISTS public.gateway_settings (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     text        NOT NULL UNIQUE DEFAULT 'oramapay',
  api_key      text        NOT NULL DEFAULT '',
  public_key   text        NOT NULL DEFAULT '',
  is_live      boolean     NOT NULL DEFAULT false,
  postback_url text        NOT NULL DEFAULT '',
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Inserir linha padrão vazia para OramaPay
INSERT INTO public.gateway_settings (provider) VALUES ('oramapay')
  ON CONFLICT (provider) DO NOTHING;

ALTER TABLE public.gateway_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gateway_admin_all" ON public.gateway_settings;
CREATE POLICY "gateway_admin_all" ON public.gateway_settings
  FOR ALL USING (public.is_admin());

-- ── RPC: admin_get_gateway_settings ──────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_gateway_settings()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  RETURN (
    SELECT jsonb_build_object(
      'id',           g.id,
      'api_key',      g.api_key,
      'public_key',   g.public_key,
      'is_live',      g.is_live,
      'postback_url', g.postback_url,
      'updated_at',   g.updated_at
    )
    FROM public.gateway_settings g
    WHERE g.provider = 'oramapay'
    LIMIT 1
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_gateway_settings() TO authenticated;

-- ── RPC: admin_update_gateway_settings ───────────────────────
CREATE OR REPLACE FUNCTION public.admin_update_gateway_settings(
  p_api_key      text,
  p_public_key   text,
  p_is_live      boolean,
  p_postback_url text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;

  UPDATE public.gateway_settings
     SET api_key      = trim(p_api_key),
         public_key   = trim(p_public_key),
         is_live      = p_is_live,
         postback_url = trim(p_postback_url),
         updated_at   = now()
   WHERE provider = 'oramapay';
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_update_gateway_settings(text, text, boolean, text) TO authenticated;

-- RPC pública para o frontend buscar título, descrição e keywords do SEO
-- Acessível por qualquer visitante (anon), sem autenticação
CREATE OR REPLACE FUNCTION public.get_seo_settings()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.site_settings%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.site_settings WHERE id = 1 LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'seo_title',       '',
      'seo_description', '',
      'seo_keywords',    ''
    );
  END IF;
  RETURN jsonb_build_object(
    'seo_title',       v_row.seo_title,
    'seo_description', v_row.seo_description,
    'seo_keywords',    v_row.seo_keywords
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_seo_settings() TO anon;
GRANT EXECUTE ON FUNCTION public.get_seo_settings() TO authenticated;

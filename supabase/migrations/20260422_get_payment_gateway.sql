-- RPC pública para usuários autenticados obterem as credenciais do gateway.
-- Necessário para que o app chame a OramaPay diretamente sem Edge Function.
CREATE OR REPLACE FUNCTION public.get_payment_gateway()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'api_key',    g.api_key,
      'public_key', g.public_key,
      'is_live',    g.is_live
    )
    FROM public.gateway_settings g
    WHERE g.provider = 'oramapay'
    LIMIT 1
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_payment_gateway() TO authenticated;

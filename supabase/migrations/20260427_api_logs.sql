-- Tabela de logs de todas as requisições ao gateway OramaPay
-- Salva request + response para depuração de saques e depósitos.

CREATE TABLE IF NOT EXISTS public.api_logs (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  type          text        NOT NULL,   -- 'pix-out' | 'pix-out-affiliate' | 'webhook-withdrawal'
  withdrawal_id uuid,                   -- ID do saque (quando disponível)
  external_ref  text,                   -- e.g. 'wd-xxx' ou 'awd-xxx'
  status_code   int,                    -- HTTP status da resposta da OramaPay
  request_body  jsonb,                  -- payload enviado
  response_body jsonb,                  -- resposta recebida
  error         text,                   -- mensagem de erro (se houver)
  created_at    timestamptz DEFAULT now()
);

-- Índices úteis para filtragem no painel
CREATE INDEX IF NOT EXISTS api_logs_type_idx          ON public.api_logs (type);
CREATE INDEX IF NOT EXISTS api_logs_withdrawal_id_idx ON public.api_logs (withdrawal_id);
CREATE INDEX IF NOT EXISTS api_logs_created_at_idx    ON public.api_logs (created_at DESC);

-- RLS
ALTER TABLE public.api_logs ENABLE ROW LEVEL SECURITY;

-- Qualquer autenticado pode inserir (APIs do Vercel usam o JWT do admin)
-- Webhook usa anon key, então a função abaixo é SECURITY DEFINER
DROP POLICY IF EXISTS api_logs_insert ON public.api_logs;

-- ── RPC: insert_api_log (acessível por anon para webhooks) ────
CREATE OR REPLACE FUNCTION public.insert_api_log(
  p_type          text,
  p_withdrawal_id uuid    DEFAULT NULL,
  p_external_ref  text    DEFAULT NULL,
  p_status_code   int     DEFAULT NULL,
  p_request_body  jsonb   DEFAULT NULL,
  p_response_body jsonb   DEFAULT NULL,
  p_error         text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.api_logs (
    type, withdrawal_id, external_ref,
    status_code, request_body, response_body, error
  ) VALUES (
    p_type, p_withdrawal_id, p_external_ref,
    p_status_code, p_request_body, p_response_body, p_error
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Permitir anon e authenticated chamarem insert_api_log
GRANT EXECUTE ON FUNCTION public.insert_api_log(text, uuid, text, int, jsonb, jsonb, text) TO anon;
GRANT EXECUTE ON FUNCTION public.insert_api_log(text, uuid, text, int, jsonb, jsonb, text) TO authenticated;

-- ── RPC: admin_list_api_logs ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_api_logs(
  p_type   text DEFAULT NULL,
  p_limit  int  DEFAULT 100,
  p_offset int  DEFAULT 0
)
RETURNS TABLE (
  id            uuid,
  type          text,
  withdrawal_id uuid,
  external_ref  text,
  status_code   int,
  request_body  jsonb,
  response_body jsonb,
  error         text,
  created_at    timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;

  RETURN QUERY
  SELECT
    l.id, l.type, l.withdrawal_id, l.external_ref,
    l.status_code, l.request_body, l.response_body,
    l.error, l.created_at
  FROM public.api_logs l
  WHERE (p_type IS NULL OR l.type = p_type)
  ORDER BY l.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_api_logs(text, int, int) TO authenticated;

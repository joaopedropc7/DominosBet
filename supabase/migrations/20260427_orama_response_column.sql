-- Guarda a resposta bruta da OramaPay quando o PIX-out é enviado
-- Permite depuração sem precisar consultar o gateway novamente.

ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS orama_response jsonb DEFAULT NULL;

ALTER TABLE public.affiliate_withdrawals
  ADD COLUMN IF NOT EXISTS orama_response jsonb DEFAULT NULL;

-- ── RPC: admin_set_withdrawal_orama_response ─────────────────
-- Atualiza resposta bruta + status processing para jogadores
CREATE OR REPLACE FUNCTION public.admin_set_withdrawal_processing(
  p_withdrawal_id uuid,
  p_orama_id      text,
  p_orama_response jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;

  UPDATE public.withdrawals
     SET status         = 'processing',
         orama_id       = p_orama_id,
         orama_response = p_orama_response,
         updated_at     = now()
   WHERE id = p_withdrawal_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_withdrawal_processing(uuid, text, jsonb) TO authenticated;

-- ── RPC: admin_set_affiliate_withdrawal_processing ───────────
-- Atualiza resposta bruta + status processing para afiliados
CREATE OR REPLACE FUNCTION public.admin_set_affiliate_withdrawal_processing(
  p_withdrawal_id  uuid,
  p_orama_id       text,
  p_orama_response jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;

  UPDATE public.affiliate_withdrawals
     SET status         = 'processing',
         orama_id       = p_orama_id,
         orama_response = p_orama_response,
         updated_at     = now()
   WHERE id = p_withdrawal_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_affiliate_withdrawal_processing(uuid, text, jsonb) TO authenticated;

-- ── RPC: admin_get_withdrawal_orama_response ─────────────────
CREATE OR REPLACE FUNCTION public.admin_get_withdrawal_orama_response(
  p_withdrawal_id uuid,
  p_kind          text  -- 'player' | 'affiliate'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_response jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;

  IF p_kind = 'affiliate' THEN
    SELECT orama_response INTO v_response
      FROM public.affiliate_withdrawals
     WHERE id = p_withdrawal_id LIMIT 1;
  ELSE
    SELECT orama_response INTO v_response
      FROM public.withdrawals
     WHERE id = p_withdrawal_id LIMIT 1;
  END IF;

  RETURN v_response;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_withdrawal_orama_response(uuid, text) TO authenticated;

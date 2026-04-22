-- ============================================================
-- Deposits — rastreia cada tentativa de depósito via PIX
-- ============================================================

CREATE TABLE IF NOT EXISTS public.deposits (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_reais     numeric     NOT NULL,           -- valor em reais (ex: 100.00)
  amount_centavos  integer     NOT NULL,           -- valor em centavos (ex: 10000)
  status           text        NOT NULL DEFAULT 'pending',
    -- pending | paid | refused | expired | refunded
  orama_id         text,                           -- ID da transação na OramaPay
  external_ref     text        UNIQUE NOT NULL,    -- UUID enviado como externalRef
  pix_qrcode       text,                           -- código copia-e-cola
  pix_qrcode_image text,                           -- URL/base64 do QR Code
  pix_expires_at   timestamptz,                    -- expiração do QR
  e2e_id           text,                           -- End-to-End ID (chega no webhook)
  paid_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deposits_user_idx         ON public.deposits (user_id);
CREATE INDEX IF NOT EXISTS deposits_external_ref_idx ON public.deposits (external_ref);
CREATE INDEX IF NOT EXISTS deposits_status_idx       ON public.deposits (status);

ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

-- Usuário vê apenas seus próprios depósitos
DROP POLICY IF EXISTS "deposits_select_own" ON public.deposits;
CREATE POLICY "deposits_select_own" ON public.deposits
  FOR SELECT USING (user_id = auth.uid());

-- Admins veem tudo
DROP POLICY IF EXISTS "deposits_admin_all" ON public.deposits;
CREATE POLICY "deposits_admin_all" ON public.deposits
  FOR ALL USING (public.is_admin());

-- ── RPC: create_deposit_intent ────────────────────────────────
-- Chamado pela Edge Function generate-pix antes de ir à OramaPay.
-- Cria o registro de depósito e retorna o external_ref (UUID).
CREATE OR REPLACE FUNCTION public.create_deposit_intent(
  p_amount_reais    numeric,
  p_amount_centavos integer
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_ref  uuid := gen_random_uuid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF p_amount_reais <= 0 THEN RAISE EXCEPTION 'Valor inválido.'; END IF;

  INSERT INTO public.deposits (user_id, amount_reais, amount_centavos, external_ref)
  VALUES (v_uid, p_amount_reais, p_amount_centavos, v_ref::text);

  RETURN v_ref;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_deposit_intent(numeric, integer) TO authenticated;

-- ── RPC: update_deposit_pix ──────────────────────────────────
-- Chamado pela Edge Function generate-pix após receber a resposta da OramaPay.
CREATE OR REPLACE FUNCTION public.update_deposit_pix(
  p_external_ref     text,
  p_orama_id         text,
  p_pix_qrcode       text,
  p_pix_qrcode_image text,
  p_pix_expires_at   timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.deposits
     SET orama_id         = p_orama_id,
         pix_qrcode       = p_pix_qrcode,
         pix_qrcode_image = p_pix_qrcode_image,
         pix_expires_at   = p_pix_expires_at,
         status           = 'pending',
         updated_at       = now()
   WHERE external_ref = p_external_ref
     AND user_id      = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_deposit_pix(text, text, text, text, timestamptz) TO authenticated;

-- ── RPC: confirm_deposit (chamado pelo webhook via service role) ─
-- Marca o depósito como pago e credita o saldo do usuário.
CREATE OR REPLACE FUNCTION public.confirm_deposit(
  p_external_ref text,
  p_orama_id     text,
  p_e2e_id       text,
  p_paid_at      timestamptz
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_deposit public.deposits%ROWTYPE;
BEGIN
  SELECT * INTO v_deposit
    FROM public.deposits
   WHERE external_ref = p_external_ref
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Depósito não encontrado: %', p_external_ref;
  END IF;

  -- Idempotência: ignora se já foi confirmado
  IF v_deposit.status = 'paid' THEN
    RETURN;
  END IF;

  -- Marca como pago
  UPDATE public.deposits
     SET status     = 'paid',
         orama_id   = p_orama_id,
         e2e_id     = p_e2e_id,
         paid_at    = p_paid_at,
         updated_at = now()
   WHERE id = v_deposit.id;

  -- Credita o saldo do jogador (em moedas = centavos / 100 * coins_per_real)
  -- Aqui somamos direto em coins (1 real = 1 coin como padrão)
  UPDATE public.profiles
     SET coins     = coins + v_deposit.amount_reais::integer,
         updated_at = now()
   WHERE id = v_deposit.user_id;
END;
$$;
-- Executado apenas pela service role via Edge Function (sem GRANT a authenticated)

-- Corrige confirm_deposit: coluna é "balance", não "coins"
-- Também garante GRANT para anon (webhook não tem sessão de usuário)
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

  -- Marca o depósito como pago
  UPDATE public.deposits
     SET status     = 'paid',
         orama_id   = p_orama_id,
         e2e_id     = p_e2e_id,
         paid_at    = p_paid_at,
         updated_at = now()
   WHERE id = v_deposit.id;

  -- Credita o saldo do jogador (balance = coluna correta)
  UPDATE public.profiles
     SET balance    = balance + v_deposit.amount_reais::integer,
         updated_at = now()
   WHERE id = v_deposit.user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_deposit(text, text, text, timestamptz) TO anon;
GRANT EXECUTE ON FUNCTION public.confirm_deposit(text, text, text, timestamptz) TO authenticated;

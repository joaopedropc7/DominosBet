-- TEMPORÁRIO — apenas para testes. Remover após validação.
-- Faz rollback de um saque de afiliado: volta status para 'pending'
-- e estorna o valor ao saldo do afiliado.

CREATE OR REPLACE FUNCTION public.admin_rollback_affiliate_withdrawal(
  p_withdrawal_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_wd public.affiliate_withdrawals%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;

  SELECT * INTO v_wd FROM public.affiliate_withdrawals WHERE id = p_withdrawal_id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Saque não encontrado.'; END IF;

  -- Estorna saldo ao afiliado
  UPDATE public.affiliates
     SET balance          = balance + v_wd.amount,
         total_withdrawn  = GREATEST(0, total_withdrawn - v_wd.amount)
   WHERE id = v_wd.affiliate_id;

  -- Volta status para pending para poder reprocessar
  UPDATE public.affiliate_withdrawals
     SET status      = 'pending',
         orama_id    = NULL,
         orama_status = NULL,
         admin_notes  = '[ROLLBACK DE TESTE]',
         updated_at   = now()
   WHERE id = p_withdrawal_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_rollback_affiliate_withdrawal(uuid) TO authenticated;

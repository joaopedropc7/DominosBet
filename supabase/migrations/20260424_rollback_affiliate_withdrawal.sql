-- TEMPORÁRIO — apenas para testes. Remover após validação.
-- Rollback de saques: volta status para 'pending' e estorna saldo
-- ao jogador ou afiliado, permitindo reprocessar o fluxo.

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

-- ── Rollback de saque de JOGADOR ─────────────────────────────
-- TEMPORÁRIO — remover após validação.

CREATE OR REPLACE FUNCTION public.admin_rollback_player_withdrawal(
  p_withdrawal_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_wd public.withdrawals%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;

  SELECT * INTO v_wd FROM public.withdrawals WHERE id = p_withdrawal_id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Saque não encontrado.'; END IF;

  -- Devolve o valor líquido ao saldo do jogador (net_amount = o que saiu da conta)
  UPDATE public.profiles
     SET balance    = balance + v_wd.net_amount,
         updated_at = now()
   WHERE id = v_wd.user_id;

  -- Registra a devolução no histórico de transações
  INSERT INTO public.wallet_transactions (user_id, title, description, amount, highlight)
  VALUES (
    v_wd.user_id,
    'Estorno de Saque',
    '[ROLLBACK DE TESTE] Saque #' || substring(v_wd.id::text, 1, 8) || ' revertido',
    v_wd.net_amount,
    'cyan'
  );

  -- Volta status para pending para poder reprocessar
  UPDATE public.withdrawals
     SET status      = 'pending',
         orama_id    = NULL,
         e2e_id      = NULL,
         paid_at     = NULL,
         admin_notes = '[ROLLBACK DE TESTE]',
         updated_at  = now()
   WHERE id = p_withdrawal_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_rollback_player_withdrawal(uuid) TO authenticated;

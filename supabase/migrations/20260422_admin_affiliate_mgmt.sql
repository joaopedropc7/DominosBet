-- ============================================================
-- Admin: affiliate management RPCs
-- ============================================================

-- ── 1. Update admin_update_affiliate to accept commission fields ─
-- The original from 20260422_affiliates_registration.sql only handled
-- status / own_code / notes. We extend it with commission params.

CREATE OR REPLACE FUNCTION public.admin_update_affiliate(
  p_affiliate_id          uuid,
  p_status                text        DEFAULT NULL,
  p_own_code              text        DEFAULT NULL,
  p_notes                 text        DEFAULT NULL,
  p_revshare_percent      integer     DEFAULT NULL,
  p_cpa_amount            numeric     DEFAULT NULL,
  p_sub_affiliate_percent integer     DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  UPDATE public.affiliates
     SET status                 = COALESCE(p_status,                 status),
         own_code               = COALESCE(p_own_code,               own_code),
         admin_notes            = COALESCE(p_notes,                  admin_notes),
         revshare_percent       = COALESCE(p_revshare_percent,       revshare_percent),
         cpa_amount             = COALESCE(p_cpa_amount,             cpa_amount),
         sub_affiliate_percent  = COALESCE(p_sub_affiliate_percent,  sub_affiliate_percent)
   WHERE id = p_affiliate_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Afiliado não encontrado.';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_update_affiliate(uuid, text, text, text, integer, numeric, integer) TO authenticated;


-- ── 2. admin_list_withdrawals ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_withdrawals(
  p_status text DEFAULT NULL
)
RETURNS TABLE (
  id               uuid,
  affiliate_name   text,
  affiliate_email  text,
  amount           numeric,
  status           text,
  pix_key_type     text,
  pix_key          text,
  admin_notes      text,
  created_at       timestamptz,
  updated_at       timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  RETURN QUERY
    SELECT
      w.id,
      a.name       AS affiliate_name,
      a.email      AS affiliate_email,
      w.amount,
      w.status,
      w.pix_key_type,
      w.pix_key,
      w.admin_notes,
      w.created_at,
      w.updated_at
    FROM public.affiliate_withdrawals w
    JOIN public.affiliates a ON a.id = w.affiliate_id
    WHERE (p_status IS NULL OR w.status = p_status)
    ORDER BY w.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_withdrawals(text) TO authenticated;


-- ── 3. admin_process_withdrawal ───────────────────────────────
-- Approving a withdrawal marks it paid and updates total_withdrawn.
-- Rejecting returns the balance to the affiliate.

CREATE OR REPLACE FUNCTION public.admin_process_withdrawal(
  p_withdrawal_id uuid,
  p_status        text,
  p_notes         text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.affiliate_withdrawals%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  IF p_status NOT IN ('approved', 'rejected', 'pending') THEN
    RAISE EXCEPTION 'Status inválido: %', p_status;
  END IF;

  SELECT * INTO v_row FROM public.affiliate_withdrawals WHERE id = p_withdrawal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Saque não encontrado.'; END IF;

  -- On approval: record in total_withdrawn
  IF p_status = 'approved' AND v_row.status != 'approved' THEN
    UPDATE public.affiliates
       SET total_withdrawn = total_withdrawn + v_row.amount
     WHERE id = v_row.affiliate_id;
  END IF;

  -- On rejection: refund balance if was previously deducted (was pending)
  IF p_status = 'rejected' AND v_row.status = 'pending' THEN
    UPDATE public.affiliates
       SET balance = balance + v_row.amount
     WHERE id = v_row.affiliate_id;
  END IF;

  UPDATE public.affiliate_withdrawals
     SET status      = p_status,
         admin_notes = COALESCE(p_notes, admin_notes),
         updated_at  = now()
   WHERE id = p_withdrawal_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_process_withdrawal(uuid, text, text) TO authenticated;

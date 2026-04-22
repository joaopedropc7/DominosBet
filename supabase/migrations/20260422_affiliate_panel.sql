-- ============================================================
-- Affiliate Panel — full data model + RPCs
-- ============================================================

-- ── 1. Extra columns on affiliates ───────────────────────────
ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS revshare_percent     integer  NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS cpa_amount           numeric  NOT NULL DEFAULT 5.00,
  ADD COLUMN IF NOT EXISTS sub_affiliate_percent integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS pix_key_type         text,        -- CPF | CNPJ | telefone | email | aleatoria
  ADD COLUMN IF NOT EXISTS pix_key              text,
  ADD COLUMN IF NOT EXISTS balance              numeric  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_earned         numeric  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_withdrawn      numeric  NOT NULL DEFAULT 0;

-- ── 2. affiliate_referrals ───────────────────────────────────
-- Tracks regular users who signed up via an affiliate's own_code
CREATE TABLE IF NOT EXISTS public.affiliate_referrals (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id    uuid        NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  user_id         uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name       text        NOT NULL DEFAULT '',
  user_email      text        NOT NULL DEFAULT '',
  has_deposited   boolean     NOT NULL DEFAULT false,
  deposit_total   numeric     NOT NULL DEFAULT 0,
  cpa_paid        boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS affiliate_referrals_affiliate_idx ON public.affiliate_referrals (affiliate_id);
CREATE INDEX IF NOT EXISTS affiliate_referrals_user_idx      ON public.affiliate_referrals (user_id);

ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referrals_admin_all"  ON public.affiliate_referrals;
CREATE POLICY "referrals_admin_all" ON public.affiliate_referrals
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "referrals_select_own" ON public.affiliate_referrals;
CREATE POLICY "referrals_select_own" ON public.affiliate_referrals
  FOR SELECT USING (
    affiliate_id IN (SELECT id FROM public.affiliates WHERE profile_id = auth.uid())
  );

-- ── 3. affiliate_withdrawals ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.affiliate_withdrawals (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid        NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  amount       numeric     NOT NULL,
  status       text        NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  pix_key_type text        NOT NULL DEFAULT '',
  pix_key      text        NOT NULL DEFAULT '',
  admin_notes  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS affiliate_withdrawals_affiliate_idx ON public.affiliate_withdrawals (affiliate_id);

ALTER TABLE public.affiliate_withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "withdrawals_admin_all"  ON public.affiliate_withdrawals;
CREATE POLICY "withdrawals_admin_all" ON public.affiliate_withdrawals
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "withdrawals_select_own" ON public.affiliate_withdrawals;
CREATE POLICY "withdrawals_select_own" ON public.affiliate_withdrawals
  FOR SELECT USING (
    affiliate_id IN (SELECT id FROM public.affiliates WHERE profile_id = auth.uid())
  );

-- ── 4. RPC: get_my_affiliate_profile ─────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_affiliate_profile()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.affiliates%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.affiliates WHERE profile_id = v_uid LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN row_to_json(v_row)::jsonb;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_affiliate_profile() TO authenticated;

-- ── 5. RPC: get_affiliate_dashboard ──────────────────────────
CREATE OR REPLACE FUNCTION public.get_affiliate_dashboard(
  p_from date DEFAULT NULL,
  p_to   date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_affiliate   public.affiliates%ROWTYPE;
  v_registros   bigint;
  v_ftds        bigint;
  v_commission  numeric;
  v_withdrawals numeric;
BEGIN
  SELECT * INTO v_affiliate FROM public.affiliates WHERE profile_id = v_uid LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil de afiliado não encontrado.'; END IF;

  SELECT COUNT(*) INTO v_registros
    FROM public.affiliate_referrals
   WHERE affiliate_id = v_affiliate.id
     AND (p_from IS NULL OR created_at::date >= p_from)
     AND (p_to   IS NULL OR created_at::date <= p_to);

  SELECT COUNT(*) INTO v_ftds
    FROM public.affiliate_referrals
   WHERE affiliate_id = v_affiliate.id
     AND has_deposited = true
     AND (p_from IS NULL OR created_at::date >= p_from)
     AND (p_to   IS NULL OR created_at::date <= p_to);

  v_commission  := v_affiliate.total_earned;
  v_withdrawals := v_affiliate.total_withdrawn;

  RETURN jsonb_build_object(
    'balance',      v_affiliate.balance,
    'total_earned', v_commission,
    'total_withdrawn', v_withdrawals,
    'registros',    v_registros,
    'ftds',         v_ftds,
    'revshare_percent',      v_affiliate.revshare_percent,
    'cpa_amount',            v_affiliate.cpa_amount,
    'sub_affiliate_percent', v_affiliate.sub_affiliate_percent
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_affiliate_dashboard(date, date) TO authenticated;

-- ── 6. RPC: get_affiliate_registros ──────────────────────────
CREATE OR REPLACE FUNCTION public.get_affiliate_registros(
  p_limit  integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id            uuid,
  user_name     text,
  user_email    text,
  has_deposited boolean,
  deposit_total numeric,
  cpa_paid      boolean,
  created_at    timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_affiliate public.affiliates%ROWTYPE;
BEGIN
  SELECT * INTO v_affiliate FROM public.affiliates WHERE profile_id = v_uid LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil de afiliado não encontrado.'; END IF;

  RETURN QUERY
    SELECT r.id, r.user_name, r.user_email, r.has_deposited, r.deposit_total, r.cpa_paid, r.created_at
      FROM public.affiliate_referrals r
     WHERE r.affiliate_id = v_affiliate.id
     ORDER BY r.created_at DESC
     LIMIT p_limit OFFSET p_offset;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_affiliate_registros(integer, integer) TO authenticated;

-- ── 7. RPC: get_affiliate_sub_affiliates ─────────────────────
CREATE OR REPLACE FUNCTION public.get_affiliate_sub_affiliates()
RETURNS TABLE (
  id         uuid,
  name       text,
  email      text,
  status     text,
  own_code   text,
  created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_affiliate public.affiliates%ROWTYPE;
BEGIN
  SELECT * INTO v_affiliate FROM public.affiliates WHERE profile_id = v_uid LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil de afiliado não encontrado.'; END IF;

  RETURN QUERY
    SELECT a.id, a.name, a.email, a.status, a.own_code, a.created_at
      FROM public.affiliates a
     WHERE a.referral_code = v_affiliate.own_code
     ORDER BY a.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_affiliate_sub_affiliates() TO authenticated;

-- ── 8. RPC: get_affiliate_withdrawals ────────────────────────
CREATE OR REPLACE FUNCTION public.get_affiliate_withdrawals()
RETURNS TABLE (
  id           uuid,
  amount       numeric,
  status       text,
  pix_key      text,
  pix_key_type text,
  admin_notes  text,
  created_at   timestamptz,
  updated_at   timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_affiliate public.affiliates%ROWTYPE;
BEGIN
  SELECT * INTO v_affiliate FROM public.affiliates WHERE profile_id = v_uid LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil de afiliado não encontrado.'; END IF;

  RETURN QUERY
    SELECT w.id, w.amount, w.status, w.pix_key, w.pix_key_type, w.admin_notes, w.created_at, w.updated_at
      FROM public.affiliate_withdrawals w
     WHERE w.affiliate_id = v_affiliate.id
     ORDER BY w.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_affiliate_withdrawals() TO authenticated;

-- ── 9. RPC: request_affiliate_withdrawal ─────────────────────
CREATE OR REPLACE FUNCTION public.request_affiliate_withdrawal(p_amount numeric)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_affiliate public.affiliates%ROWTYPE;
BEGIN
  SELECT * INTO v_affiliate FROM public.affiliates WHERE profile_id = v_uid LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil de afiliado não encontrado.'; END IF;
  IF v_affiliate.status != 'approved' THEN RAISE EXCEPTION 'Afiliado não aprovado.'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Valor inválido.'; END IF;
  IF p_amount > v_affiliate.balance THEN RAISE EXCEPTION 'Saldo insuficiente.'; END IF;
  IF v_affiliate.pix_key IS NULL THEN RAISE EXCEPTION 'Cadastre uma chave PIX antes de sacar.'; END IF;

  UPDATE public.affiliates
     SET balance = balance - p_amount
   WHERE id = v_affiliate.id;

  INSERT INTO public.affiliate_withdrawals (affiliate_id, amount, pix_key_type, pix_key)
  VALUES (v_affiliate.id, p_amount, coalesce(v_affiliate.pix_key_type,''), coalesce(v_affiliate.pix_key,''));
END;
$$;
GRANT EXECUTE ON FUNCTION public.request_affiliate_withdrawal(numeric) TO authenticated;

-- ── 10. RPC: update_affiliate_pix ────────────────────────────
CREATE OR REPLACE FUNCTION public.update_affiliate_pix(
  p_pix_key_type text,
  p_pix_key      text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.affiliates
     SET pix_key_type = trim(p_pix_key_type),
         pix_key      = trim(p_pix_key)
   WHERE profile_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil de afiliado não encontrado.'; END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_affiliate_pix(text, text) TO authenticated;

-- ── 11. RPC: update_affiliate_own_code ───────────────────────
CREATE OR REPLACE FUNCTION public.update_affiliate_own_code(p_code text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_clean text := upper(trim(p_code));
BEGIN
  IF length(v_clean) < 3 THEN RAISE EXCEPTION 'Código deve ter pelo menos 3 caracteres.'; END IF;
  IF v_clean !~ '^[A-Z0-9_-]+$' THEN RAISE EXCEPTION 'Use apenas letras, números, - e _.'; END IF;
  IF EXISTS (SELECT 1 FROM public.affiliates WHERE own_code = v_clean AND profile_id != auth.uid()) THEN
    RAISE EXCEPTION 'Código já em uso por outro afiliado.';
  END IF;
  UPDATE public.affiliates SET own_code = v_clean WHERE profile_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil de afiliado não encontrado.'; END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_affiliate_own_code(text) TO authenticated;

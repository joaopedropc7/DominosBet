-- ============================================================
-- Affiliate self-registration
--
-- Adds an `affiliates` table where potential affiliates
-- submit their details (name, CPF, phone, referral code).
-- Status starts as 'pending' until an admin approves.
-- ============================================================

-- ── 1. Tabela affiliates ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.affiliates (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  name           text        NOT NULL,
  email          text        NOT NULL UNIQUE,
  phone          text        NOT NULL,
  cpf            text        NOT NULL UNIQUE,
  referral_code  text,                          -- código de quem indicou (opcional)
  status         text        NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  own_code       text        UNIQUE,            -- código próprio após aprovação
  admin_notes    text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS affiliates_email_idx  ON public.affiliates (email);
CREATE INDEX IF NOT EXISTS affiliates_cpf_idx    ON public.affiliates (cpf);
CREATE INDEX IF NOT EXISTS affiliates_status_idx ON public.affiliates (status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION touch_affiliates()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS affiliates_updated_at ON public.affiliates;
CREATE TRIGGER affiliates_updated_at
  BEFORE UPDATE ON public.affiliates
  FOR EACH ROW EXECUTE FUNCTION touch_affiliates();

-- ── 2. RLS ───────────────────────────────────────────────────
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

-- Admins veem tudo
DROP POLICY IF EXISTS "affiliates_admin_all" ON public.affiliates;
CREATE POLICY "affiliates_admin_all" ON public.affiliates
  FOR ALL USING (public.is_admin());

-- O próprio afiliado vê o seu registro
DROP POLICY IF EXISTS "affiliates_select_own" ON public.affiliates;
CREATE POLICY "affiliates_select_own" ON public.affiliates
  FOR SELECT USING (profile_id = auth.uid());

-- ── 3. RPC: register_affiliate ───────────────────────────────
-- Chamado logo após o auth.signUp() do cliente.
-- Salva os dados extras do afiliado e marca o perfil.
CREATE OR REPLACE FUNCTION public.register_affiliate(
  p_name          text,
  p_phone         text,
  p_cpf           text,
  p_referral_code text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_email text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  -- CPF já cadastrado?
  IF EXISTS (SELECT 1 FROM public.affiliates WHERE cpf = trim(p_cpf)) THEN
    RAISE EXCEPTION 'CPF já cadastrado como afiliado.';
  END IF;

  -- Buscar e-mail do auth.users (disponível via service role no SECURITY DEFINER)
  SELECT email INTO v_email
    FROM auth.users
   WHERE id = v_uid;

  -- Atualizar nome no perfil (caso o trigger tenha usado um valor padrão)
  UPDATE public.profiles
     SET display_name = trim(p_name)
   WHERE id = v_uid;

  -- Inserir registro de afiliado
  INSERT INTO public.affiliates (profile_id, name, email, phone, cpf, referral_code)
  VALUES (v_uid, trim(p_name), coalesce(v_email, ''), trim(p_phone), trim(p_cpf), nullif(trim(p_referral_code), ''));
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_affiliate(text, text, text, text) TO authenticated;


-- ── 4. RPC: admin_list_affiliates ────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_affiliates(
  p_status text DEFAULT NULL   -- NULL = todos
)
RETURNS TABLE (
  id            uuid,
  name          text,
  email         text,
  phone         text,
  cpf           text,
  referral_code text,
  status        text,
  own_code      text,
  admin_notes   text,
  created_at    timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  RETURN QUERY
    SELECT a.id, a.name, a.email, a.phone, a.cpf,
           a.referral_code, a.status, a.own_code, a.admin_notes, a.created_at
      FROM public.affiliates a
     WHERE p_status IS NULL OR a.status = p_status
     ORDER BY a.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_affiliates(text) TO authenticated;


-- ── 5. RPC: admin_update_affiliate ───────────────────────────
CREATE OR REPLACE FUNCTION public.admin_update_affiliate(
  p_affiliate_id uuid,
  p_status       text,           -- pending | approved | rejected
  p_own_code     text DEFAULT NULL,
  p_notes        text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  UPDATE public.affiliates
     SET status      = p_status,
         own_code    = COALESCE(nullif(trim(p_own_code), ''), own_code),
         admin_notes = COALESCE(p_notes, admin_notes)
   WHERE id = p_affiliate_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Afiliado não encontrado.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_affiliate(uuid, text, text, text) TO authenticated;

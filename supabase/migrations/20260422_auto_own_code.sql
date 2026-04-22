-- ============================================================
-- Auto-generate own_code on affiliate registration
-- + backfill existing affiliates that have no code
-- ============================================================

-- ── Helper: generates a unique 8-char alphanumeric code ──────
CREATE OR REPLACE FUNCTION public.generate_affiliate_code()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code    text;
  v_chars   text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no I/O/0/1 (confusing)
  v_len     int  := 8;
  v_i       int;
BEGIN
  LOOP
    v_code := '';
    FOR v_i IN 1..v_len LOOP
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.affiliates WHERE own_code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$;

-- ── Update register_affiliate to auto-assign own_code ────────
CREATE OR REPLACE FUNCTION public.register_affiliate(
  p_name          text,
  p_phone         text,
  p_cpf           text,
  p_referral_code text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_email    text;
  v_own_code text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.affiliates WHERE cpf = trim(p_cpf)) THEN
    RAISE EXCEPTION 'CPF já cadastrado como afiliado.';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  UPDATE public.profiles SET display_name = trim(p_name) WHERE id = v_uid;

  -- Auto-generate a unique referral code
  v_own_code := public.generate_affiliate_code();

  INSERT INTO public.affiliates (profile_id, name, email, phone, cpf, referral_code, own_code)
  VALUES (
    v_uid,
    trim(p_name),
    coalesce(v_email, ''),
    trim(p_phone),
    trim(p_cpf),
    nullif(trim(coalesce(p_referral_code, '')), ''),
    v_own_code
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.register_affiliate(text, text, text, text) TO authenticated;

-- ── Backfill: give a code to every affiliate that lacks one ──
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.affiliates WHERE own_code IS NULL LOOP
    UPDATE public.affiliates
       SET own_code = public.generate_affiliate_code()
     WHERE id = r.id;
  END LOOP;
END;
$$;

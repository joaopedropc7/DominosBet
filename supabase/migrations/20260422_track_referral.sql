-- ============================================================
-- Player referral tracking + disable email confirmation
-- ============================================================

-- ── RPC: track_player_referral ───────────────────────────────
-- Called client-side right after supabase.auth.signUp() succeeds
-- (only when the user arrived via an affiliate ?ref=CODE link).
-- Finds the affiliate by own_code and inserts an affiliate_referrals row
-- for the newly authenticated user. Safe to call multiple times — uses
-- INSERT ... ON CONFLICT DO NOTHING.

CREATE OR REPLACE FUNCTION public.track_player_referral(p_referral_code text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_affiliate   public.affiliates%ROWTYPE;
  v_name        text;
  v_email       text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  -- Find the affiliate that owns this code
  SELECT * INTO v_affiliate
    FROM public.affiliates
   WHERE own_code = upper(trim(p_referral_code))
     AND status = 'approved'
   LIMIT 1;

  IF NOT FOUND THEN
    -- Silently ignore unknown / unapproved codes so signup still succeeds
    RETURN;
  END IF;

  -- Do not create a referral if this user is the affiliate themselves
  IF v_affiliate.profile_id = v_uid THEN
    RETURN;
  END IF;

  -- Fetch name and email from profiles (created by auth trigger)
  SELECT display_name, email
    INTO v_name, v_email
    FROM public.profiles
   WHERE id = v_uid
   LIMIT 1;

  INSERT INTO public.affiliate_referrals
    (affiliate_id, user_id, user_name, user_email)
  VALUES
    (v_affiliate.id, v_uid, coalesce(v_name, ''), coalesce(v_email, ''))
  ON CONFLICT DO NOTHING;
END;
$$;
GRANT EXECUTE ON FUNCTION public.track_player_referral(text) TO authenticated;

-- ── Unique constraint to prevent duplicate referral entries ──
ALTER TABLE public.affiliate_referrals
  DROP CONSTRAINT IF EXISTS affiliate_referrals_unique_user,
  ADD  CONSTRAINT affiliate_referrals_unique_user
       UNIQUE (affiliate_id, user_id);

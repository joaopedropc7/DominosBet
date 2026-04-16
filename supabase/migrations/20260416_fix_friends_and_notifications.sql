-- ============================================================
-- Fix: Friends + Notifications (safe to re-run)
-- Run this once in the Supabase SQL Editor.
-- Creates/fixes all required functions with correct GRANTs.
-- ============================================================

-- ── 1. list_notifications ──────────────────────────────────
-- Returns unread notifications for the current user.
-- SECURITY DEFINER bypasses RLS edge cases.

CREATE OR REPLACE FUNCTION public.list_notifications()
RETURNS TABLE (
  id         uuid,
  user_id    uuid,
  type       text,
  payload    jsonb,
  read       boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, user_id, type, payload, read, created_at
  FROM   public.notifications
  WHERE  user_id = auth.uid()
    AND  read    = false
  ORDER  BY created_at DESC
  LIMIT  50;
$$;

GRANT EXECUTE ON FUNCTION public.list_notifications() TO authenticated;

-- ── 2. mark_notifications_read ─────────────────────────────

CREATE OR REPLACE FUNCTION public.mark_notifications_read(
  p_ids uuid[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_ids IS NULL THEN
    UPDATE public.notifications
    SET    read = true
    WHERE  user_id = auth.uid() AND read = false;
  ELSE
    UPDATE public.notifications
    SET    read = true
    WHERE  id = ANY(p_ids) AND user_id = auth.uid();
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_notifications_read(uuid[]) TO authenticated;

-- ── 3. send_friend_request ─────────────────────────────────
-- Creates friendship + sends notification atomically.

CREATE OR REPLACE FUNCTION public.send_friend_request(p_addressee_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       uuid := auth.uid();
  v_friendship_id uuid;
  v_sender_name   text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF v_user_id = p_addressee_id THEN RAISE EXCEPTION 'Você não pode adicionar a si mesmo.'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.friendships
    WHERE (requester_id = v_user_id AND addressee_id = p_addressee_id)
       OR (requester_id = p_addressee_id AND addressee_id = v_user_id)
  ) THEN
    RAISE EXCEPTION 'Solicitação já enviada.';
  END IF;

  INSERT INTO public.friendships (requester_id, addressee_id, status)
  VALUES (v_user_id, p_addressee_id, 'pending')
  RETURNING id INTO v_friendship_id;

  SELECT display_name INTO v_sender_name FROM public.profiles WHERE id = v_user_id;

  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (
    p_addressee_id,
    'friend_request',
    json_build_object(
      'requester_id',   v_user_id::text,
      'requester_name', v_sender_name,
      'friendship_id',  v_friendship_id::text
    )
  );

  RETURN v_friendship_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid) TO authenticated;

-- ── 4. accept_friend_request ───────────────────────────────
-- Accepts friendship and sends friend_accepted notification
-- to BOTH users. Safe to call multiple times (idempotent).

CREATE OR REPLACE FUNCTION public.accept_friend_request(p_friendship_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        uuid := auth.uid();
  v_requester_id   uuid;
  v_acceptor_name  text;
  v_requester_name text;
BEGIN
  IF v_user_id IS NULL THEN RETURN; END IF;

  UPDATE public.friendships
  SET    status = 'accepted'
  WHERE  id           = p_friendship_id
    AND  addressee_id = v_user_id
    AND  status       = 'pending'
  RETURNING requester_id INTO v_requester_id;

  -- Already accepted or not found — nothing to do
  IF v_requester_id IS NULL THEN RETURN; END IF;

  -- Mark the friend_request notification as read for the acceptor
  UPDATE public.notifications
  SET    read = true
  WHERE  user_id = v_user_id
    AND  type    = 'friend_request'
    AND  (payload->>'friendship_id')::uuid = p_friendship_id;

  SELECT display_name INTO v_acceptor_name  FROM public.profiles WHERE id = v_user_id;
  SELECT display_name INTO v_requester_name FROM public.profiles WHERE id = v_requester_id;

  -- Notify the person who sent the original request
  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (
    v_requester_id,
    'friend_accepted',
    json_build_object('friend_id', v_user_id::text, 'friend_name', v_acceptor_name)
  );

  -- Notify the acceptor too (confirmation on their end)
  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (
    v_user_id,
    'friend_accepted',
    json_build_object('friend_id', v_requester_id::text, 'friend_name', v_requester_name)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_friend_request(uuid) TO authenticated;

-- ── 5. find_profile_by_nickname ────────────────────────────

CREATE OR REPLACE FUNCTION public.find_profile_by_nickname(nickname text)
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles
  WHERE  lower(display_name) = lower(trim(nickname))
    AND  id <> auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.find_profile_by_nickname(text) TO authenticated;

-- ── 6. Ensure notifications RLS policies exist ─────────────

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'Users read own notifications'
  ) THEN
    CREATE POLICY "Users read own notifications"
      ON public.notifications FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'Users update own notifications'
  ) THEN
    CREATE POLICY "Users update own notifications"
      ON public.notifications FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'Authenticated insert notifications'
  ) THEN
    CREATE POLICY "Authenticated insert notifications"
      ON public.notifications FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- ── 7. profiles must be readable by other authenticated users ──
-- (needed for friend search and friend list joins)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'profiles_select_any_authenticated'
  ) THEN
    CREATE POLICY "profiles_select_any_authenticated"
      ON public.profiles FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

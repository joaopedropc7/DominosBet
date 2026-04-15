-- ============================================================
-- Migration: notifications table + send_room_invite RPC
-- Run in Supabase SQL editor
-- ============================================================

-- 1. Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type       text        NOT NULL,          -- 'room_invite'
  payload    jsonb       NOT NULL DEFAULT '{}',
  read       boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx    ON public.notifications(user_id, read) WHERE read = false;

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Authenticated users can insert notifications (to invite friends)
CREATE POLICY "Authenticated insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 2. RPC: send_room_invite — sends a room invite notification to a friend
CREATE OR REPLACE FUNCTION public.send_room_invite(
  p_friend_id  uuid,
  p_room_id    uuid,
  p_invite_code text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_sender_id   uuid := auth.uid();
  v_sender_name text;
  v_friendship  record;
  v_room        public.match_rooms%ROWTYPE;
BEGIN
  IF v_sender_id IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;

  -- Verify friendship exists and is accepted
  SELECT * INTO v_friendship
  FROM public.friendships
  WHERE status = 'accepted'
    AND (
      (requester_id = v_sender_id AND addressee_id = p_friend_id) OR
      (requester_id = p_friend_id AND addressee_id = v_sender_id)
    );
  IF NOT FOUND THEN RAISE EXCEPTION 'Vocês não são amigos.'; END IF;

  -- Verify room exists and is waiting
  SELECT * INTO v_room FROM public.match_rooms WHERE id = p_room_id AND player1_id = v_sender_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sala não encontrada.'; END IF;
  IF v_room.status <> 'waiting' THEN RAISE EXCEPTION 'Sala não está mais disponível.'; END IF;

  -- Get sender name
  SELECT display_name INTO v_sender_name FROM public.profiles WHERE id = v_sender_id;

  -- Insert notification (upsert to avoid spamming duplicate invites)
  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (
    p_friend_id,
    'room_invite',
    json_build_object(
      'sender_id',    v_sender_id,
      'sender_name',  v_sender_name,
      'room_id',      p_room_id,
      'invite_code',  p_invite_code,
      'entry_fee',    v_room.entry_fee,
      'room_name',    v_room.room_name,
      'mode',         v_room.mode
    )
  )
  ON CONFLICT DO NOTHING;
END;
$$;

-- 3. RPC: mark_notifications_read — mark all (or specific) notifications as read
CREATE OR REPLACE FUNCTION public.mark_notifications_read(
  p_ids uuid[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF p_ids IS NULL THEN
    UPDATE public.notifications SET read = true WHERE user_id = auth.uid() AND read = false;
  ELSE
    UPDATE public.notifications SET read = true WHERE id = ANY(p_ids) AND user_id = auth.uid();
  END IF;
END;
$$;

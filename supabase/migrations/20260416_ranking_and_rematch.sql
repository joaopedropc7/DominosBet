-- ============================================================
-- 1. Leaderboard RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_leaderboard(p_limit int DEFAULT 50)
RETURNS TABLE (
  rank_pos      bigint,
  id            uuid,
  display_name  text,
  avatar_id     text,
  rank_label    text,
  matches_count int,
  win_rate      numeric,
  balance       int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ROW_NUMBER() OVER (ORDER BY win_rate DESC, matches_count DESC) AS rank_pos,
    id,
    display_name,
    avatar_id,
    rank_label,
    matches_count,
    win_rate,
    balance
  FROM public.profiles
  WHERE matches_count >= 1
    AND is_banned = false
  ORDER BY win_rate DESC, matches_count DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard(int) TO authenticated;

-- ============================================================
-- 2. Rematch invite RPC (no friendship check required)
-- ============================================================

CREATE OR REPLACE FUNCTION public.send_rematch_invite(
  p_opponent_id uuid,
  p_room_id     uuid,
  p_invite_code text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id   uuid := auth.uid();
  v_sender_name text;
  v_room        public.match_rooms%ROWTYPE;
BEGIN
  IF v_sender_id IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;

  SELECT * INTO v_room FROM public.match_rooms WHERE id = p_room_id AND player1_id = v_sender_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sala não encontrada.'; END IF;

  SELECT display_name INTO v_sender_name FROM public.profiles WHERE id = v_sender_id;

  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (
    p_opponent_id,
    'room_invite',
    json_build_object(
      'sender_id',   v_sender_id::text,
      'sender_name', v_sender_name,
      'room_id',     p_room_id::text,
      'invite_code', p_invite_code,
      'entry_fee',   v_room.entry_fee,
      'room_name',   COALESCE(v_room.room_name, 'Revanche'),
      'mode',        v_room.mode
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_rematch_invite(uuid, uuid, text) TO authenticated;

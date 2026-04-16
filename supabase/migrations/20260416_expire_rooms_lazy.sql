-- ============================================================
-- Lazy expiration: hide rooms older than 30 min from the lobby
-- No pg_cron required — rooms simply stop appearing after 30 min.
-- Also cancels them in the same query so status stays consistent.
-- ============================================================

-- Step 1: cancel stale rooms inline before listing
CREATE OR REPLACE FUNCTION public.list_available_rooms()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  -- Expire stale rooms opportunistically on every list call
  UPDATE public.match_rooms
  SET status = 'cancelled'
  WHERE status = 'waiting'
    AND created_at < NOW() - INTERVAL '30 minutes';

  RETURN (
    SELECT json_agg(row_to_json(r))
    FROM (
      SELECT
        m.id            AS room_id,
        m.room_name,
        m.entry_fee,
        m.invite_code,
        m.mode,
        (m.room_password IS NOT NULL) AS has_password,
        m.created_at,
        p.display_name  AS creator_name,
        p.avatar_id     AS creator_avatar_id
      FROM public.match_rooms m
      JOIN public.profiles p ON p.id = m.player1_id
      WHERE m.status     = 'waiting'
        AND m.is_private = true
        AND m.player1_id <> v_user_id
      ORDER BY m.created_at DESC
      LIMIT 50
    ) r
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_available_rooms() TO authenticated;

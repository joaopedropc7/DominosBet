-- ============================================================
-- Migration: list_available_rooms RPC
-- Returns all waiting private rooms (excluding the current user's own)
-- with safe fields only (no password exposed)
-- ============================================================

CREATE OR REPLACE FUNCTION public.list_available_rooms()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
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

-- Ensure cancel_private_room exists and is callable by authenticated users.
-- Safe to re-run.

CREATE OR REPLACE FUNCTION public.cancel_private_room(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM match_rooms
   WHERE id         = p_room_id
     AND player1_id = auth.uid()
     AND status     = 'waiting'
     AND is_private = true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_private_room(uuid) TO authenticated;

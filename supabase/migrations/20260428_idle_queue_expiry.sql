-- ============================================================
-- Idle queue expiry
-- Tightens stale-room TTL: pending rooms with no opponent
-- after 3 minutes are automatically cancelled.
-- Also adds a ping mechanism so clients can heartbeat while
-- in the queue, preventing false positives on slow connections.
-- ============================================================

-- 1. Add last_ping_at to match_rooms (used by heartbeat)
ALTER TABLE public.match_rooms
  ADD COLUMN IF NOT EXISTS last_ping_at timestamptz DEFAULT now();

-- 2. RPC: ping_matchmaking_queue — called every ~30 s by the client
--    Refreshes last_ping_at so the room is not expired prematurely.
CREATE OR REPLACE FUNCTION public.ping_matchmaking_queue(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.match_rooms
     SET last_ping_at = now()
   WHERE id = p_room_id
     AND player1_id = auth.uid()
     AND status = 'waiting';
END;
$$;
GRANT EXECUTE ON FUNCTION public.ping_matchmaking_queue(uuid) TO authenticated;

-- 3. Update expire_stale_rooms to use last_ping_at with a 3-minute window
--    (was: created_at < NOW() - 30 minutes, which was too lenient)
CREATE OR REPLACE FUNCTION public.expire_stale_rooms()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.match_rooms
     SET status = 'cancelled'
   WHERE status = 'waiting'
     AND COALESCE(last_ping_at, created_at) < NOW() - INTERVAL '3 minutes';
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_stale_rooms() TO postgres;

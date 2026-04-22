-- ============================================================
-- Fix stale / stuck matches in production
--
-- Changes:
--  1. join_matchmaking: auto-expire playing rooms with no
--     activity for > 30 minutes, then return 'reconnecting'
--     flag when the user still has a recent active room.
--  2. New RPC abandon_and_rematch: lets the client abandon the
--     stuck room and immediately create / join a new one.
-- ============================================================

-- ── 1. Rewrite join_matchmaking ──────────────────────────────
CREATE OR REPLACE FUNCTION join_matchmaking(
  p_mode       text  DEFAULT 'classic',
  p_entry_fee  int   DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid            uuid := auth.uid();
  v_room_id        uuid;
  v_role           text;
  v_existing       uuid;
  v_existing_status text;
BEGIN
  -- Step 1: silently expire any PLAYING room for this user
  -- that has had no activity for more than 30 minutes.
  -- These are matches that crashed / both players disconnected.
  UPDATE match_rooms
     SET status = 'finished'
   WHERE (player1_id = v_uid OR player2_id = v_uid)
     AND status = 'playing'
     AND updated_at < NOW() - INTERVAL '30 minutes';

  -- Step 2: is there still an active room (waiting OR recent playing)?
  SELECT id, status
    INTO v_existing, v_existing_status
    FROM match_rooms
   WHERE (player1_id = v_uid OR player2_id = v_uid)
     AND status IN ('waiting', 'playing')
     AND mode       = p_mode
     AND entry_fee  = p_entry_fee
   ORDER BY created_at DESC
   LIMIT 1;

  IF FOUND THEN
    SELECT CASE WHEN player1_id = v_uid THEN 'p1' ELSE 'p2' END
      INTO v_role
      FROM match_rooms WHERE id = v_existing;

    -- Return existing room with 'reconnecting' flag so the
    -- client can show a "reconnect or start fresh" screen.
    RETURN jsonb_build_object(
      'room_id',      v_existing,
      'role',         v_role,
      'reconnecting', (v_existing_status = 'playing')
    );
  END IF;

  -- Step 3: look for a waiting room from someone else
  SELECT id INTO v_room_id
    FROM match_rooms
   WHERE status      = 'waiting'
     AND mode        = p_mode
     AND entry_fee   = p_entry_fee
     AND player2_id  IS NULL
     AND player1_id  != v_uid
   ORDER BY created_at ASC
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  IF FOUND THEN
    UPDATE match_rooms
       SET player2_id = v_uid,
           status     = 'playing'
     WHERE id = v_room_id;
    RETURN jsonb_build_object('room_id', v_room_id, 'role', 'p2', 'reconnecting', false);
  END IF;

  -- Step 4: create a new waiting room
  INSERT INTO match_rooms (player1_id, mode, entry_fee)
  VALUES (v_uid, p_mode, p_entry_fee)
  RETURNING id INTO v_room_id;

  RETURN jsonb_build_object('room_id', v_room_id, 'role', 'p1', 'reconnecting', false);
END;
$$;

GRANT EXECUTE ON FUNCTION join_matchmaking(text, int) TO authenticated;


-- ── 2. New RPC: abandon_and_rematch ─────────────────────────
-- Abandons the caller's existing active room (they forfeit)
-- then immediately runs the normal join_matchmaking logic so
-- the response is a fresh room_id ready to use.
CREATE OR REPLACE FUNCTION abandon_and_rematch(
  p_room_id    uuid,
  p_mode       text DEFAULT 'classic',
  p_entry_fee  int  DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_winner uuid;
BEGIN
  -- Mark old room as finished; the opponent wins (forfeit).
  -- If both players are gone the winner_id may be null — that is fine,
  -- resolve_online_match is not called so no coins move.
  SELECT CASE
           WHEN player1_id = v_uid THEN player2_id
           ELSE player1_id
         END
    INTO v_winner
    FROM match_rooms
   WHERE id = p_room_id
     AND (player1_id = v_uid OR player2_id = v_uid)
     AND status IN ('waiting', 'playing');

  IF FOUND THEN
    UPDATE match_rooms
       SET status    = 'finished',
           winner_id = v_winner
     WHERE id = p_room_id;
  END IF;

  -- Now join matchmaking fresh (uses the rewritten function above)
  RETURN join_matchmaking(p_mode, p_entry_fee);
END;
$$;

GRANT EXECUTE ON FUNCTION abandon_and_rematch(uuid, text, int) TO authenticated;

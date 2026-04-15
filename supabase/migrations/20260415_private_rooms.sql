-- ============================================================
-- Private rooms: invite code, password, name, is_private
-- ============================================================

-- 1. New columns on match_rooms
-- -------------------------------------------------------
ALTER TABLE match_rooms
  ADD COLUMN IF NOT EXISTS invite_code   text,
  ADD COLUMN IF NOT EXISTS room_password text,
  ADD COLUMN IF NOT EXISTS room_name     text,
  ADD COLUMN IF NOT EXISTS is_private    boolean NOT NULL DEFAULT false;

-- Unique index on invite_code (nulls allowed for public rooms)
CREATE UNIQUE INDEX IF NOT EXISTS match_rooms_invite_code_unique
  ON match_rooms (invite_code) WHERE invite_code IS NOT NULL;

-- 2. Helper: generate a short alphanumeric invite code
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  chars    text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result   text := '';
  i        int;
  attempts int  := 0;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM match_rooms WHERE invite_code = result);
    attempts := attempts + 1;
    IF attempts > 20 THEN RAISE EXCEPTION 'Could not generate unique invite code'; END IF;
  END LOOP;
  RETURN result;
END;
$$;

-- 3. RPC: create a private room
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION create_private_room(
  p_entry_fee  int,
  p_password   text DEFAULT NULL,
  p_room_name  text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_balance int;
  v_room_id uuid;
  v_code    text;
BEGIN
  SELECT balance INTO v_balance FROM profiles WHERE id = v_uid;
  IF v_balance < p_entry_fee THEN
    RAISE EXCEPTION 'Saldo insuficiente.';
  END IF;

  v_code := generate_invite_code();

  INSERT INTO match_rooms (player1_id, mode, entry_fee, is_private, invite_code, room_password, room_name)
  VALUES (v_uid, 'classic', p_entry_fee, true, v_code, p_password, p_room_name)
  RETURNING id INTO v_room_id;

  RETURN jsonb_build_object('room_id', v_room_id, 'invite_code', v_code);
END;
$$;

-- 4. RPC: preview room info before joining (safe — no password exposed)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION preview_private_room(p_invite_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_room match_rooms%ROWTYPE;
BEGIN
  SELECT * INTO v_room FROM match_rooms WHERE invite_code = upper(trim(p_invite_code));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sala não encontrada.';
  END IF;

  IF v_room.status != 'waiting' THEN
    RAISE EXCEPTION 'Esta sala não está mais disponível.';
  END IF;

  RETURN jsonb_build_object(
    'room_id',      v_room.id,
    'room_name',    v_room.room_name,
    'entry_fee',    v_room.entry_fee,
    'has_password', v_room.room_password IS NOT NULL,
    'status',       v_room.status
  );
END;
$$;

-- 5. RPC: join a private room by invite code
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION join_private_room(
  p_invite_code text,
  p_password    text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_balance int;
  v_room    match_rooms%ROWTYPE;
BEGIN
  SELECT * INTO v_room
    FROM match_rooms
   WHERE invite_code = upper(trim(p_invite_code))
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sala não encontrada.';
  END IF;

  IF v_room.status != 'waiting' THEN
    RAISE EXCEPTION 'Esta sala não está mais disponível.';
  END IF;

  IF v_room.player1_id = v_uid THEN
    RAISE EXCEPTION 'Você é o criador desta sala.';
  END IF;

  IF v_room.room_password IS NOT NULL AND v_room.room_password IS DISTINCT FROM p_password THEN
    RAISE EXCEPTION 'Senha incorreta.';
  END IF;

  SELECT balance INTO v_balance FROM profiles WHERE id = v_uid;
  IF v_balance < v_room.entry_fee THEN
    RAISE EXCEPTION 'Saldo insuficiente para entrar nesta sala.';
  END IF;

  UPDATE match_rooms
     SET player2_id = v_uid,
         status     = 'playing'
   WHERE id = v_room.id;

  RETURN jsonb_build_object('room_id', v_room.id, 'role', 'p2');
END;
$$;

-- 6. RPC: list the current user's own waiting private rooms
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION get_my_active_rooms()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  RETURN COALESCE(
    (SELECT jsonb_agg(
       jsonb_build_object(
         'room_id',      id,
         'room_name',    room_name,
         'entry_fee',    entry_fee,
         'invite_code',  invite_code,
         'has_password', room_password IS NOT NULL,
         'created_at',   created_at
       ) ORDER BY created_at DESC
     )
     FROM match_rooms
     WHERE player1_id = v_uid
       AND status     = 'waiting'
       AND is_private = true),
    '[]'::jsonb
  );
END;
$$;

-- 7. RPC: cancel (delete) a waiting private room created by me
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION cancel_private_room(p_room_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM match_rooms
   WHERE id         = p_room_id
     AND player1_id = auth.uid()
     AND status     = 'waiting'
     AND is_private = true;
END;
$$;

-- ============================================================
-- Migration: private room mode selector + match history is_private
--            + auto-expiration cron job
-- Run in Supabase SQL editor
-- ============================================================

-- 1. Update create_private_room RPC to accept p_mode parameter
-- Drop old signature (without p_mode) to avoid overload conflicts
DROP FUNCTION IF EXISTS public.create_private_room(integer, text, text);

CREATE OR REPLACE FUNCTION public.create_private_room(
  p_entry_fee  integer,
  p_mode       text    DEFAULT 'classic',
  p_password   text    DEFAULT NULL,
  p_room_name  text    DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_balance   integer;
  v_room_id   uuid;
  v_code      text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  -- Check balance
  SELECT balance INTO v_balance FROM public.profiles WHERE id = v_user_id;
  IF v_balance IS NULL OR v_balance < p_entry_fee THEN
    RAISE EXCEPTION 'Saldo insuficiente.';
  END IF;

  -- Generate unique invite code
  v_code := public.generate_invite_code();

  -- Create the room
  INSERT INTO public.match_rooms (
    player1_id, status, mode, entry_fee, pot,
    invite_code, room_password, room_name, is_private
  ) VALUES (
    v_user_id, 'waiting', p_mode, p_entry_fee, 0,
    v_code,
    CASE WHEN p_password IS NOT NULL AND length(trim(p_password)) >= 4
         THEN trim(p_password) ELSE NULL END,
    NULLIF(trim(p_room_name), ''),
    TRUE
  )
  RETURNING id INTO v_room_id;

  RETURN json_build_object('room_id', v_room_id, 'invite_code', v_code);
END;
$$;

-- 2. Add is_private column to match_history (tracks if a match was played in a private room)
ALTER TABLE public.match_history
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

-- 3. Update resolve_online_match to auto-detect and record is_private
DROP FUNCTION IF EXISTS public.resolve_online_match(uuid, uuid, integer, integer, integer);

CREATE OR REPLACE FUNCTION public.resolve_online_match(
  room_id           uuid,
  winner_id         uuid,
  duration_seconds  integer,
  p1_pips           integer,
  p2_pips           integer
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_room           public.match_rooms%ROWTYPE;
  v_winner_profile public.profiles%ROWTYPE;
  v_loser_profile  public.profiles%ROWTYPE;
  v_winner_id      uuid := winner_id;
  v_loser_id       uuid;
  v_pot            integer;
  v_winner_reward  integer;
  v_loser_penalty  integer;
  v_is_private     boolean;
BEGIN
  SELECT * INTO v_room FROM public.match_rooms WHERE id = room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sala não encontrada.'; END IF;
  IF v_room.status = 'finished' THEN RETURN json_build_object('winner_reward', 0, 'loser_reward', 0); END IF;

  v_is_private := COALESCE(v_room.is_private, FALSE);
  v_pot        := v_room.entry_fee * 2;
  v_winner_reward := round(v_pot * 0.9);
  v_loser_penalty := v_room.entry_fee;

  -- Mark room finished
  UPDATE public.match_rooms
  SET status = 'finished', winner_id = v_winner_id, finished_at = now(), updated_at = now()
  WHERE id = room_id;

  -- If no winner (draw / abandoned with no valid result), skip rewards
  IF v_winner_id IS NULL THEN
    RETURN json_build_object('winner_reward', 0, 'loser_reward', 0);
  END IF;

  -- Determine loser
  v_loser_id := CASE
    WHEN v_winner_id = v_room.player1_id THEN v_room.player2_id
    ELSE v_room.player1_id
  END;

  SELECT * INTO v_winner_profile FROM public.profiles WHERE id = v_winner_id;
  SELECT * INTO v_loser_profile  FROM public.profiles WHERE id = v_loser_id;

  -- Update balances: winner gets prize, loser already paid entry on room creation
  -- (Entry fee was deducted at join time; here we credit the winner's winnings)
  UPDATE public.profiles SET balance = balance + v_winner_reward, updated_at = now() WHERE id = v_winner_id;
  UPDATE public.profiles SET balance = balance - v_loser_penalty, updated_at = now() WHERE id = v_loser_id;

  -- Record match history for winner
  INSERT INTO public.match_history (user_id, room_name, opponent_name, result, reward, score, opponent_score, duration_seconds, is_private)
  VALUES (
    v_winner_id,
    COALESCE(v_room.room_name, 'Partida ' || substring(room_id::text, 1, 6)),
    COALESCE(v_loser_profile.display_name, 'Oponente'),
    'win', v_winner_reward,
    CASE WHEN v_winner_id = v_room.player1_id THEN p1_pips ELSE p2_pips END,
    CASE WHEN v_winner_id = v_room.player1_id THEN p2_pips ELSE p1_pips END,
    duration_seconds, v_is_private
  );

  -- Record match history for loser
  INSERT INTO public.match_history (user_id, room_name, opponent_name, result, reward, score, opponent_score, duration_seconds, is_private)
  VALUES (
    v_loser_id,
    COALESCE(v_room.room_name, 'Partida ' || substring(room_id::text, 1, 6)),
    COALESCE(v_winner_profile.display_name, 'Oponente'),
    'loss', -v_loser_penalty,
    CASE WHEN v_loser_id = v_room.player1_id THEN p1_pips ELSE p2_pips END,
    CASE WHEN v_loser_id = v_room.player1_id THEN p2_pips ELSE p1_pips END,
    duration_seconds, v_is_private
  );

  RETURN json_build_object('winner_reward', v_winner_reward, 'loser_reward', -v_loser_penalty);
END;
$$;

-- 4. Auto-expiration: cancel private waiting rooms older than 30 minutes
--
--    STEP REQUIRED BEFORE RUNNING THIS BLOCK:
--      Supabase Dashboard → Database → Extensions → enable "pg_cron"
--
--    Then run this block separately in the SQL editor:
--
-- SELECT cron.schedule(
--   'expire-private-rooms',
--   '*/5 * * * *',
--   $$
--     UPDATE public.match_rooms
--     SET    status = 'finished',
--            finished_at = now(),
--            updated_at  = now()
--     WHERE  status      = 'waiting'
--       AND  is_private  = true
--       AND  created_at  < now() - interval '30 minutes';
--   $$
-- );
--
-- To verify the job was created:
--   SELECT * FROM cron.job;

-- ============================================================
-- Betting system for online 1v1 matches
-- ============================================================

-- Add entry_fee and pot columns to match_rooms
ALTER TABLE match_rooms
  ADD COLUMN IF NOT EXISTS entry_fee integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS pot       integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bet_placed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz;

-- ============================================================
-- RPC: start_online_match (updated — now deducts entry fees)
-- Called by p2 right after joining.
-- Deducts entry_fee from BOTH players atomically.
-- ============================================================
CREATE OR REPLACE FUNCTION start_online_match(
  room_id       uuid,
  initial_state jsonb,
  first_turn_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_room      match_rooms%rowtype;
  v_p1_bal    integer;
  v_p2_bal    integer;
  v_fee       integer;
  v_pot       integer;
BEGIN
  SELECT * INTO v_room FROM match_rooms WHERE id = room_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  IF v_room.player2_id != auth.uid() THEN
    RAISE EXCEPTION 'Only player 2 starts the match';
  END IF;

  IF v_room.status != 'playing' THEN
    RAISE EXCEPTION 'Room is not in playing state';
  END IF;

  IF v_room.bet_placed THEN
    RAISE EXCEPTION 'Bet already placed';
  END IF;

  v_fee := v_room.entry_fee;
  v_pot := v_fee * 2;

  -- Check balances
  SELECT balance INTO v_p1_bal FROM profiles WHERE id = v_room.player1_id FOR UPDATE;
  SELECT balance INTO v_p2_bal FROM profiles WHERE id = v_room.player2_id FOR UPDATE;

  IF v_p1_bal < v_fee THEN
    RAISE EXCEPTION 'Jogador 1 não tem moedas suficientes';
  END IF;

  IF v_p2_bal < v_fee THEN
    RAISE EXCEPTION 'Você não tem moedas suficientes';
  END IF;

  -- Deduct from both
  UPDATE profiles SET balance = balance - v_fee WHERE id = v_room.player1_id;
  UPDATE profiles SET balance = balance - v_fee WHERE id = v_room.player2_id;

  -- Wallet transactions
  INSERT INTO wallet_transactions (user_id, title, description, amount, highlight)
    VALUES (v_room.player1_id, 'Entrada na partida', 'Duelo 1v1 Online', -v_fee, 'muted');
  INSERT INTO wallet_transactions (user_id, title, description, amount, highlight)
    VALUES (v_room.player2_id, 'Entrada na partida', 'Duelo 1v1 Online', -v_fee, 'muted');

  -- Update room
  UPDATE match_rooms
     SET game_state      = initial_state,
         current_turn_id = first_turn_id,
         bet_placed      = true,
         pot             = v_pot,
         started_at      = now()
   WHERE id = room_id;
END;
$$;

-- ============================================================
-- RPC: resolve_online_match
-- Called after game ends. Credits winner (90% of pot), saves
-- match_history for both players, updates profiles.
-- House keeps 10%.
-- ============================================================
CREATE OR REPLACE FUNCTION resolve_online_match(
  room_id          uuid,
  winner_id        uuid,     -- null for draw
  duration_seconds integer,
  p1_pips          integer,
  p2_pips          integer
)
RETURNS jsonb   -- { winner_reward, loser_reward }
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_room          match_rooms%rowtype;
  v_winner_reward integer;
  v_loser_reward  integer;
  v_p1_name       text;
  v_p2_name       text;
  v_is_draw       boolean;
BEGIN
  SELECT * INTO v_room FROM match_rooms WHERE id = room_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  IF v_room.status != 'finished' THEN
    RAISE EXCEPTION 'Match is not finished yet';
  END IF;

  IF v_room.finished_at IS NOT NULL THEN
    RAISE EXCEPTION 'Match already resolved';
  END IF;

  -- Caller must be a player in this room
  IF auth.uid() != v_room.player1_id AND auth.uid() != v_room.player2_id THEN
    RAISE EXCEPTION 'Not a player in this room';
  END IF;

  SELECT display_name INTO v_p1_name FROM profiles WHERE id = v_room.player1_id;
  SELECT display_name INTO v_p2_name FROM profiles WHERE id = v_room.player2_id;

  v_is_draw := winner_id IS NULL;

  -- Reward calculation (house takes 10%)
  IF v_is_draw THEN
    -- Draw: each gets back 90% of their entry
    v_winner_reward := ROUND(v_room.entry_fee * 0.9);
    v_loser_reward  := v_winner_reward;
  ELSE
    -- Winner takes 90% of pot
    v_winner_reward := ROUND(v_room.pot * 0.9);
    v_loser_reward  := 0;
  END IF;

  -- Credit rewards
  IF v_is_draw THEN
    UPDATE profiles SET balance = balance + v_winner_reward WHERE id = v_room.player1_id;
    UPDATE profiles SET balance = balance + v_loser_reward  WHERE id = v_room.player2_id;

    INSERT INTO wallet_transactions (user_id, title, description, amount, highlight)
      VALUES
        (v_room.player1_id, 'Empate', 'Duelo 1v1 Online', v_winner_reward, 'muted'),
        (v_room.player2_id, 'Empate', 'Duelo 1v1 Online', v_loser_reward,  'muted');
  ELSE
    DECLARE v_loser_id uuid := CASE WHEN winner_id = v_room.player1_id THEN v_room.player2_id ELSE v_room.player1_id END;
    BEGIN
      UPDATE profiles SET balance = balance + v_winner_reward WHERE id = winner_id;

      INSERT INTO wallet_transactions (user_id, title, description, amount, highlight)
        VALUES (winner_id, 'Vitória', 'Duelo 1v1 Online', v_winner_reward, 'gold');

      -- Update winner profile stats
      PERFORM increment_profile_after_victory(winner_id, v_winner_reward);

      -- Update loser matches_count
      UPDATE profiles
         SET matches_count = matches_count + 1,
             win_rate = ROUND(
               (win_rate * matches_count) / (matches_count + 1)
             )
       WHERE id = v_loser_id;
    END;
  END IF;

  -- Save match_history for both players
  INSERT INTO match_history
    (user_id, room_name, opponent_name, result, reward, score, opponent_score, duration_seconds)
  VALUES
    (
      v_room.player1_id,
      'Duelo 1v1 Online',
      v_p2_name,
      CASE WHEN v_is_draw THEN 'loss'
           WHEN winner_id = v_room.player1_id THEN 'win'
           ELSE 'loss' END,
      CASE WHEN v_is_draw THEN v_winner_reward
           WHEN winner_id = v_room.player1_id THEN v_winner_reward
           ELSE 0 END,
      p1_pips,
      p2_pips,
      duration_seconds
    ),
    (
      v_room.player2_id,
      'Duelo 1v1 Online',
      v_p1_name,
      CASE WHEN v_is_draw THEN 'loss'
           WHEN winner_id = v_room.player2_id THEN 'win'
           ELSE 'loss' END,
      CASE WHEN v_is_draw THEN v_loser_reward
           WHEN winner_id = v_room.player2_id THEN v_winner_reward
           ELSE 0 END,
      p2_pips,
      p1_pips,
      duration_seconds
    );

  -- Mark as resolved
  UPDATE match_rooms SET finished_at = now() WHERE id = room_id;

  RETURN jsonb_build_object(
    'winner_reward', v_winner_reward,
    'loser_reward', v_loser_reward
  );
END;
$$;

-- New users start with clean stats (not mock data)
-- The ensureUserProfile function in TypeScript handles this already via ignoreDuplicates

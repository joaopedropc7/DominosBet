-- ============================================================
-- RevShare automático para afiliados
-- Quando um jogador perde, o afiliado que o indicou recebe
-- um % do lucro da casa (GGR).
--
-- GGR por partida = 10% do pot (ex: entry_fee=100 → GGR=20)
-- RevShare do afiliado = GGR × affiliate.revshare_percent / 100
-- ============================================================

-- ── Helper: pay_affiliate_revshare ───────────────────────────
-- Chamada para cada jogador que gerou lucro à casa.
-- p_user_id     = o jogador (de quem sai o GGR)
-- p_house_profit = valor inteiro que ficou com a casa
CREATE OR REPLACE FUNCTION public.pay_affiliate_revshare(
  p_user_id      uuid,
  p_house_profit integer
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_referral   public.affiliate_referrals%ROWTYPE;
  v_affiliate  public.affiliates%ROWTYPE;
  v_revshare   integer;
  v_amount     integer;
BEGIN
  IF p_house_profit <= 0 THEN RETURN; END IF;

  SELECT * INTO v_referral
    FROM public.affiliate_referrals
   WHERE user_id = p_user_id
   LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO v_affiliate
    FROM public.affiliates
   WHERE id     = v_referral.affiliate_id
     AND status = 'approved'
   LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  v_revshare := COALESCE(v_affiliate.revshare_percent, 0);
  IF v_revshare <= 0 THEN RETURN; END IF;

  v_amount := ROUND(p_house_profit * v_revshare / 100.0)::integer;
  IF v_amount <= 0 THEN RETURN; END IF;

  UPDATE public.affiliates
     SET balance      = balance + v_amount,
         total_earned = total_earned + v_amount
   WHERE id = v_affiliate.id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.pay_affiliate_revshare(uuid, integer) TO authenticated;

-- ── resolve_online_match com RevShare ────────────────────────
CREATE OR REPLACE FUNCTION resolve_online_match(
  room_id          uuid,
  winner_id        uuid,
  duration_seconds integer,
  p1_pips          integer,
  p2_pips          integer
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_room          match_rooms%rowtype;
  v_winner_reward integer;
  v_loser_reward  integer;
  v_loser_id      uuid;
  v_p1_name       text;
  v_p2_name       text;
  v_is_draw       boolean;
  v_house_profit  integer;
BEGIN
  SELECT * INTO v_room FROM match_rooms WHERE id = room_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF v_room.status != 'finished' THEN RAISE EXCEPTION 'Match is not finished yet'; END IF;
  IF v_room.finished_at IS NOT NULL THEN RAISE EXCEPTION 'Match already resolved'; END IF;

  IF auth.uid() != v_room.player1_id AND auth.uid() != v_room.player2_id THEN
    RAISE EXCEPTION 'Not a player in this room';
  END IF;

  SELECT display_name INTO v_p1_name FROM profiles WHERE id = v_room.player1_id;
  SELECT display_name INTO v_p2_name FROM profiles WHERE id = v_room.player2_id;

  v_is_draw := winner_id IS NULL;

  -- ── Cálculo de recompensas (casa fica 10%) ────────────────
  IF v_is_draw THEN
    v_winner_reward := ROUND(v_room.entry_fee * 0.9);
    v_loser_reward  := v_winner_reward;
  ELSE
    v_winner_reward := ROUND(v_room.pot * 0.9);
    v_loser_reward  := 0;
    v_loser_id      := CASE
                         WHEN winner_id = v_room.player1_id THEN v_room.player2_id
                         ELSE v_room.player1_id
                       END;
  END IF;

  -- ── Credita recompensas ───────────────────────────────────
  IF v_is_draw THEN
    UPDATE profiles SET balance = balance + v_winner_reward WHERE id = v_room.player1_id;
    UPDATE profiles SET balance = balance + v_loser_reward  WHERE id = v_room.player2_id;
    INSERT INTO wallet_transactions (user_id, title, description, amount, highlight) VALUES
      (v_room.player1_id, 'Empate', 'Duelo 1v1 Online', v_winner_reward, 'muted'),
      (v_room.player2_id, 'Empate', 'Duelo 1v1 Online', v_loser_reward,  'muted');
  ELSE
    UPDATE profiles SET balance = balance + v_winner_reward WHERE id = winner_id;
    INSERT INTO wallet_transactions (user_id, title, description, amount, highlight)
      VALUES (winner_id, 'Vitória', 'Duelo 1v1 Online', v_winner_reward, 'gold');
    PERFORM increment_profile_after_victory(winner_id, v_winner_reward);
    UPDATE profiles
       SET matches_count = matches_count + 1,
           win_rate = ROUND((win_rate * matches_count) / (matches_count + 1))
     WHERE id = v_loser_id;
  END IF;

  -- ── RevShare para afiliados ───────────────────────────────
  IF v_is_draw THEN
    -- Em empate: casa fica 10% de cada entry_fee
    v_house_profit := ROUND(v_room.entry_fee * 0.1);
    PERFORM public.pay_affiliate_revshare(v_room.player1_id, v_house_profit);
    PERFORM public.pay_affiliate_revshare(v_room.player2_id, v_house_profit);
  ELSE
    -- Vitória: casa fica 10% do pot (inteiro deduzido do loser)
    v_house_profit := v_room.pot - v_winner_reward;
    PERFORM public.pay_affiliate_revshare(v_loser_id, v_house_profit);
  END IF;

  -- ── Histórico ────────────────────────────────────────────
  INSERT INTO match_history
    (user_id, room_name, opponent_name, result, reward, score, opponent_score, duration_seconds)
  VALUES
    (
      v_room.player1_id, 'Duelo 1v1 Online', v_p2_name,
      CASE WHEN v_is_draw THEN 'loss' WHEN winner_id = v_room.player1_id THEN 'win' ELSE 'loss' END,
      CASE WHEN v_is_draw THEN v_winner_reward WHEN winner_id = v_room.player1_id THEN v_winner_reward ELSE 0 END,
      p1_pips, p2_pips, duration_seconds
    ),
    (
      v_room.player2_id, 'Duelo 1v1 Online', v_p1_name,
      CASE WHEN v_is_draw THEN 'loss' WHEN winner_id = v_room.player2_id THEN 'win' ELSE 'loss' END,
      CASE WHEN v_is_draw THEN v_loser_reward WHEN winner_id = v_room.player2_id THEN v_winner_reward ELSE 0 END,
      p2_pips, p1_pips, duration_seconds
    );

  UPDATE match_rooms SET finished_at = now() WHERE id = room_id;

  RETURN jsonb_build_object(
    'winner_reward', v_winner_reward,
    'loser_reward',  v_loser_reward
  );
END;
$$;

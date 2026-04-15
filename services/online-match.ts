import type { OnlineGameState, MatchRoomRow } from '@/types/database';
import { supabase } from './supabase';

export const ENTRY_FEE = 20;    // coins per player
export const WINNER_REWARD = Math.round(ENTRY_FEE * 2 * 0.9); // 36 coins

/** Find a waiting room or create a new one for a specific mode. Returns room_id and your role. */
export async function joinMatchmaking(
  mode: 'classic' | 'express',
): Promise<{ roomId: string; role: 'p1' | 'p2' }> {
  const { data, error } = await supabase.rpc('join_matchmaking', { p_mode: mode });
  if (error) throw new Error(error.message);
  const result = data as { room_id: string; role: 'p1' | 'p2' };
  return { roomId: result.room_id, role: result.role };
}

/** Called by p2 after joining to push the initial shuffled game state. */
export async function startOnlineMatch(
  roomId: string,
  initialState: OnlineGameState,
  firstTurnUserId: string,
): Promise<void> {
  const { error } = await supabase.rpc('start_online_match', {
    room_id: roomId,
    initial_state: initialState as any,
    first_turn_id: firstTurnUserId,
  });
  if (error) throw new Error(error.message);
}

/**
 * Push a new game state after a play or pass.
 * flipTurn=false when the player draws a tile (stays their turn).
 */
export async function makeOnlineMove(
  roomId: string,
  newState: OnlineGameState,
  flipTurn = true,
): Promise<void> {
  const { error } = await supabase.rpc('make_move_online', {
    room_id: roomId,
    new_state: newState as any,
    flip_turn: flipTurn,
  });
  if (error) throw new Error(error.message);
}

/** Forfeit — the other player wins. */
export async function abandonMatch(roomId: string): Promise<void> {
  const { error } = await supabase.rpc('abandon_match', { room_id: roomId });
  if (error) throw new Error(error.message);
}

/** Cancel a waiting room before anyone joins. */
export async function leaveMatchmaking(roomId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_matchmaking', { room_id: roomId });
  if (error) throw new Error(error.message);
}

/** Fetch the current room row (used for initial load). */
export async function fetchRoom(roomId: string): Promise<MatchRoomRow> {
  const { data, error } = await supabase
    .from('match_rooms')
    .select('*')
    .eq('id', roomId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Resolve finished match: credit winner, save match_history, update profiles. */
export async function resolveOnlineMatch(
  roomId: string,
  winnerId: string | null,  // null = draw
  durationSeconds: number,
  p1Pips: number,
  p2Pips: number,
): Promise<{ winnerReward: number; loserReward: number }> {
  const { data, error } = await supabase.rpc('resolve_online_match', {
    room_id: roomId,
    winner_id: winnerId,
    duration_seconds: durationSeconds,
    p1_pips: p1Pips,
    p2_pips: p2Pips,
  });
  if (error) throw new Error(error.message);
  const result = data as { winner_reward: number; loser_reward: number };
  return { winnerReward: result.winner_reward, loserReward: result.loser_reward };
}

import { supabase } from './supabase';

export interface LeaderboardEntry {
  rank_pos: number;
  id: string;
  display_name: string;
  avatar_id: string;
  rank_label: string;
  matches_count: number;
  win_rate: number;
  balance: number;
}

export async function getLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_leaderboard', { p_limit: limit });
  if (error) throw new Error(error.message);
  return (data ?? []) as LeaderboardEntry[];
}

export async function sendRematchInvite(
  opponentId: string,
  roomId: string,
  inviteCode: string,
): Promise<void> {
  const { error } = await supabase.rpc('send_rematch_invite', {
    p_opponent_id: opponentId,
    p_room_id:     roomId,
    p_invite_code: inviteCode,
  });
  if (error) throw new Error(error.message);
}

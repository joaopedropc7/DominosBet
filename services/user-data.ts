import { getDisplayName } from '@/features/auth/utils';
import { defaultAvatarId } from '@/constants/avatars';
import { resultMock, userMock, walletActivityMock } from '@/services/mock-data';
import { supabase } from '@/services/supabase';
import type { MatchHistoryRow, ProfileRow, WalletTransactionRow } from '@/types/database';

export async function ensureUserProfile(userId: string, email: string | undefined, metadataName: unknown) {
  const payload = {
    id: userId,
    email: email ?? '',
    display_name: getDisplayName(email, metadataName),
    avatar_id: defaultAvatarId,
    rank_label: userMock.rank,
    balance: userMock.balance,
    level: 42,
    xp: 2450,
    xp_target: 3000,
    win_rate: 65,
    matches_count: 142,
    streak_label: '5 vitórias',
  };

  // ignoreDuplicates: true → só insere quando o perfil ainda não existe.
  // Nunca sobrescreve dados de um perfil já existente (evita resetar is_admin, balance, etc.)
  const { error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw error;
}

export async function updateUserProfile(
  payload: {
    display_name: string;
    avatar_id: string;
  },
) {
  const { error } = await supabase.rpc('update_profile_identity', {
    target_display_name: payload.display_name.trim(),
    target_avatar_id: payload.avatar_id,
  });

  if (error) throw error;
}

export async function getUserProfile(userId: string) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data as ProfileRow;
}

export async function listWalletTransactions(userId: string) {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as WalletTransactionRow[];
}

export async function listMatchHistory(userId: string) {
  const { data, error } = await supabase
    .from('match_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as MatchHistoryRow[];
}

export async function seedUserDataIfNeeded(userId: string) {
  const [walletResult, matchResult] = await Promise.all([
    supabase.from('wallet_transactions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('match_history').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  if (walletResult.error) throw walletResult.error;
  if (matchResult.error) throw matchResult.error;

  if (!walletResult.count) {
    const { error } = await supabase.from('wallet_transactions').insert(
      walletActivityMock.map((item, index) => ({
        user_id: userId,
        title: item.title,
        description: item.description,
        amount: item.value,
        highlight: item.highlight,
        created_at: new Date(Date.now() - index * 60 * 60 * 1000).toISOString(),
      })),
    );

    if (error) throw error;
  }

  if (!matchResult.count) {
    const { error } = await supabase.from('match_history').insert({
      user_id: userId,
      room_name: 'Mesa Rubi',
      opponent_name: resultMock.opponent,
      result: 'win',
      reward: 450,
      score: 150,
      opponent_score: 85,
      duration_seconds: 262,
    });

    if (error) throw error;
  }
}

export async function saveDemoMatchResult(userId: string) {
  const { error: matchError } = await supabase.from('match_history').insert({
    user_id: userId,
    room_name: 'Arena Premium',
    opponent_name: resultMock.opponent,
    result: 'win',
    reward: resultMock.reward,
    score: resultMock.points,
    opponent_score: resultMock.opponentScore,
    duration_seconds: 262,
  });

  if (matchError) throw matchError;

  const { error: walletError } = await supabase.from('wallet_transactions').insert({
    user_id: userId,
    title: 'Vitória',
    description: 'Arena Premium',
    amount: resultMock.reward,
    highlight: 'gold',
  });

  if (walletError) throw walletError;

  const { error: profileError } = await supabase.rpc('increment_profile_after_victory', {
    target_user_id: userId,
    reward_amount: resultMock.reward,
  });

  if (profileError && !profileError.message.includes('increment_profile_after_victory')) {
    throw profileError;
  }
}

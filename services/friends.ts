import { supabase } from '@/services/supabase';
import type { FriendEntry, ProfileRow } from '@/types/database';

/** Search for a profile by exact nickname (case-insensitive, excludes self) */
export async function findProfileByNickname(nickname: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase.rpc('find_profile_by_nickname', { nickname: nickname.trim() });
  if (error) throw error;
  return (data as ProfileRow[])[0] ?? null;
}

/** Send a friend request to a user by their profile id (also creates a notification) */
export async function sendFriendRequest(addresseeId: string): Promise<void> {
  const { error } = await supabase.rpc('send_friend_request', {
    p_addressee_id: addresseeId,
  });
  if (error) throw new Error(error.message);
}

/** Accept a pending friend request (also marks the notification as read) */
export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  const { error } = await supabase.rpc('accept_friend_request', {
    p_friendship_id: friendshipId,
  });
  if (error) throw new Error(error.message);
}

/** Remove a friendship or cancel a pending request */
export async function removeFriendship(friendshipId: string): Promise<void> {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
  if (error) throw error;
}

/**
 * List all friendships for the current user, enriched with the friend's profile.
 * Returns accepted friends + pending sent + pending received.
 */
export async function listFriends(userId: string): Promise<FriendEntry[]> {
  const { data: rows, error } = await supabase
    .from('friendships')
    .select('*, requester:profiles!friendships_requester_id_fkey(*), addressee:profiles!friendships_addressee_id_fkey(*)')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (rows ?? []).map((row: any) => {
    const iAmRequester = row.requester_id === userId;
    const friendProfile: ProfileRow = iAmRequester ? row.addressee : row.requester;

    let status: FriendEntry['status'];
    if (row.status === 'accepted') {
      status = 'accepted';
    } else if (iAmRequester) {
      status = 'pending_sent';
    } else {
      status = 'pending_received';
    }

    return {
      friendshipId: row.id,
      profile: friendProfile,
      status,
      createdAt: row.created_at,
    } satisfies FriendEntry;
  });
}

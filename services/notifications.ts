import { supabase } from './supabase';

export interface AppNotification {
  id: string;
  user_id: string;
  type: 'room_invite';
  payload: RoomInvitePayload;
  read: boolean;
  created_at: string;
}

export interface RoomInvitePayload {
  sender_id: string;
  sender_name: string;
  room_id: string;
  invite_code: string;
  entry_fee: number;
  room_name: string | null;
  mode: 'classic' | 'express';
}

/** List unread notifications for the current user. */
export async function listNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as AppNotification[];
}

/** Send a room invite to a friend. */
export async function sendRoomInvite(
  friendId: string,
  roomId: string,
  inviteCode: string,
): Promise<void> {
  const { error } = await supabase.rpc('send_room_invite', {
    p_friend_id:   friendId,
    p_room_id:     roomId,
    p_invite_code: inviteCode,
  });
  if (error) throw new Error(error.message);
}

/** Mark specific notifications (or all) as read. */
export async function markNotificationsRead(ids?: string[]): Promise<void> {
  const { error } = await supabase.rpc('mark_notifications_read', {
    p_ids: ids ?? null,
  });
  if (error) throw new Error(error.message);
}

/** Count unread notifications. */
export async function countUnreadNotifications(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('read', false);
  if (error) return 0;
  return count ?? 0;
}

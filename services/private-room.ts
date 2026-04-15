import { supabase } from './supabase';

export interface RoomPreviewData {
  room_id: string;
  room_name: string | null;
  entry_fee: number;
  has_password: boolean;
  status: string;
}

export interface ActiveRoomData {
  room_id: string;
  room_name: string | null;
  entry_fee: number;
  invite_code: string;
  has_password: boolean;
  created_at: string;
}

export interface AvailableRoomData {
  room_id: string;
  room_name: string | null;
  entry_fee: number;
  invite_code: string;
  mode: 'classic' | 'express';
  has_password: boolean;
  created_at: string;
  creator_name: string;
  creator_avatar_id: string;
}

/** Create a private room. Returns room_id and invite_code. */
export async function createPrivateRoom(
  entryFee: number,
  mode: 'classic' | 'express' = 'classic',
  password?: string,
  roomName?: string,
): Promise<{ roomId: string; inviteCode: string }> {
  const { data, error } = await supabase.rpc('create_private_room', {
    p_entry_fee: entryFee,
    p_mode:      mode,
    p_password:  password  ?? null,
    p_room_name: roomName  ?? null,
  });
  if (error) throw new Error(error.message);
  const result = data as { room_id: string; invite_code: string };
  return { roomId: result.room_id, inviteCode: result.invite_code };
}

/** Get safe room info by invite code (no password exposed). */
export async function previewPrivateRoom(inviteCode: string): Promise<RoomPreviewData> {
  const { data, error } = await supabase.rpc('preview_private_room', {
    p_invite_code: inviteCode.toUpperCase().trim(),
  });
  if (error) throw new Error(error.message);
  return data as RoomPreviewData;
}

/** Join a private room. Returns room_id and role='p2'. */
export async function joinPrivateRoom(
  inviteCode: string,
  password?: string,
): Promise<{ roomId: string; role: 'p2' }> {
  const { data, error } = await supabase.rpc('join_private_room', {
    p_invite_code: inviteCode.toUpperCase().trim(),
    p_password:    password ?? null,
  });
  if (error) throw new Error(error.message);
  const result = data as { room_id: string; role: 'p2' };
  return { roomId: result.room_id, role: result.role };
}

/** List the current user's own waiting private rooms. */
export async function getMyActiveRooms(): Promise<ActiveRoomData[]> {
  const { data, error } = await supabase.rpc('get_my_active_rooms');
  if (error) throw new Error(error.message);
  return (data as ActiveRoomData[]) ?? [];
}

/** List all available waiting private rooms (excluding current user's own). */
export async function listAvailableRooms(): Promise<AvailableRoomData[]> {
  const { data, error } = await supabase.rpc('list_available_rooms');
  if (error) throw new Error(error.message);
  return (data as AvailableRoomData[]) ?? [];
}

/** Cancel a waiting private room created by me. */
export async function cancelPrivateRoom(roomId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_private_room', { p_room_id: roomId });
  if (error) throw new Error(error.message);
}

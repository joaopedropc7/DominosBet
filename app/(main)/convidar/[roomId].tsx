import { useLocalSearchParams } from 'expo-router';
import { InviteFriendsScreenView } from '@/features/rooms/screens/InviteFriendsScreenView';

export default function ConvidarRoute() {
  const { roomId, inviteCode } = useLocalSearchParams<{ roomId: string; inviteCode: string }>();
  if (!roomId || !inviteCode) return null;
  return <InviteFriendsScreenView roomId={roomId} inviteCode={inviteCode} />;
}

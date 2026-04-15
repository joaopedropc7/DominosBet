import { useLocalSearchParams } from 'expo-router';
import { RoomLobbyScreenView } from '@/features/rooms/screens/RoomLobbyScreenView';

export default function SalaPrivadaRoute() {
  const { roomId, inviteCode, entryFee, roomName } =
    useLocalSearchParams<{ roomId: string; inviteCode: string; entryFee: string; roomName: string }>();

  if (!roomId || !inviteCode) return null;

  return (
    <RoomLobbyScreenView
      roomId={roomId}
      inviteCode={inviteCode}
      entryFee={Number(entryFee ?? '20')}
      roomName={roomName || undefined}
    />
  );
}

import { useLocalSearchParams } from 'expo-router';
import { OnlineMatchScreenView } from '@/features/game/screens/OnlineMatchScreenView';
import { useAuth } from '@/hooks/useAuth';
import { useUserData } from '@/hooks/useUserData';

export default function OnlineMatchRoute() {
  const { roomId, role } = useLocalSearchParams<{ roomId: string; role: 'p1' | 'p2' }>();
  const { session } = useAuth();
  const { profile } = useUserData();

  if (!roomId || !role || !session?.user.id) return null;

  return (
    <OnlineMatchScreenView
      roomId={roomId}
      role={role}
      myUserId={session.user.id}
      myName={profile?.display_name ?? 'Você'}
    />
  );
}

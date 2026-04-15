import { useLocalSearchParams } from 'expo-router';
import { JoinRoomScreenView } from '@/features/rooms/screens/JoinRoomScreenView';

export default function EntrarSalaRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <JoinRoomScreenView code={code ?? ''} />;
}

import { useLocalSearchParams } from 'expo-router';
import { MatchSearchScreenView } from '@/features/matchmaking/screens/MatchSearchScreenView';

export default function MatchSearchRoute() {
  const { mode } = useLocalSearchParams<{ mode: 'classic' | 'express' }>();
  return <MatchSearchScreenView mode={mode ?? 'classic'} />;
}

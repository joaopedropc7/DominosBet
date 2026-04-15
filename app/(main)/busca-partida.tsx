import { useLocalSearchParams } from 'expo-router';
import { ENTRY_FEE } from '@/services/online-match';
import { MatchSearchScreenView } from '@/features/matchmaking/screens/MatchSearchScreenView';

export default function MatchSearchRoute() {
  const { mode, entryFee } = useLocalSearchParams<{ mode: 'classic' | 'express'; entryFee: string }>();
  return (
    <MatchSearchScreenView
      mode={mode ?? 'classic'}
      entryFee={entryFee ? Number(entryFee) : ENTRY_FEE}
    />
  );
}

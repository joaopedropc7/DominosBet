import { Slot } from 'expo-router';
import { AffiliateShell } from '@/features/affiliate/components/AffiliateShell';

export default function AfiliadoLayout() {
  return (
    <AffiliateShell>
      <Slot />
    </AffiliateShell>
  );
}

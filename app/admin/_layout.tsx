import { Slot } from 'expo-router';
import { AdminShell } from '@/features/admin/components/AdminShell';

export default function AdminLayout() {
  return (
    <AdminShell>
      <Slot />
    </AdminShell>
  );
}

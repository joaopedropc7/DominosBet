import { AdminShell } from '@/features/admin/components/AdminShell';
import { AdminConfiguracoesView } from '@/features/admin/screens/AdminConfiguracoesView';

export default function AdminConfiguracoesPage() {
  return (
    <AdminShell>
      <AdminConfiguracoesView />
    </AdminShell>
  );
}

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import { theme } from '@/theme';

type Deposit = {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  amount_reais: number;
  status: string;
  orama_id: string | null;
  external_ref: string;
  pix_expires_at: string | null;
  paid_at: string | null;
  created_at: string;
};

const STATUS_FILTERS = [
  { key: null,       label: 'Todos'     },
  { key: 'paid',     label: 'Pagos'     },
  { key: 'pending',  label: 'Pendentes' },
  { key: 'refused',  label: 'Recusados' },
  { key: 'expired',  label: 'Expirados' },
  { key: 'refunded', label: 'Estornados'},
] as const;

type StatusKey = typeof STATUS_FILTERS[number]['key'];

const STATUS_COLORS: Record<string, string> = {
  paid:     '#22C55E',
  pending:  '#F59E0B',
  refused:  '#EF4444',
  expired:  '#6B7280',
  refunded: '#8B5CF6',
};

const STATUS_LABELS: Record<string, string> = {
  paid:     'Pago',
  pending:  'Pendente',
  refused:  'Recusado',
  expired:  'Expirado',
  refunded: 'Estornado',
};

function fmt(date: string) {
  return new Date(date).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export function AdminTransacoesView() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusKey>(null);

  // ── totais de resumo ──────────────────────────────────
  const totalPaid    = deposits.filter(d => d.status === 'paid').reduce((s, d) => s + Number(d.amount_reais), 0);
  const totalPending = deposits.filter(d => d.status === 'pending').reduce((s, d) => s + Number(d.amount_reais), 0);
  const pendingCount = deposits.filter(d => d.status === 'pending').length;

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_list_deposits', {
      p_status: statusFilter ?? undefined,
      p_limit:  100,
      p_offset: 0,
    });
    if (!error && data) setDeposits(data as Deposit[]);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  // ── render row ────────────────────────────────────────
  function renderItem({ item }: { item: Deposit }) {
    const color = STATUS_COLORS[item.status] ?? theme.colors.textFaint;
    return (
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <View style={[styles.statusDot, { backgroundColor: color }]} />
          <View style={styles.rowInfo}>
            <Text style={styles.rowName} numberOfLines={1}>
              {item.display_name}
            </Text>
            <Text style={styles.rowEmail} numberOfLines={1}>
              {item.email}
            </Text>
            <Text style={styles.rowDate}>{fmt(item.created_at)}</Text>
          </View>
        </View>

        <View style={styles.rowRight}>
          <Text style={[styles.rowAmount, { color: item.status === 'paid' ? STATUS_COLORS.paid : theme.colors.text }]}>
            R$ {Number(item.amount_reais).toFixed(2)}
          </Text>
          <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
            <Text style={[styles.badgeText, { color }]}>
              {STATUS_LABELS[item.status] ?? item.status}
            </Text>
          </View>
          {item.orama_id && (
            <Text style={styles.oramaId} numberOfLines={1}>
              #{item.orama_id.slice(-8)}
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* ── Header ──────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Transações</Text>
        <Pressable onPress={load} style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.7 }]}>
          <MaterialCommunityIcons name="refresh" size={20} color={theme.colors.textMuted} />
        </Pressable>
      </View>

      {/* ── Resumo ──────────────────────────────────── */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total recebido</Text>
          <Text style={[styles.summaryValue, { color: STATUS_COLORS.paid }]}>
            R$ {totalPaid.toFixed(2)}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Pendentes</Text>
          <Text style={[styles.summaryValue, { color: STATUS_COLORS.pending }]}>
            R$ {totalPending.toFixed(2)}
            {pendingCount > 0 && (
              <Text style={styles.pendingCount}> ({pendingCount})</Text>
            )}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total depósitos</Text>
          <Text style={styles.summaryValue}>{deposits.length}</Text>
        </View>
      </View>

      {/* ── Filtros ──────────────────────────────────── */}
      <View style={styles.filters}>
        {STATUS_FILTERS.map((f) => (
          <Pressable
            key={String(f.key)}
            onPress={() => setStatusFilter(f.key)}
            style={[styles.filterChip, statusFilter === f.key && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, statusFilter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Lista ────────────────────────────────────── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : deposits.length === 0 ? (
        <View style={styles.centered}>
          <MaterialCommunityIcons name="credit-card-off-outline" size={40} color={theme.colors.textFaint} />
          <Text style={styles.emptyText}>Nenhuma transação encontrada.</Text>
        </View>
      ) : (
        <FlatList
          data={deposits}
          keyExtractor={(d) => d.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: theme.spacing.xl,
    gap: theme.spacing.lg,
  },

  // ── Header ──────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 28,
  },
  refreshBtn: {
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
  },

  // ── Resumo ──────────────────────────────────────────
  summaryRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 4,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  summaryLabel: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  summaryValue: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.displayMedium,
    fontSize: 18,
  },
  pendingCount: {
    color: STATUS_COLORS.pending,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 14,
  },

  // ── Filtros ─────────────────────────────────────────
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  filterChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    backgroundColor: theme.colors.surface,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
  },
  filterText: {
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 12,
  },
  filterTextActive: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.bodySemiBold,
  },

  // ── Lista ───────────────────────────────────────────
  list: {
    gap: 0,
  },
  sep: {
    height: 1,
    backgroundColor: theme.colors.outline,
    marginHorizontal: -theme.spacing.xl,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.md,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    flex: 1,
    minWidth: 0,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  rowInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowName: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 14,
  },
  rowEmail: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 11,
  },
  rowDate: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 10,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
  },
  rowAmount: {
    fontFamily: theme.typography.fontFamily.displayMedium,
    fontSize: 16,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  oramaId: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 10,
  },

  // ── Estados ─────────────────────────────────────────
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  emptyText: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
  },
});

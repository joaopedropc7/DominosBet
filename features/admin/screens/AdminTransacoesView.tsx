import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable,
  StyleSheet, Text, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import { theme } from '@/theme';

// ─── Types ────────────────────────────────────────────────────

type Deposit = {
  id: string;
  display_name: string;
  email: string;
  amount_reais: number;
  status: string;
  orama_id: string | null;
  paid_at: string | null;
  created_at: string;
};

type Withdrawal = {
  id: string;
  kind: 'player' | 'affiliate';
  subject_name: string;
  subject_email: string;
  amount: number;
  net_amount: number;
  pix_key_type: string;
  pix_key: string;
  status: string;
  external_ref: string;
  admin_notes: string | null;
  created_at: string;
};

type Summary = {
  deposits_total: number;
  deposits_pending: number;
  player_wd_paid: number;
  player_wd_pending: number;
  affiliate_wd_paid: number;
  affiliate_wd_pending: number;
  net_revenue: number;
};

type MainTab = 'deposits' | 'withdrawals';

// ─── Constants ────────────────────────────────────────────────

const DEPOSIT_STATUS_FILTERS = [
  { key: null,       label: 'Todos'     },
  { key: 'paid',     label: 'Pagos'     },
  { key: 'pending',  label: 'Pendentes' },
  { key: 'expired',  label: 'Expirados' },
] as const;

type DepositStatus = typeof DEPOSIT_STATUS_FILTERS[number]['key'];

const WITHDRAWAL_STATUS_FILTERS = [
  { key: null,         label: 'Todos'       },
  { key: 'pending',    label: 'Em análise'  },
  { key: 'processing', label: 'Processando' },
  { key: 'paid',       label: 'Pagos'       },
  { key: 'rejected',   label: 'Recusados'   },
] as const;

type WithdrawalStatus = typeof WITHDRAWAL_STATUS_FILTERS[number]['key'];

const WITHDRAWAL_KIND_FILTERS = [
  { key: null,        label: 'Todos'     },
  { key: 'player',    label: 'Jogadores' },
  { key: 'affiliate', label: 'Afiliados' },
] as const;

type WithdrawalKind = typeof WITHDRAWAL_KIND_FILTERS[number]['key'];

const DEPOSIT_COLORS: Record<string, string> = {
  paid: '#22C55E', pending: '#F59E0B', refused: '#EF4444',
  expired: '#6B7280', refunded: '#8B5CF6',
};
const DEPOSIT_LABELS: Record<string, string> = {
  paid: 'Pago', pending: 'Pendente', refused: 'Recusado',
  expired: 'Expirado', refunded: 'Estornado',
};
const WD_COLORS: Record<string, string> = {
  pending: '#F59E0B', processing: '#60A5FA', paid: '#10B981',
  rejected: '#EF4444',
};
const WD_LABELS: Record<string, string> = {
  pending: 'Em análise', processing: 'Processando', paid: 'Pago', rejected: 'Recusado',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}
function fmtMoney(n: number) {
  return `R$ ${Number(n).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

function escapeCsv(v: unknown): string {
  const s = String(v ?? '').replace(/"/g, '""');
  return `"${s}"`;
}

function downloadCsv(filename: string, rows: string[][]): void {
  if (typeof window === 'undefined') return;
  const csv = rows.map(r => r.map(escapeCsv).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Component ───────────────────────────────────────────

export function AdminTransacoesView() {
  const [tab, setTab] = useState<MainTab>('deposits');
  const [summary, setSummary] = useState<Summary | null>(null);

  // Deposits state
  const [deposits,       setDeposits]       = useState<Deposit[]>([]);
  const [depositStatus,  setDepositStatus]  = useState<DepositStatus>(null);
  const [depositLoading, setDepositLoading] = useState(true);

  // Withdrawals state
  const [withdrawals,    setWithdrawals]    = useState<Withdrawal[]>([]);
  const [wdStatus,       setWdStatus]       = useState<WithdrawalStatus>(null);
  const [wdKind,         setWdKind]         = useState<WithdrawalKind>(null);
  const [wdLoading,      setWdLoading]      = useState(false);

  // CSV export
  const [exporting, setExporting] = useState(false);

  // Load summary
  useEffect(() => {
    supabase.rpc('admin_financial_summary').then(({ data }) => {
      if (data) setSummary(data as Summary);
    });
  }, []);

  // Load deposits
  const loadDeposits = useCallback(async () => {
    setDepositLoading(true);
    const { data } = await supabase.rpc('admin_list_deposits', {
      p_status: depositStatus ?? undefined,
      p_limit:  200,
      p_offset: 0,
    });
    if (data) setDeposits(data as Deposit[]);
    setDepositLoading(false);
  }, [depositStatus]);

  // Load withdrawals
  const loadWithdrawals = useCallback(async () => {
    setWdLoading(true);
    const { data } = await supabase.rpc('admin_list_all_withdrawals', {
      p_status: wdStatus   ?? null,
      p_kind:   wdKind     ?? null,
      p_limit:  200,
      p_offset: 0,
    });
    if (data) setWithdrawals(data as Withdrawal[]);
    setWdLoading(false);
  }, [wdStatus, wdKind]);

  useEffect(() => { loadDeposits(); }, [loadDeposits]);
  useEffect(() => {
    if (tab === 'withdrawals') loadWithdrawals();
  }, [tab, loadWithdrawals]);

  async function handleExport() {
    setExporting(true);
    try {
      if (tab === 'deposits') {
        const { data } = await supabase.rpc('admin_list_deposits', {
          p_status: depositStatus ?? undefined,
          p_limit:  10000,
          p_offset: 0,
        });
        const rows = data as Deposit[] ?? [];
        downloadCsv('depositos.csv', [
          ['ID', 'Jogador', 'Email', 'Valor (R$)', 'Status', 'OramaPay ID', 'Data'],
          ...rows.map(d => [
            d.id,
            d.display_name,
            d.email,
            Number(d.amount_reais).toFixed(2),
            d.status,
            d.orama_id ?? '',
            d.paid_at ?? d.created_at,
          ]),
        ]);
      } else {
        const { data } = await supabase.rpc('admin_list_all_withdrawals', {
          p_status: wdStatus ?? null,
          p_kind:   wdKind   ?? null,
          p_limit:  10000,
          p_offset: 0,
        });
        const rows = data as Withdrawal[] ?? [];
        downloadCsv('saques.csv', [
          ['ID', 'Tipo', 'Nome', 'Email', 'Valor (R$)', 'Líquido (R$)', 'Chave PIX', 'Tipo Chave', 'Status', 'Referência', 'Data'],
          ...rows.map(w => [
            w.id,
            w.kind === 'player' ? 'Jogador' : 'Afiliado',
            w.subject_name,
            w.subject_email,
            Number(w.amount).toFixed(2),
            Number(w.net_amount).toFixed(2),
            w.pix_key,
            w.pix_key_type,
            w.status,
            w.external_ref,
            w.created_at,
          ]),
        ]);
      }
    } finally {
      setExporting(false);
    }
  }

  function handleRefresh() {
    supabase.rpc('admin_financial_summary').then(({ data }) => {
      if (data) setSummary(data as Summary);
    });
    if (tab === 'deposits') loadDeposits();
    else loadWithdrawals();
  }

  return (
    <View style={styles.root}>
      {/* ── Page header ─────────────────────────────── */}
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Transações</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={handleExport}
            disabled={exporting}
            style={({ pressed }) => [styles.iconBtn, styles.exportBtn, pressed && { opacity: 0.7 }, exporting && { opacity: 0.5 }]}
          >
            {exporting
              ? <ActivityIndicator size="small" color={theme.colors.primary} />
              : <>
                  <MaterialCommunityIcons name="download-outline" size={16} color={theme.colors.primary} />
                  <Text style={styles.exportBtnText}>CSV</Text>
                </>
            }
          </Pressable>
          <Pressable onPress={handleRefresh} style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}>
            <MaterialCommunityIcons name="refresh" size={20} color={theme.colors.textMuted} />
          </Pressable>
        </View>
      </View>

      {/* ── Summary cards ───────────────────────────── */}
      {summary && (
        <View style={styles.summaryRow}>
          <SummaryCard
            label="Depósitos recebidos"
            value={fmtMoney(summary.deposits_total)}
            sub={`${fmtMoney(summary.deposits_pending)} pendente`}
            color="#22C55E"
            icon="bank-transfer-in"
          />
          <SummaryCard
            label="Saques pagos"
            value={fmtMoney(Number(summary.player_wd_paid) + Number(summary.affiliate_wd_paid))}
            sub={`${fmtMoney(Number(summary.player_wd_pending) + Number(summary.affiliate_wd_pending))} pendente`}
            color="#EF4444"
            icon="bank-transfer-out"
          />
          <SummaryCard
            label="Receita líquida"
            value={fmtMoney(summary.net_revenue)}
            sub="depósitos − saques pagos"
            color={Number(summary.net_revenue) >= 0 ? '#22C55E' : '#EF4444'}
            icon="cash-multiple"
          />
        </View>
      )}

      {/* ── Main tabs ───────────────────────────────── */}
      <View style={styles.mainTabs}>
        {([
          { key: 'deposits',    label: 'Depósitos',  icon: 'bank-transfer-in'  },
          { key: 'withdrawals', label: 'Saques',      icon: 'bank-transfer-out' },
        ] as const).map(t => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[styles.mainTab, tab === t.key && styles.mainTabActive]}
          >
            <MaterialCommunityIcons
              name={t.icon}
              size={16}
              color={tab === t.key ? theme.colors.primary : theme.colors.textFaint}
            />
            <Text style={[styles.mainTabText, tab === t.key && styles.mainTabTextActive]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Deposits tab ────────────────────────────── */}
      {tab === 'deposits' && (
        <>
          <View style={styles.filters}>
            {DEPOSIT_STATUS_FILTERS.map(f => (
              <Pressable
                key={String(f.key)}
                onPress={() => setDepositStatus(f.key)}
                style={[styles.chip, depositStatus === f.key && styles.chipActive]}
              >
                <Text style={[styles.chipText, depositStatus === f.key && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {depositLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : deposits.length === 0 ? (
            <View style={styles.centered}>
              <MaterialCommunityIcons name="credit-card-off-outline" size={40} color={theme.colors.textFaint} />
              <Text style={styles.emptyText}>Nenhum depósito encontrado.</Text>
            </View>
          ) : (
            <FlatList
              data={deposits}
              keyExtractor={d => d.id}
              contentContainerStyle={styles.list}
              ItemSeparatorComponent={() => <View style={styles.sep} />}
              renderItem={({ item }) => {
                const color = DEPOSIT_COLORS[item.status] ?? theme.colors.textFaint;
                return (
                  <View style={styles.row}>
                    <View style={styles.rowLeft}>
                      <View style={[styles.dot, { backgroundColor: color }]} />
                      <View style={styles.rowInfo}>
                        <Text style={styles.rowName}>{item.display_name}</Text>
                        <Text style={styles.rowEmail}>{item.email}</Text>
                        <Text style={styles.rowDate}>{fmtDate(item.created_at)}</Text>
                      </View>
                    </View>
                    <View style={styles.rowRight}>
                      <Text style={[styles.rowAmount, { color: item.status === 'paid' ? '#22C55E' : theme.colors.text }]}>
                        {fmtMoney(Number(item.amount_reais))}
                      </Text>
                      <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
                        <Text style={[styles.badgeText, { color }]}>
                          {DEPOSIT_LABELS[item.status] ?? item.status}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </>
      )}

      {/* ── Withdrawals tab ─────────────────────────── */}
      {tab === 'withdrawals' && (
        <>
          <View style={styles.filters}>
            {WITHDRAWAL_KIND_FILTERS.map(f => (
              <Pressable
                key={String(f.key)}
                onPress={() => setWdKind(f.key)}
                style={[styles.chip, wdKind === f.key && styles.chipActive]}
              >
                <Text style={[styles.chipText, wdKind === f.key && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
            <View style={styles.filterDivider} />
            {WITHDRAWAL_STATUS_FILTERS.map(f => (
              <Pressable
                key={String(f.key)}
                onPress={() => setWdStatus(f.key)}
                style={[styles.chip, wdStatus === f.key && styles.chipActive]}
              >
                <Text style={[styles.chipText, wdStatus === f.key && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {wdLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : withdrawals.length === 0 ? (
            <View style={styles.centered}>
              <MaterialCommunityIcons name="bank-transfer-out" size={40} color={theme.colors.textFaint} />
              <Text style={styles.emptyText}>Nenhum saque encontrado.</Text>
            </View>
          ) : (
            <FlatList
              data={withdrawals}
              keyExtractor={w => w.id}
              contentContainerStyle={styles.list}
              ItemSeparatorComponent={() => <View style={styles.sep} />}
              renderItem={({ item: wd }) => {
                const color = WD_COLORS[wd.status] ?? theme.colors.textFaint;
                return (
                  <View style={styles.row}>
                    <View style={styles.rowLeft}>
                      <View style={[styles.dot, { backgroundColor: color }]} />
                      <View style={styles.rowInfo}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.rowName}>{wd.subject_name}</Text>
                          <View style={[styles.kindBadge, wd.kind === 'affiliate' && styles.kindBadgeAfil]}>
                            <Text style={[styles.kindText, wd.kind === 'affiliate' && styles.kindTextAfil]}>
                              {wd.kind === 'player' ? 'Jogador' : 'Afiliado'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.rowEmail}>{wd.subject_email}</Text>
                        <Text style={styles.rowDate}>{fmtDate(wd.created_at)}</Text>
                      </View>
                    </View>
                    <View style={styles.rowRight}>
                      <Text style={[styles.rowAmount, { color: wd.status === 'paid' ? '#10B981' : theme.colors.text }]}>
                        {fmtMoney(Number(wd.net_amount))}
                      </Text>
                      <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
                        <Text style={[styles.badgeText, { color }]}>
                          {WD_LABELS[wd.status] ?? wd.status}
                        </Text>
                      </View>
                      <Text style={styles.pixKey} numberOfLines={1}>
                        {wd.pix_key_type} · {wd.pix_key}
                      </Text>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </>
      )}
    </View>
  );
}

function SummaryCard({
  label, value, sub, color, icon,
}: {
  label: string; value: string; sub: string; color: string; icon: string;
}) {
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryCardTop}>
        <MaterialCommunityIcons name={icon as any} size={16} color={color} />
        <Text style={styles.summaryCardLabel}>{label}</Text>
      </View>
      <Text style={[styles.summaryCardValue, { color }]}>{value}</Text>
      <Text style={styles.summaryCardSub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },

  pageHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: theme.spacing.xl,
    borderBottomWidth: 1, borderBottomColor: theme.colors.outline,
  },
  pageTitle: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 26 },
  iconBtn: { padding: theme.spacing.sm, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1, borderColor: theme.colors.primary,
  },
  exportBtnText: { color: theme.colors.primary, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 12 },

  // Summary
  summaryRow: {
    flexDirection: 'row', gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.md,
    borderBottomWidth: 1, borderBottomColor: theme.colors.outline,
  },
  summaryCard: {
    flex: 1, backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md, padding: theme.spacing.md,
    gap: 3, borderWidth: 1, borderColor: theme.colors.outline,
  },
  summaryCardTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryCardLabel: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 },
  summaryCardValue: { fontFamily: theme.typography.fontFamily.displayMedium, fontSize: 18 },
  summaryCardSub:   { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 11 },

  // Main tabs
  mainTabs: {
    flexDirection: 'row', gap: 0,
    borderBottomWidth: 1, borderBottomColor: theme.colors.outline,
    paddingHorizontal: theme.spacing.xl,
  },
  mainTab: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingVertical: 13, paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  mainTabActive: { borderBottomColor: theme.colors.primary },
  mainTabText: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 14 },
  mainTabTextActive: { color: theme.colors.primary, fontFamily: theme.typography.fontFamily.bodySemiBold },

  // Filters
  filters: {
    flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1, borderBottomColor: theme.colors.outline,
    alignItems: 'center',
  },
  filterDivider: { width: 1, height: 20, backgroundColor: theme.colors.outline },
  chip:         { paddingHorizontal: theme.spacing.md, paddingVertical: 6, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.outline },
  chipActive:   { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
  chipText:     { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 12 },
  chipTextActive: { color: theme.colors.primary, fontFamily: theme.typography.fontFamily.bodySemiBold },

  // List
  list: { paddingHorizontal: theme.spacing.xl, paddingBottom: 60 },
  sep: { height: 1, backgroundColor: theme.colors.outline },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: theme.spacing.md, gap: theme.spacing.md,
  },
  rowLeft:  { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, flex: 1, minWidth: 0 },
  rowRight: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  dot:      { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  rowInfo:  { flex: 1, minWidth: 0, gap: 2 },
  rowName:  { color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 14 },
  rowEmail: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 11 },
  rowDate:  { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 10 },
  rowAmount: { fontFamily: theme.typography.fontFamily.displayMedium, fontSize: 16 },
  pixKey:   { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 10, maxWidth: 160 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.radius.pill, borderWidth: 1 },
  badgeText: { fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },

  kindBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    backgroundColor: theme.colors.surfaceHigh,
  },
  kindBadgeAfil: { backgroundColor: theme.colors.primarySoft },
  kindText:     { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 9, textTransform: 'uppercase' },
  kindTextAfil: { color: theme.colors.primary },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md, paddingTop: 80 },
  emptyText: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 14 },
});

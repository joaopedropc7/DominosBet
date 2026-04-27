import { useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { adminGetDashboard } from '@/services/admin';
import { supabase } from '@/services/supabase';
import { theme } from '@/theme';
import type { AdminDashboardData } from '@/types/database';
import { formatCoins } from '@/utils/format';

// ─── Types ────────────────────────────────────────────────────

type ChartDay = {
  day: string;               // 'YYYY-MM-DD'
  deposits_total: number;
  deposits_count: number;
  player_wd_total: number;
  affiliate_wd_total: number;
  net_revenue: number;
};

// ─── Helpers ──────────────────────────────────────────────────

function fmtMoney(n: number) {
  return `R$ ${Number(n).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

function fmtDayLabel(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Bar chart component ──────────────────────────────────────

type BarSeries = { color: string; values: number[] };

function BarChart({
  series,
  labels,
  height = 120,
}: {
  series: BarSeries[];
  labels: string[];
  height?: number;
}) {
  const allVals = series.flatMap(s => s.values);
  const maxVal  = Math.max(...allVals, 1);

  // Show every Nth label to avoid crowding
  const step = labels.length > 14 ? Math.ceil(labels.length / 7) : 1;

  return (
    <View style={{ gap: 6 }}>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
        {labels.map((_, i) => (
          <View key={i} style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 1 }}>
            {series.map((s, si) => {
              const pct = maxVal > 0 ? (s.values[i] ?? 0) / maxVal : 0;
              return (
                <View
                  key={si}
                  style={{
                    flex: 1,
                    height: Math.max(pct * height, s.values[i] > 0 ? 2 : 0),
                    backgroundColor: s.color,
                    borderRadius: 2,
                    opacity: 0.85,
                  }}
                />
              );
            })}
          </View>
        ))}
      </View>
      {/* X-axis labels */}
      <View style={{ flexDirection: 'row' }}>
        {labels.map((l, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            {i % step === 0 ? (
              <Text style={chartStyles.axisLabel}>{l}</Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  axisLabel: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: 9,
  },
});

// ─── Legend pill ──────────────────────────────────────────────

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 11 }}>
        {label}
      </Text>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────

export function AdminDashboardView() {
  const [data,      setData]      = useState<AdminDashboardData | null>(null);
  const [chart,     setChart]     = useState<ChartDay[]>([]);
  const [days,      setDays]      = useState(30);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [error,     setError]     = useState('');

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [dashRes, chartRes] = await Promise.all([
        adminGetDashboard(),
        supabase.rpc('admin_chart_data', { p_days: days }),
      ]);
      setData(dashRes);
      if (chartRes.data) setChart(chartRes.data as ChartDay[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, [days]);

  // Derived chart data
  const chartLabels   = chart.map(d => fmtDayLabel(d.day));
  const depositValues = chart.map(d => Number(d.deposits_total));
  const playerWd      = chart.map(d => Number(d.player_wd_total));
  const affiliateWd   = chart.map(d => Number(d.affiliate_wd_total));
  const netValues     = chart.map(d => Number(d.net_revenue));
  const totalDeposits = depositValues.reduce((a, b) => a + b, 0);
  const totalWd       = chart.reduce((a, d) => a + Number(d.player_wd_total) + Number(d.affiliate_wd_total), 0);
  const totalNet      = netValues.reduce((a, b) => a + b, 0);

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(true); }}
          tintColor={theme.colors.primary}
        />
      }
    >
      {/* Page header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Dashboard</Text>
          <Text style={styles.pageSubtitle}>Visão geral da plataforma</Text>
        </View>
        <Pressable
          onPress={() => load(true)}
          style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.7 }]}
        >
          <MaterialCommunityIcons name="refresh" size={18} color={theme.colors.textMuted} />
        </Pressable>
      </View>

      {loading && !data ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 60 }} />
      ) : error ? (
        <View style={styles.errorBox}>
          <MaterialCommunityIcons name="alert-circle-outline" size={20} color={theme.colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : data ? (
        <>
          {/* KPI row */}
          <View style={styles.kpiRow}>
            <KpiCard icon="account-group"   label="Usuários totais"      value={String(data.total_users)}        accent />
            <KpiCard icon="gamepad-variant" label="Partidas jogadas"     value={String(data.total_matches)}              />
            <KpiCard icon="cash-multiple"   label="Moedas em circulação" value={formatCoins(data.total_coins)}   accent />
            <KpiCard icon="link-variant"    label="Usos de afiliados"    value={String(data.affiliate_uses)}             />
          </View>

          {/* New users row */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Novos cadastros</Text>
            <View style={styles.kpiRow}>
              <KpiCard icon="account-plus"  label="Hoje"         value={String(data.new_users_today)} />
              <KpiCard icon="calendar-week" label="Esta semana"  value={String(data.new_users_week)}  />
              <KpiCard icon="link-box"      label="Links ativos" value={String(data.total_affiliates)}/>
            </View>
          </View>

          {/* Period selector */}
          <View style={styles.section}>
            <View style={styles.chartHeader}>
              <Text style={styles.sectionTitle}>Financeiro</Text>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {([7, 14, 30] as const).map(d => (
                  <Pressable
                    key={d}
                    onPress={() => setDays(d)}
                    style={[styles.periodChip, days === d && styles.periodChipActive]}
                  >
                    <Text style={[styles.periodChipText, days === d && styles.periodChipTextActive]}>
                      {d}d
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Summary numbers */}
            <View style={styles.kpiRow}>
              <View style={styles.miniCard}>
                <Text style={styles.miniLabel}>Depósitos</Text>
                <Text style={[styles.miniValue, { color: '#22C55E' }]}>{fmtMoney(totalDeposits)}</Text>
              </View>
              <View style={styles.miniCard}>
                <Text style={styles.miniLabel}>Saques</Text>
                <Text style={[styles.miniValue, { color: '#EF4444' }]}>{fmtMoney(totalWd)}</Text>
              </View>
              <View style={styles.miniCard}>
                <Text style={styles.miniLabel}>Líquido</Text>
                <Text style={[styles.miniValue, { color: totalNet >= 0 ? '#22C55E' : '#EF4444' }]}>
                  {fmtMoney(totalNet)}
                </Text>
              </View>
            </View>

            {/* Deposits vs Withdrawals chart */}
            {chart.length > 0 ? (
              <>
                <View style={styles.chartCard}>
                  <Text style={styles.chartCardTitle}>Depósitos × Saques (R$)</Text>
                  <BarChart
                    series={[
                      { color: '#22C55E', values: depositValues },
                      { color: '#EF4444', values: playerWd.map((v, i) => v + affiliateWd[i]) },
                    ]}
                    labels={chartLabels}
                  />
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                    <Legend color="#22C55E" label="Depósitos" />
                    <Legend color="#EF4444" label="Saques" />
                  </View>
                </View>

                {/* Net revenue chart */}
                <View style={styles.chartCard}>
                  <Text style={styles.chartCardTitle}>Receita Líquida (R$)</Text>
                  <BarChart
                    series={[{ color: theme.colors.primary, values: netValues }]}
                    labels={chartLabels}
                  />
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                    <Legend color={theme.colors.primary} label="Receita líquida" />
                  </View>
                </View>

                {/* Breakdown chart */}
                <View style={styles.chartCard}>
                  <Text style={styles.chartCardTitle}>Saques por tipo (R$)</Text>
                  <BarChart
                    series={[
                      { color: '#60A5FA', values: playerWd },
                      { color: '#A78BFA', values: affiliateWd },
                    ]}
                    labels={chartLabels}
                  />
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                    <Legend color="#60A5FA" label="Jogadores" />
                    <Legend color="#A78BFA" label="Afiliados" />
                  </View>
                </View>
              </>
            ) : null}
          </View>

          {/* Quick access */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Acesso rápido</Text>
            <View style={styles.quickGrid}>
              <QuickCard
                icon="account-search"
                label="Gerenciar usuários"
                description="Buscar, editar saldo e banir contas"
                onPress={() => router.push('/admin/usuarios')}
              />
              <QuickCard
                icon="link-box-outline"
                label="Links de afiliado"
                description="Criar e monitorar campanhas"
                onPress={() => router.push('/admin/afiliados')}
              />
            </View>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function KpiCard({
  icon, label, value, accent = false,
}: {
  icon: string; label: string; value: string; accent?: boolean;
}) {
  return (
    <View style={[styles.kpiCard, accent && styles.kpiCardAccent]}>
      <View style={[styles.kpiIcon, accent && styles.kpiIconAccent]}>
        <MaterialCommunityIcons
          name={icon as any}
          size={18}
          color={accent ? theme.colors.primary : theme.colors.textMuted}
        />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function QuickCard({
  icon, label, description, onPress,
}: {
  icon: string; label: string; description: string; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickCard, pressed && { opacity: 0.8 }]}>
      <LinearGradient
        colors={[theme.colors.surface, theme.colors.surfaceMuted]}
        style={styles.quickCardInner}
      >
        <View style={styles.quickIcon}>
          <MaterialCommunityIcons name={icon as any} size={22} color={theme.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.quickLabel}>{label}</Text>
          <Text style={styles.quickDesc}>{description}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.textFaint} />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: theme.spacing.xl,
    gap: theme.spacing.xl,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  pageTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 26,
  },
  pageSubtitle: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
    marginTop: 2,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    flexWrap: 'wrap',
  },
  kpiCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    padding: theme.spacing.md,
    gap: 6,
  },
  kpiCardAccent: {
    borderColor: 'rgba(242,202,80,0.25)',
  },
  kpiIcon: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  kpiIconAccent: {
    backgroundColor: theme.colors.primarySoft,
  },
  kpiValue: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 28,
  },
  kpiLabel: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 12,
  },
  section: {
    gap: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  periodChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  periodChipActive: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
  },
  periodChipText: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 11,
  },
  periodChipTextActive: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.bodySemiBold,
  },
  miniCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    padding: theme.spacing.sm,
    gap: 3,
    alignItems: 'center',
  },
  miniLabel: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  miniValue: {
    fontFamily: theme.typography.fontFamily.displayMedium,
    fontSize: 15,
  },
  chartCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  chartCardTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 13,
  },
  quickGrid: {
    gap: theme.spacing.sm,
  },
  quickCard: {
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
  },
  quickCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderRadius: theme.radius.lg,
  },
  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
  },
  quickDesc: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: 12,
    marginTop: 2,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: 'rgba(255,139,135,0.10)',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.danger,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
    flex: 1,
  },
});

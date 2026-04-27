import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import { theme } from '@/theme';

// ─── Types ────────────────────────────────────────────────────

type Metrics = {
  balance: number;
  total_earned: number;
  total_withdrawn: number;
  registros: number;
  ftds: number;
  deposit_total_sum: number;
  revshare_percent: number;
  cpa_amount: number;
  sub_affiliate_percent: number;
};

type ChartDay = {
  day: string;
  commissions: number;
  withdrawals: number;
};

// ─── Helpers ──────────────────────────────────────────────────

function fmt(n: number) {
  return `R$ ${Number(n).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

function fmtDayLabel(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Bar chart ────────────────────────────────────────────────

type BarSeries = { color: string; values: number[] };

function BarChart({ series, labels, height = 100 }: { series: BarSeries[]; labels: string[]; height?: number }) {
  const allVals = series.flatMap(s => s.values);
  const maxVal  = Math.max(...allVals, 1);
  const step    = labels.length > 14 ? Math.ceil(labels.length / 7) : 1;

  return (
    <View style={{ gap: 4 }}>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
        {labels.map((_, i) => (
          <View key={i} style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 1 }}>
            {series.map((s, si) => {
              const pct = (s.values[i] ?? 0) / maxVal;
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

// ─── Metric card ──────────────────────────────────────────────

function MetricCard({ title, value, sub, icon, color }: {
  title: string; value: string; sub?: string; icon: string; color: string;
}) {
  return (
    <View style={[cardStyles.card, { borderTopColor: color }]}>
      <View style={cardStyles.header}>
        <MaterialCommunityIcons name={icon as any} size={16} color={color} />
        <Text style={cardStyles.title}>{title}</Text>
      </View>
      <Text style={cardStyles.value}>{value}</Text>
      {sub ? <Text style={[cardStyles.sub, { color }]}>{sub}</Text> : null}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    flex: 1, minWidth: 160,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.outline,
    borderTopWidth: 3,
    padding: theme.spacing.md, gap: 4,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 12 },
  value: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 26, marginTop: 2 },
  sub:   { fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 11 },
});

// ─── Main component ───────────────────────────────────────────

export function AffiliateDashboardView() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [chart,   setChart]   = useState<ChartDay[]>([]);
  const [days,    setDays]    = useState(30);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [metricsRes, chartRes] = await Promise.all([
      supabase.rpc('get_affiliate_dashboard', { p_from: null, p_to: null }),
      supabase.rpc('affiliate_chart_data', { p_days: days }),
    ]);
    if (metricsRes.data) setMetrics(metricsRes.data as Metrics);
    if (chartRes.data)   setChart(chartRes.data as ChartDay[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [days]);

  const chartLabels    = chart.map(d => fmtDayLabel(d.day));
  const commValues     = chart.map(d => Number(d.commissions));
  const wdValues       = chart.map(d => Number(d.withdrawals));
  const totalComm      = commValues.reduce((a, b) => a + b, 0);
  const totalWd        = wdValues.reduce((a, b) => a + b, 0);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      {loading || !metrics ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <>
          {/* Metric cards */}
          <View style={styles.cardsRow}>
            <MetricCard
              title="Saldo disponível"
              value={fmt(Number(metrics.balance))}
              icon="wallet-outline"
              color={theme.colors.primary}
            />
            <MetricCard
              title="Total ganho"
              value={fmt(Number(metrics.total_earned))}
              sub={`${metrics.ftds} FTD${metrics.ftds !== 1 ? 's' : ''}`}
              icon="currency-usd"
              color="#34D399"
            />
            <MetricCard
              title="Total sacado"
              value={fmt(Number(metrics.total_withdrawn))}
              icon="bank-transfer-out"
              color="#60A5FA"
            />
          </View>

          <View style={styles.cardsRow}>
            <MetricCard
              title="Indicados"
              value={String(metrics.registros)}
              sub={`${metrics.ftds} depositaram`}
              icon="account-plus-outline"
              color="#A78BFA"
            />
            <MetricCard
              title="Depósitos tragos"
              value={fmt(Number(metrics.deposit_total_sum))}
              icon="cash-plus"
              color="#FB923C"
            />
          </View>

          {/* Deal info */}
          <View style={styles.dealCard}>
            <View style={styles.dealItem}>
              <MaterialCommunityIcons name="tag-outline" size={14} color={theme.colors.primary} />
              <Text style={styles.dealLabel}>CPA</Text>
              <Text style={styles.dealValue}>R$ {Number(metrics.cpa_amount).toFixed(2).replace('.', ',')}</Text>
              <Text style={styles.dealSub}>por FTD</Text>
            </View>
            <View style={styles.dealDivider} />
            <View style={styles.dealItem}>
              <MaterialCommunityIcons name="chart-line" size={14} color="#34D399" />
              <Text style={styles.dealLabel}>RevShare</Text>
              <Text style={[styles.dealValue, { color: '#34D399' }]}>{metrics.revshare_percent}%</Text>
              <Text style={styles.dealSub}>das perdas</Text>
            </View>
          </View>

          {/* Chart section */}
          <View style={styles.chartSection}>
            <View style={styles.chartHeader}>
              <Text style={styles.sectionTitle}>Histórico financeiro</Text>
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

            {/* Summary mini cards */}
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <View style={styles.miniCard}>
                <Text style={styles.miniLabel}>Comissões</Text>
                <Text style={[styles.miniValue, { color: theme.colors.primary }]}>{fmt(totalComm)}</Text>
              </View>
              <View style={styles.miniCard}>
                <Text style={styles.miniLabel}>Saques</Text>
                <Text style={[styles.miniValue, { color: '#60A5FA' }]}>{fmt(totalWd)}</Text>
              </View>
            </View>

            {chart.length > 0 ? (
              <View style={styles.chartCard}>
                <Text style={styles.chartCardTitle}>Comissões × Saques (R$)</Text>
                <BarChart
                  series={[
                    { color: theme.colors.primary, values: commValues },
                    { color: '#60A5FA',              values: wdValues   },
                  ]}
                  labels={chartLabels}
                />
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                  <Legend color={theme.colors.primary} label="Comissões" />
                  <Legend color="#60A5FA"              label="Saques"    />
                </View>
              </View>
            ) : (
              <View style={styles.emptyChart}>
                <MaterialCommunityIcons name="chart-bar" size={32} color={theme.colors.textFaint} />
                <Text style={styles.emptyChartText}>Nenhum dado para exibir</Text>
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },

  cardsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },

  dealCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.outline,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dealItem:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  dealDivider: { width: 1, height: 24, backgroundColor: theme.colors.outline, marginHorizontal: 8 },
  dealLabel:   { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 12 },
  dealValue:   { color: theme.colors.primary, fontFamily: theme.typography.fontFamily.display, fontSize: 18 },
  dealSub:     { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 11 },

  chartSection: { gap: theme.spacing.md },
  chartHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2,
  },
  periodChip: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: theme.radius.pill,
    borderWidth: 1, borderColor: theme.colors.outline,
  },
  periodChipActive:     { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
  periodChipText:       { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 11 },
  periodChipTextActive: { color: theme.colors.primary, fontFamily: theme.typography.fontFamily.bodySemiBold },

  miniCard: {
    flex: 1, backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.outline,
    padding: theme.spacing.sm, gap: 3, alignItems: 'center',
  },
  miniLabel: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
  miniValue: { fontFamily: theme.typography.fontFamily.displayMedium, fontSize: 15 },

  chartCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.outline,
    padding: theme.spacing.md, gap: theme.spacing.sm,
  },
  chartCardTitle: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 13 },

  emptyChart: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  emptyChartText: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 13 },
});

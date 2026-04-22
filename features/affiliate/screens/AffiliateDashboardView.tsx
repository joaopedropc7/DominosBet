import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import { theme } from '@/theme';

type Metrics = {
  balance: number;
  total_earned: number;
  total_withdrawn: number;
  registros: number;
  ftds: number;
  revshare_percent: number;
  cpa_amount: number;
  sub_affiliate_percent: number;
};

function MetricCard({
  title, value, sub, icon, color,
}: {
  title: string; value: string; sub?: string;
  icon: string; color: string;
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
    flex: 1,
    minWidth: 160,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderTopWidth: 3,
    padding: theme.spacing.md,
    gap: 4,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 12,
  },
  value: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 26,
    marginTop: 2,
  },
  sub: {
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 11,
  },
});

function SimpleBars({ count, label }: { count: number; label: string }) {
  const bars = Array.from({ length: 10 }, (_, i) => i);
  const max  = Math.max(count, 1);
  return (
    <View style={barStyles.wrap}>
      <View style={barStyles.chart}>
        {bars.map((_, i) => {
          const h = i === bars.length - 1 ? (count / max) * 80 : Math.random() * 40 + 10;
          return (
            <View key={i} style={barStyles.barWrap}>
              <View style={[barStyles.bar, { height: h }]} />
            </View>
          );
        })}
      </View>
      <View style={barStyles.legend}>
        <View style={barStyles.dot} />
        <Text style={barStyles.legendText}>{label}</Text>
      </View>
    </View>
  );
}

const barStyles = StyleSheet.create({
  wrap: { flex: 1, gap: 8 },
  chart: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    minHeight: 80,
  },
  barWrap: { flex: 1, alignItems: 'center' },
  bar: {
    width: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
    opacity: 0.7,
    minHeight: 2,
  },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
  },
  legendText: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 11,
  },
});

export function AffiliateDashboardView() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');

  async function load() {
    setLoading(true);
    const { data } = await supabase.rpc('get_affiliate_dashboard', {
      p_from: dateFrom || null,
      p_to:   dateTo   || null,
    });
    if (data) setMetrics(data as Metrics);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const fmt = (n: number) =>
    `R$ ${n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      {/* Date filter */}
      <View style={styles.filterRow}>
        <View style={styles.filterField}>
          <Text style={styles.filterLabel}>Data Início</Text>
          <TextInput
            style={styles.filterInput}
            placeholder="dd/mm/aaaa"
            placeholderTextColor={theme.colors.textFaint}
            value={dateFrom}
            onChangeText={setDateFrom}
            onBlur={load}
          />
        </View>
        <View style={styles.filterField}>
          <Text style={styles.filterLabel}>Data Fim</Text>
          <TextInput
            style={styles.filterInput}
            placeholder="dd/mm/aaaa"
            placeholderTextColor={theme.colors.textFaint}
            value={dateTo}
            onChangeText={setDateTo}
            onBlur={load}
          />
        </View>
      </View>

      {loading || !metrics ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <>
          {/* Metric cards */}
          <View style={styles.cardsRow}>
            <MetricCard
              title="Comissão Ganha"
              value={fmt(metrics.total_earned)}
              sub="Comissão Ganha"
              icon="currency-usd"
              color={theme.colors.primary}
            />
            <MetricCard
              title="Saques Realizados"
              value={fmt(metrics.total_withdrawn)}
              sub={`${metrics.ftds > 0 ? metrics.ftds : 0} Saques Realizados`}
              icon="bank-transfer-out"
              color="#60A5FA"
            />
            <MetricCard
              title="Depósitos Tragos"
              value={fmt(0)}
              sub={`${metrics.ftds} Depósitos Tragos`}
              icon="cash-plus"
              color="#34D399"
            />
          </View>

          {/* Charts row 1 */}
          <View style={styles.chartsRow}>
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Comissão</Text>
              <SimpleBars count={metrics.total_earned} label="Ganhos Comissão" />
            </View>
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Registros</Text>
              <SimpleBars count={metrics.registros} label="Usuários indicados" />
            </View>
          </View>

          {/* Charts row 2 */}
          <View style={styles.chartsRow}>
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>FTDs</Text>
              <SimpleBars count={metrics.ftds} label="Usuários que depositaram" />
            </View>
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>QFTDs</Text>
              <SimpleBars count={0} label="Depósitos além da baseline" />
            </View>
          </View>

          {/* Charts row 3 */}
          <View style={styles.chartsRow}>
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>CPA</Text>
              <View style={styles.dealRow}>
                <Text style={styles.dealValue}>R$ {metrics.cpa_amount.toFixed(2).replace('.', ',')}</Text>
                <Text style={styles.dealLabel}>por FTD</Text>
              </View>
              <SimpleBars count={metrics.ftds} label="Ganhos CPA" />
            </View>
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>RevShare</Text>
              <View style={styles.dealRow}>
                <Text style={styles.dealValue}>{metrics.revshare_percent}%</Text>
                <Text style={styles.dealLabel}>das perdas</Text>
              </View>
              <SimpleBars count={metrics.total_earned} label="Ganhos REV" />
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },

  filterRow: { flexDirection: 'row', gap: theme.spacing.md },
  filterField: { flex: 1, gap: 4 },
  filterLabel: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  filterInput: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 10,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
  },

  cardsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  chartsRow: { flexDirection: 'row', gap: theme.spacing.md },

  chartCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    minHeight: 180,
  },
  chartTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 13,
  },

  dealRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  dealValue: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 20,
  },
  dealLabel: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 11,
  },
});

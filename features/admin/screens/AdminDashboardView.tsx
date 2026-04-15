import { useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { adminGetDashboard } from '@/services/admin';
import { theme } from '@/theme';
import type { AdminDashboardData } from '@/types/database';
import { formatCoins } from '@/utils/format';

export function AdminDashboardView() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError('');
    try {
      setData(await adminGetDashboard());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

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
            <KpiCard icon="account-group"  label="Usuários totais"     value={String(data.total_users)}         accent />
            <KpiCard icon="gamepad-variant" label="Partidas jogadas"    value={String(data.total_matches)}               />
            <KpiCard icon="cash-multiple"   label="Moedas em circulação" value={formatCoins(data.total_coins)}   accent />
            <KpiCard icon="link-variant"    label="Usos de afiliados"   value={String(data.affiliate_uses)}              />
          </View>

          {/* Secondary row */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Novos cadastros</Text>
            <View style={styles.kpiRow}>
              <KpiCard icon="account-plus"   label="Hoje"         value={String(data.new_users_today)} />
              <KpiCard icon="calendar-week"  label="Esta semana"  value={String(data.new_users_week)}  />
              <KpiCard icon="link-box"       label="Links ativos" value={String(data.total_affiliates)}/>
            </View>
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

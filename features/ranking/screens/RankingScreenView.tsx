import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Avatar } from '@/components/base/Avatar';
import { Screen } from '@/components/base/Screen';
import { useAuth } from '@/hooks/useAuth';
import { getLeaderboard, type LeaderboardEntry } from '@/services/ranking';
import { theme } from '@/theme';

const MEDAL: Record<number, { icon: 'trophy' | 'medal' | 'medal-outline'; color: string }> = {
  1: { icon: 'trophy',        color: '#F2CA50' },
  2: { icon: 'medal',         color: '#C0C0C0' },
  3: { icon: 'medal-outline', color: '#CD7F32' },
};

export function RankingScreenView() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getLeaderboard(50);
      setEntries(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar ranking.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const myPosition = entries.find(e => e.id === user?.id)?.rank_pos ?? 0;

  return (
    <Screen>
      {/* Header */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color={theme.colors.textMuted} />
        </Pressable>
        <Text style={styles.title}>Ranking</Text>
        <View style={styles.backBtn} pointerEvents="none" />
      </View>

      {myPosition > 0 && (
        <View style={styles.myPositionBanner}>
          <MaterialCommunityIcons name="account-outline" size={14} color={theme.colors.primary} />
          <Text style={styles.myPositionText}>
            Você está em <Text style={styles.myPositionBold}>#{myPosition}º lugar</Text>
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : error !== '' ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="alert-circle-outline" size={40} color={theme.colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={load} style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.7 }]}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="trophy-outline" size={48} color={theme.colors.textFaint} />
          <Text style={styles.emptyTitle}>Nenhum jogador ainda</Text>
          <Text style={styles.emptySubtitle}>Jogue partidas para aparecer no ranking.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {entries.map((entry) => {
            const isMe  = entry.id === user?.id;
            const pos   = Number(entry.rank_pos);
            const medal = MEDAL[pos];

            return (
              <View
                key={entry.id}
                style={[styles.row, isMe && styles.rowMe]}
              >
                {/* Position */}
                <View style={styles.posWrap}>
                  {medal ? (
                    <MaterialCommunityIcons name={medal.icon} size={22} color={medal.color} />
                  ) : (
                    <Text style={[styles.posText, isMe && styles.posTextMe]}>#{pos}</Text>
                  )}
                </View>

                {/* Avatar */}
                <Avatar avatarId={entry.avatar_id} size={40} />

                {/* Info */}
                <View style={styles.info}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, isMe && styles.nameMe]} numberOfLines={1}>
                      {entry.display_name}
                    </Text>
                    {isMe && (
                      <View style={styles.youBadge}>
                        <Text style={styles.youBadgeText}>Você</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.rankLabel}>{entry.rank_label}</Text>
                </View>

                {/* Stats */}
                <View style={styles.stats}>
                  <Text style={[styles.winRate, isMe && styles.winRateMe]}>
                    {Number(entry.win_rate).toFixed(0)}%
                  </Text>
                  <Text style={styles.matches}>{entry.matches_count} partidas</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: theme.spacing.md,
  },
  backBtn: {
    width: 36, height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.outline,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 20,
  },

  myPositionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.2)',
  },
  myPositionText: {
    color: theme.colors.textSoft,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
  },
  myPositionBold: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.bodyBold,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xxl,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 20,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    color: theme.colors.danger,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  retryText: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 14,
  },

  list: { gap: theme.spacing.xs, paddingBottom: theme.spacing.xxl },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  rowMe: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: 'rgba(242,202,80,0.3)',
  },

  posWrap: {
    width: 32,
    alignItems: 'center',
  },
  posText: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 13,
  },
  posTextMe: { color: theme.colors.primary },

  info: { flex: 1, gap: 2, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 14,
    flexShrink: 1,
  },
  nameMe: { color: theme.colors.primary },
  rankLabel: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 11,
  },

  youBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  youBadgeText: {
    color: '#241A00',
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  stats: { alignItems: 'flex-end', gap: 2 },
  winRate: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 18,
  },
  winRateMe: { color: theme.colors.primary },
  matches: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 11,
  },
});

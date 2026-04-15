import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/base/Avatar';
import { Button } from '@/components/base/Button';
import { Card } from '@/components/base/Card';
import { Screen } from '@/components/base/Screen';
import { AppHeader } from '@/components/layout/AppHeader';
import { useAuth } from '@/hooks/useAuth';
import { useResponsive } from '@/hooks/useResponsive';
import { useUserData } from '@/hooks/useUserData';
import { getDisplayName } from '@/features/auth/utils';
import { theme } from '@/theme';
import { formatTimelineLabel } from '@/utils/date';
import { formatCoins, formatPercentage } from '@/utils/format';
import type { MatchHistoryRow } from '@/types/database';

export function ProfileScreenView() {
  const { user, signOut } = useAuth();
  const { profile, matchHistory } = useUserData();
  const { isCompact } = useResponsive();

  const displayName = profile?.display_name
    ?? getDisplayName(user?.email, user?.user_metadata?.display_name)
    ?? 'Jogador';

  const level     = profile?.level      ?? 1;
  const xp        = profile?.xp         ?? 0;
  const xpTarget  = profile?.xp_target  ?? 1000;
  const progress  = Math.min((xp / xpTarget) * 100, 100);
  const winRate   = profile?.win_rate   ?? 0;
  const matches   = profile?.matches_count ?? 0;
  const streak    = profile?.streak_label ?? '—';
  const balance   = profile?.balance    ?? 0;

  return (
    <Screen withBottomNav>
      <AppHeader compactBrand onRightPress={() => router.push('/(main)/configuracoes')} />

      {/* Hero */}
      <View style={styles.hero}>
        <Avatar avatarId={profile?.avatar_id} size={136} highlighted />
        <Text style={[styles.name, isCompact && styles.nameCompact]}>{displayName}</Text>
        <Text style={styles.rank}>{profile?.rank_label ?? 'Iniciante'}</Text>
      </View>

      {/* Balance */}
      <Card variant="low">
        <View style={styles.balanceRow}>
          <View>
            <Text style={styles.balanceLabel}>Saldo atual</Text>
            <Text style={styles.balanceValue}>{formatCoins(balance)} moedas</Text>
          </View>
          <MaterialCommunityIcons name="wallet" size={28} color={theme.colors.primary} />
        </View>
      </Card>

      {/* XP Progress */}
      <Card variant="low">
        <View style={styles.progressBox}>
          <View style={styles.progressHeader}>
            <View>
              <Text style={styles.progressLabel}>Nível {level}</Text>
              <Text style={styles.progressTitle}>Caminho para o Mestre</Text>
            </View>
            <Text style={styles.progressValue}>{xp} / {xpTarget} XP</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>
      </Card>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <Card variant="high">
          <View style={styles.largeStat}>
            <Text style={styles.statLabel}>Taxa de vitória</Text>
            <Text style={styles.statValue}>{formatPercentage(winRate)}</Text>
          </View>
        </Card>
        <Card variant="high">
          <View style={styles.smallStat}>
            <Text style={styles.statLabel}>Partidas</Text>
            <Text style={styles.smallStatValue}>{matches}</Text>
          </View>
        </Card>
        <Card variant="high">
          <View style={styles.smallStat}>
            <Text style={styles.statLabel}>Sequência</Text>
            <Text style={[styles.smallStatValue, styles.streak]}>{streak}</Text>
          </View>
        </Card>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button title="Editar perfil" onPress={() => router.push('/(main)/editar-perfil')} />
        <Button title="Amigos" variant="secondary" onPress={() => router.push('/(main)/amigos')} />
        <Button title="Configurações" variant="secondary" onPress={() => router.push('/(main)/configuracoes')} />
        <Button title="Sair da conta" variant="ghost" onPress={signOut} />
      </View>

      {/* Match history */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Histórico de partidas</Text>

        {matchHistory.length === 0 ? (
          <Card variant="low">
            <View style={styles.emptyHistory}>
              <MaterialCommunityIcons name="gamepad-variant-outline" size={32} color={theme.colors.textFaint} />
              <Text style={styles.emptyHistoryText}>Nenhuma partida registrada ainda.</Text>
              <Button
                title="Jogar agora"
                fullWidth={false}
                onPress={() => router.push('/(main)/selecao-partida')}
              />
            </View>
          </Card>
        ) : (
          <View style={styles.historyList}>
            {matchHistory.map((match) => (
              <MatchHistoryCard key={match.id} match={match} />
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

function MatchHistoryCard({ match }: { match: MatchHistoryRow }) {
  const isWin = match.result === 'win';
  const minutes = Math.floor(match.duration_seconds / 60);
  const seconds = match.duration_seconds % 60;
  const duration = `${minutes}m ${seconds.toString().padStart(2, '0')}s`;

  return (
    <View style={[styles.matchCard, isWin ? styles.matchCardWin : styles.matchCardLoss]}>
      {/* Left: result icon + info */}
      <View style={[styles.matchIcon, isWin ? styles.matchIconWin : styles.matchIconLoss]}>
        <MaterialCommunityIcons
          name={isWin ? 'trophy' : 'close-circle-outline'}
          size={20}
          color={isWin ? theme.colors.primary : theme.colors.danger}
        />
      </View>

      <View style={styles.matchInfo}>
        <Text style={styles.matchRoom}>{match.room_name}</Text>
        <Text style={styles.matchOpponent}>vs {match.opponent_name}</Text>
        <Text style={styles.matchTime}>{formatTimelineLabel(match.created_at)} · {duration}</Text>
      </View>

      {/* Right: reward */}
      <View style={styles.matchRewardCol}>
        <Text style={[styles.matchReward, isWin ? styles.matchRewardWin : styles.matchRewardLoss]}>
          {isWin ? `+${formatCoins(match.reward)}` : `−${formatCoins(Math.abs(match.reward) || 100)}`}
        </Text>
        <Text style={styles.matchScore}>
          {match.score} pts
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: theme.spacing.sm },
  name: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 34, textAlign: 'center' },
  nameCompact: { fontSize: 28 },
  rank: { color: theme.colors.accent, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 2 },

  balanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balanceLabel: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2 },
  balanceValue: { color: theme.colors.primary, fontFamily: theme.typography.fontFamily.display, fontSize: 26, marginTop: 2 },

  progressBox: { gap: theme.spacing.md },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: theme.spacing.sm },
  progressLabel: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2 },
  progressTitle: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.displayMedium, fontSize: 20 },
  progressValue: { color: theme.colors.primary, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 13 },
  progressTrack: { height: 12, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceHigh, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: theme.radius.pill, backgroundColor: theme.colors.primary },

  statsGrid: { gap: theme.spacing.md },
  largeStat: { gap: theme.spacing.xs },
  smallStat: { gap: theme.spacing.xs },
  statLabel: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2 },
  statValue: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 42 },
  smallStatValue: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 28 },
  streak: { color: theme.colors.accent },

  actions: { gap: theme.spacing.md },

  section: { gap: theme.spacing.md },
  sectionTitle: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 24 },

  emptyHistory: { alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.lg },
  emptyHistoryText: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 14, textAlign: 'center' },

  historyList: { gap: theme.spacing.sm },

  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderLeftWidth: 3,
  },
  matchCardWin: { borderLeftColor: theme.colors.primary },
  matchCardLoss: { borderLeftColor: theme.colors.danger },
  matchIcon: { width: 40, height: 40, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  matchIconWin: { backgroundColor: theme.colors.primarySoft },
  matchIconLoss: { backgroundColor: 'rgba(255,139,135,0.12)' },
  matchInfo: { flex: 1, gap: 2 },
  matchRoom: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 14 },
  matchOpponent: { color: theme.colors.textSoft, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 12 },
  matchTime: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.body, fontSize: 11 },
  matchRewardCol: { alignItems: 'flex-end', gap: 2 },
  matchReward: { fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 15 },
  matchRewardWin: { color: theme.colors.primary },
  matchRewardLoss: { color: theme.colors.danger },
  matchScore: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 11 },
});

import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/base/Avatar';
import { Button } from '@/components/base/Button';
import { Card } from '@/components/base/Card';
import { Screen } from '@/components/base/Screen';
import { AppHeader } from '@/components/layout/AppHeader';
import { useAuth } from '@/hooks/useAuth';
import { useResponsive } from '@/hooks/useResponsive';
import { useUserData } from '@/hooks/useUserData';
import { profileStatsMock, userMock } from '@/services/mock-data';
import { getDisplayName } from '@/features/auth/utils';
import { theme } from '@/theme';
import { formatTimelineLabel } from '@/utils/date';
import { formatPercentage } from '@/utils/format';

export function ProfileScreenView() {
  const { user, signOut } = useAuth();
  const { profile, matchHistory } = useUserData();
  const displayName = getDisplayName(user?.email, user?.user_metadata?.display_name) || userMock.name;
  const { isCompact } = useResponsive();
  const level = profile?.level ?? profileStatsMock.level;
  const xp = profile?.xp ?? profileStatsMock.xp;
  const xpTarget = profile?.xp_target ?? profileStatsMock.xpTarget;
  const progress = (xp / xpTarget) * 100;
  const recentMatch = matchHistory[0];

  return (
    <Screen withBottomNav>
      <AppHeader compactBrand onRightPress={() => router.push('/(main)/configuracoes')} />

      <View style={styles.hero}>
        <Avatar avatarId={profile?.avatar_id} size={136} highlighted />
        <Text style={[styles.name, isCompact && styles.nameCompact]}>{displayName}</Text>
        <Text style={styles.rank}>Rank: {profile?.rank_label ?? userMock.rank}</Text>
      </View>

      <Card variant="low">
        <View style={styles.progressBox}>
          <View style={styles.progressHeader}>
            <View>
              <Text style={styles.progressLabel}>Nível {level}</Text>
              <Text style={styles.progressTitle}>Caminho para o Mestre</Text>
            </View>
            <Text style={styles.progressValue}>
              {xp} / {xpTarget} XP
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>
      </Card>

      <View style={styles.statsGrid}>
        <Card variant="high">
          <View style={styles.largeStat}>
            <Text style={styles.statLabel}>Taxa de vitória</Text>
            <Text style={styles.statValue}>{formatPercentage(profile?.win_rate ?? profileStatsMock.winRate)}</Text>
          </View>
        </Card>
        <Card variant="high">
          <View style={styles.smallStat}>
            <Text style={styles.statLabel}>Partidas</Text>
            <Text style={styles.smallStatValue}>{profile?.matches_count ?? profileStatsMock.matches}</Text>
          </View>
        </Card>
        <Card variant="high">
          <View style={styles.smallStat}>
            <Text style={styles.statLabel}>Sequência</Text>
            <Text style={[styles.smallStatValue, styles.streak]}>{profile?.streak_label ?? profileStatsMock.streak}</Text>
          </View>
        </Card>
      </View>

      <View style={styles.actions}>
        <Button title="Editar perfil" onPress={() => router.push('/(main)/editar-perfil')} />
        <Button title="Amigos" variant="secondary" onPress={() => router.push('/(main)/amigos')} />
        <Button title="Configurações" variant="secondary" onPress={() => router.push('/(main)/configuracoes')} />
        <Button title="Sair da conta" variant="ghost" onPress={signOut} />
      </View>

      <Card variant="low">
        <View style={styles.recentMatch}>
          <Text style={styles.sectionLabel}>Última partida</Text>
          <Text style={styles.recentTitle}>{recentMatch?.room_name ?? 'Mesa Rubi'}</Text>
          <Text style={styles.recentReward}>
            +{recentMatch?.reward ?? 450} moedas • {recentMatch ? formatTimelineLabel(recentMatch.created_at) : 'Há 2 horas'}
          </Text>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  name: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 34,
    textAlign: 'center',
  },
  nameCompact: {
    fontSize: 30,
  },
  rank: {
    color: theme.colors.accent,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  progressBox: {
    gap: theme.spacing.md,
  },
  progressHeader: {
    gap: theme.spacing.sm,
  },
  progressLabel: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  progressTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.displayMedium,
    fontSize: 24,
  },
  progressValue: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 14,
  },
  progressTrack: {
    height: 12,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceHigh,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
  },
  statsGrid: {
    gap: theme.spacing.md,
  },
  largeStat: {
    gap: theme.spacing.xs,
  },
  smallStat: {
    gap: theme.spacing.xs,
  },
  statLabel: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  statValue: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 42,
  },
  smallStatValue: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 28,
  },
  streak: {
    color: theme.colors.accent,
  },
  actions: {
    gap: theme.spacing.md,
  },
  recentMatch: {
    gap: theme.spacing.xs,
  },
  sectionLabel: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  recentTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.displayMedium,
    fontSize: 22,
  },
  recentReward: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 14,
  },
});

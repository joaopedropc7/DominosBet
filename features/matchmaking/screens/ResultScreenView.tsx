import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/base/Button';
import { Card } from '@/components/base/Card';
import { Screen } from '@/components/base/Screen';
import { AppHeader } from '@/components/layout/AppHeader';
import { useAuth } from '@/hooks/useAuth';
import { useResponsive } from '@/hooks/useResponsive';
import { useUserData } from '@/hooks/useUserData';
import { resultMock } from '@/services/mock-data';
import { theme } from '@/theme';
import { formatCoins } from '@/utils/format';

export function ResultScreenView() {
  const { isPhone, isCompact } = useResponsive();
  const { user } = useAuth();
  const { recordDemoResult } = useUserData();
  const [isSaving, setIsSaving] = useState(false);

  async function handleSaveResult() {
    if (!user) return;

    try {
      setIsSaving(true);
      await recordDemoResult();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Screen withBottomNav>
      <AppHeader compactBrand onRightPress={() => router.push('/(main)/configuracoes')} />

      <View style={styles.hero}>
        <View style={[styles.trophyWrap, isCompact && styles.trophyWrapCompact]}>
          <MaterialCommunityIcons name="trophy" size={isCompact ? 88 : 110} color={theme.colors.primary} />
        </View>
        <Text style={[styles.title, isCompact && styles.titleCompact]}>Você venceu!</Text>
        <Text style={styles.subtitle}>Vitória na Arena Premium</Text>
      </View>

      <Card variant="low">
        <View style={styles.rewardCard}>
          <Text style={styles.rewardLabel}>Recompensa total</Text>
          <Text style={styles.rewardValue}>+{formatCoins(resultMock.reward)} moedas</Text>
        </View>
      </Card>

      <View style={[styles.statsGrid, isPhone && styles.statsGridMobile]}>
        <Card variant="high">
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Tempo</Text>
            <Text style={styles.statValue}>{resultMock.time}</Text>
          </View>
        </Card>
        <Card variant="high">
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Pontos</Text>
            <Text style={styles.statValue}>{resultMock.points} pts</Text>
          </View>
        </Card>
      </View>

      <Card variant="low">
        <View style={[styles.opponentRow, isCompact && styles.opponentRowCompact]}>
          <View>
            <Text style={styles.opponentLabel}>Oponente</Text>
            <Text style={styles.opponentName}>{resultMock.opponent}</Text>
          </View>
          <View style={styles.scoreWrap}>
            <Text style={styles.opponentLabel}>Placar</Text>
            <Text style={styles.opponentScore}>{resultMock.opponentScore} pts</Text>
          </View>
        </View>
      </Card>

      <View style={styles.actions}>
        <Button
          title={isSaving ? 'Salvando no histórico...' : 'Salvar no histórico'}
          variant="secondary"
          onPress={handleSaveResult}
          icon={isSaving ? <ActivityIndicator color={theme.colors.text} /> : undefined}
        />
        <Button title="Jogar novamente" onPress={() => router.push('/(main)/selecao-partida')} />
        <Button title="Voltar ao início" variant="ghost" onPress={() => router.push('/(main)/home')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  trophyWrap: {
    width: 180,
    height: 180,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(242, 202, 80, 0.08)',
  },
  trophyWrapCompact: {
    width: 148,
    height: 148,
  },
  title: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 44,
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: 34,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  rewardCard: {
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  rewardLabel: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  rewardValue: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 34,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  statsGridMobile: {
    flexDirection: 'column',
  },
  statBox: {
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
    fontSize: 26,
  },
  opponentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  opponentRowCompact: {
    flexDirection: 'column',
  },
  opponentLabel: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  opponentName: {
    color: theme.colors.textSoft,
    fontFamily: theme.typography.fontFamily.displayMedium,
    fontSize: 22,
  },
  scoreWrap: {
    alignItems: 'flex-end',
  },
  opponentScore: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 22,
  },
  actions: {
    gap: theme.spacing.md,
  },
});

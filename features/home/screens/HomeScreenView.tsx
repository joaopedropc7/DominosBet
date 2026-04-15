import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/base/Button';
import { Card } from '@/components/base/Card';
import { BalanceBadge } from '@/components/base/BalanceBadge';
import { ModeCard } from '@/components/base/ModeCard';
import { Screen } from '@/components/base/Screen';
import { AppHeader } from '@/components/layout/AppHeader';
import { useResponsive } from '@/hooks/useResponsive';
import { useUserData } from '@/hooks/useUserData';
import { quickModesMock, roomPreviewsMock, userMock } from '@/services/mock-data';
import { calcPrize } from '@/services/online-match';
import { theme } from '@/theme';
import { formatCoins } from '@/utils/format';

const EXPRESS_BETS = [10, 20, 30, 50, 100, 150, 200];
const HOME_PREVIEW_COUNT = 3; // items shown before "Ver todas"

export function HomeScreenView() {
  const { isPhone, isCompact, width } = useResponsive();
  const { profile } = useUserData();
  const roomCardWidth = Math.min(Math.max(width - (isCompact ? 40 : 52), 240), 320);
  const balance = profile?.balance ?? 0;

  return (
    <Screen withBottomNav>
      <AppHeader onRightPress={() => router.push('/(main)/configuracoes')} />

      <Card variant="low">
        <View style={styles.walletCard}>
          <BalanceBadge value={profile?.balance ?? userMock.balance} />
          <Button
            title="Adicionar fundos"
            variant="ghost"
            fullWidth={false}
            icon={<MaterialCommunityIcons name="plus-circle-outline" size={18} color={theme.colors.accent} />}
          />
        </View>
      </Card>

      <View style={[styles.modeGrid, isPhone && styles.modeGridMobile]}>
        {quickModesMock.map((mode) => (
          <ModeCard
            key={mode.id}
            mode={mode}
            onPress={() => router.push(mode.id === 'duelo' ? '/(main)/selecao-partida' : mode.id === '4p' ? '/(main)/jogo-4p' : '/(main)/busca-partida')}
          />
        ))}
      </View>

      <View style={styles.section}>
        <View style={[styles.sectionHeader, isCompact && styles.sectionHeaderCompact]}>
          <Text style={[styles.sectionTitle, isCompact && styles.sectionTitleCompact]}>Partidas Rápidas</Text>
          <Pressable onPress={() => router.push('/(main)/selecao-aposta')}>
            <Text style={styles.sectionAction}>Ver todas</Text>
          </Pressable>
        </View>
        <View style={styles.stack}>
          {EXPRESS_BETS.slice(0, HOME_PREVIEW_COUNT).map((fee) => {
            const prize = calcPrize(fee);
            const canAfford = balance >= fee;
            return (
              <Pressable
                key={fee}
                onPress={() => canAfford && router.push({
                  pathname: '/(main)/busca-partida',
                  params: { mode: 'express', entryFee: String(fee) },
                } as any)}
                style={[styles.matchItem, isCompact && styles.matchItemCompact, !canAfford && styles.matchItemDisabled]}
              >
                <View style={styles.matchLeft}>
                  <View style={styles.matchIconWrap}>
                    <MaterialCommunityIcons
                      name="lightning-bolt"
                      size={22}
                      color={canAfford ? theme.colors.accent : theme.colors.textFaint}
                    />
                  </View>
                  <View>
                    <Text style={styles.matchTitle}>{formatCoins(fee)} moedas</Text>
                    <Text style={styles.matchSubtitle}>1v1 Expresso · sem monte</Text>
                  </View>
                </View>
                <View style={[styles.matchRight, isPhone && styles.matchRightMobile]}>
                  <Text style={styles.matchRewardLabel}>Prêmio</Text>
                  <Text style={[styles.matchReward, !canAfford && styles.matchRewardDim]}>
                    {formatCoins(prize)} moedas
                  </Text>
                  {!canAfford && (
                    <Text style={styles.matchLocked}>sem saldo</Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <View style={[styles.sectionHeader, isCompact && styles.sectionHeaderCompact]}>
          <Text style={[styles.sectionTitle, isCompact && styles.sectionTitleCompact]}>Salas Disponíveis</Text>
          <Text style={styles.sectionActionMuted}>Ao vivo</Text>
        </View>
        <ScrollView
          horizontal
          style={styles.roomsScroll}
          contentContainerStyle={styles.roomsRow}
          showsHorizontalScrollIndicator={false}
          alwaysBounceHorizontal={false}>
          {roomPreviewsMock.map((room, index) => (
            <Card key={room.id} variant="high">
              <View style={[styles.roomCard, { width: roomCardWidth }, index === 1 && styles.roomCardSecondary]}>
                <Text style={[styles.roomBadge, index === 1 && styles.roomBadgeCyan]}>{room.badge}</Text>
                <Text style={styles.roomTitle}>{room.title}</Text>
                <Text style={styles.roomDescription}>{room.description}</Text>
                <View style={[styles.roomFooter, isCompact && styles.roomFooterCompact]}>
                  <Text style={styles.roomBuyIn}>{formatCoins(room.buyIn)}</Text>
                  <Button
                    title={room.actionLabel}
                    variant={index === 0 ? 'secondary' : 'ghost'}
                    fullWidth={false}
                    onPress={() => router.push('/(main)/busca-partida')}
                  />
                </View>
              </View>
            </Card>
          ))}
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  walletCard: {
    gap: theme.spacing.md,
  },
  modeGrid: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  modeGridMobile: {
    flexDirection: 'column',
  },
  section: {
    gap: theme.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeaderCompact: {
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 28,
  },
  sectionTitleCompact: {
    fontSize: 24,
  },
  sectionAction: {
    color: theme.colors.accent,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  sectionActionMuted: {
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  stack: {
    gap: theme.spacing.sm,
  },
  matchItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  matchItemCompact: {
    alignItems: 'flex-start',
  },
  matchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    flex: 1,
  },
  matchIconWrap: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceInset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 16,
  },
  matchSubtitle: {
    color: theme.colors.textSoft,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
  },
  matchRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  matchRightMobile: {
    flexShrink: 1,
    maxWidth: 112,
  },
  matchRewardLabel: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 12,
  },
  matchReward: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 13,
  },
  matchRewardDim: { color: theme.colors.textFaint },
  matchItemDisabled: { opacity: 0.5 },
  matchLocked: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  roomsRow: {
    gap: theme.spacing.md,
    paddingRight: theme.spacing.md,
  },
  roomsScroll: {
    width: '100%',
    maxWidth: '100%',
  },
  roomCard: {
    gap: theme.spacing.sm,
  },
  roomCardSecondary: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,228,241,0.2)',
  },
  roomBadge: {
    color: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  roomBadgeCyan: {
    color: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  roomTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 24,
  },
  roomDescription: {
    color: theme.colors.textSoft,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
  },
  roomFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  roomFooterCompact: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  roomBuyIn: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 24,
  },
});

import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/base/Button';
import { Card } from '@/components/base/Card';
import { Screen } from '@/components/base/Screen';
import { AppHeader } from '@/components/layout/AppHeader';
import { useResponsive } from '@/hooks/useResponsive';
import { useUserData } from '@/hooks/useUserData';
import { userMock, walletActivityMock } from '@/services/mock-data';
import { theme } from '@/theme';
import { formatTimelineLabel } from '@/utils/date';
import { formatCoins } from '@/utils/format';

export function WalletScreenView() {
  const { isPhone, isCompact } = useResponsive();
  const { profile, walletTransactions } = useUserData();
  const activityItems =
    walletTransactions.length > 0
      ? walletTransactions.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          value: item.amount,
          highlight: item.highlight,
          timeLabel: formatTimelineLabel(item.created_at),
        }))
      : walletActivityMock;

  return (
    <Screen withBottomNav>
      <AppHeader compactBrand onRightPress={() => router.push('/(main)/configuracoes')} />

      <Card variant="low">
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Saldo atual</Text>
          <View style={styles.heroValueRow}>
            <Text style={styles.heroValue}>{formatCoins(profile?.balance ?? userMock.balance)}</Text>
            <Text style={styles.heroCurrency}>XD</Text>
          </View>
          <Button title="Adicionar moedas" icon={<MaterialCommunityIcons name="plus-circle" size={18} color="#241A00" />} />
        </View>
      </Card>

      <View style={[styles.sectionHeader, isCompact && styles.sectionHeaderCompact]}>
        <Text style={[styles.sectionTitle, isCompact && styles.sectionTitleCompact]}>Atividade Recente</Text>
        <Text style={styles.sectionAction}>Histórico</Text>
      </View>

      <View style={styles.stack}>
        {activityItems.map((activity) => {
          const valueColor =
            activity.highlight === 'cyan'
              ? theme.colors.accent
              : activity.highlight === 'gold'
                ? theme.colors.primary
                : theme.colors.textSoft;

          return (
            <Card key={activity.id} variant={activity.highlight === 'muted' ? 'low' : 'high'}>
              <View style={[styles.activityRow, isPhone && styles.activityRowMobile]}>
                <View style={styles.activityLeft}>
                  <View style={styles.activityIcon}>
                    <MaterialCommunityIcons
                      name={activity.highlight === 'cyan' ? 'wallet-plus-outline' : activity.highlight === 'gold' ? 'trophy-outline' : 'login'}
                      size={20}
                      color={valueColor}
                    />
                  </View>
                  <View>
                    <Text style={styles.activityTitle}>{activity.title}</Text>
                    <Text style={styles.activityDescription}>{activity.description}</Text>
                  </View>
                </View>
                <View style={[styles.activityRight, isPhone && styles.activityRightMobile]}>
                  <Text style={[styles.activityValue, { color: valueColor }]}>
                    {activity.value > 0 ? '+' : ''}
                    {activity.value}
                  </Text>
                  <Text style={styles.activityTime}>{activity.timeLabel}</Text>
                </View>
              </View>
            </Card>
          );
        })}
      </View>

      <Card variant="low">
        <View style={styles.promo}>
          <Text style={styles.promoTitle}>Dobre suas vitórias</Text>
          <Text style={styles.promoDescription}>
            Assine o Clube xDominó e receba bônus de 20% em cada partida vencida.
          </Text>
          <Button title="Saber mais" variant="ghost" fullWidth={false} />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  heroLabel: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.xs,
  },
  heroValue: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 54,
  },
  heroCurrency: {
    color: theme.colors.primaryDeep,
    fontFamily: theme.typography.fontFamily.displayMedium,
    fontSize: 28,
    marginBottom: 7,
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
  stack: {
    gap: theme.spacing.sm,
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  activityRowMobile: {
    flexDirection: 'column',
  },
  activityLeft: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    flex: 1,
  },
  activityIcon: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceInset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 16,
  },
  activityDescription: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  activityRight: {
    alignItems: 'flex-end',
  },
  activityRightMobile: {
    alignItems: 'flex-start',
    paddingLeft: 64,
  },
  activityValue: {
    fontFamily: theme.typography.fontFamily.displayMedium,
    fontSize: 24,
  },
  activityTime: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 10,
  },
  promo: {
    gap: theme.spacing.sm,
  },
  promoTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.displayMedium,
    fontSize: 24,
  },
  promoDescription: {
    color: theme.colors.textSoft,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
    lineHeight: 22,
  },
});

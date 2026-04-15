import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/base/Screen';
import { AppHeader } from '@/components/layout/AppHeader';
import { useUserData } from '@/hooks/useUserData';
import { theme } from '@/theme';
import { formatCoins } from '@/utils/format';

const BET_OPTIONS = [10, 20, 30, 50, 100, 150, 200];

export function BetSelectionScreenView() {
  const { profile } = useUserData();
  const balance = profile?.balance ?? 0;

  function handleSelect(entryFee: number) {
    router.push({
      pathname: '/(main)/busca-partida',
      params: { mode: 'express', entryFee: String(entryFee) },
    } as any);
  }

  return (
    <Screen withBottomNav>
      <AppHeader
        title="Partida Rápida"
        subtitle="Escolha o valor da aposta."
        onRightPress={() => router.push('/(main)/configuracoes')}
      />

      {/* Balance */}
      <View style={styles.balanceRow}>
        <Text style={styles.balanceLabel}>Saldo disponível</Text>
        <Text style={styles.balanceValue}>{formatCoins(balance)} moedas</Text>
      </View>

      {/* Bet grid */}
      <View style={styles.grid}>
        {BET_OPTIONS.map((fee) => {
          const prize = Math.round(fee * 2 * 0.9);
          const canAfford = balance >= fee;

          return (
            <Pressable
              key={fee}
              onPress={() => canAfford && handleSelect(fee)}
              style={({ pressed }) => [
                styles.card,
                !canAfford && styles.cardDisabled,
                pressed && canAfford && styles.cardPressed,
              ]}
            >
              {/* Top: entry fee */}
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons
                  name="lightning-bolt"
                  size={14}
                  color={canAfford ? theme.colors.accent : theme.colors.textFaint}
                />
                <Text style={[styles.cardEyebrow, !canAfford && styles.cardEyebrowDim]}>
                  Expresso
                </Text>
              </View>

              {/* Entry fee */}
              <Text style={[styles.cardFee, !canAfford && styles.cardFeeDim]}>
                {formatCoins(fee)}
              </Text>
              <Text style={[styles.cardFeeSub, !canAfford && styles.cardFeeSubDim]}>moedas</Text>

              {/* Divider */}
              <View style={[styles.cardDivider, !canAfford && styles.cardDividerDim]} />

              {/* Prize */}
              <View style={styles.cardPrize}>
                <MaterialCommunityIcons
                  name="trophy-outline"
                  size={12}
                  color={canAfford ? theme.colors.primary : theme.colors.textFaint}
                />
                <Text style={[styles.cardPrizeText, !canAfford && styles.cardPrizeTextDim]}>
                  {formatCoins(prize)} prêmio
                </Text>
              </View>

              {!canAfford && (
                <View style={styles.lockedBadge}>
                  <MaterialCommunityIcons name="lock-outline" size={10} color={theme.colors.textFaint} />
                  <Text style={styles.lockedText}>sem saldo</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.footnote}>
        90% do pote vai para o vencedor. Sem empate no modo expresso.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  balanceLabel: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  balanceValue: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 20,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },

  card: {
    width: '47%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    padding: theme.spacing.md,
    gap: 4,
    alignItems: 'flex-start',
  },
  cardDisabled: {
    opacity: 0.45,
  },
  cardPressed: {
    backgroundColor: theme.colors.surfaceHigh,
    transform: [{ scale: 0.97 }],
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  cardEyebrow: {
    color: theme.colors.accent,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  cardEyebrowDim: { color: theme.colors.textFaint },

  cardFee: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 34,
    lineHeight: 38,
  },
  cardFeeDim: { color: theme.colors.textMuted },
  cardFeeSub: {
    color: theme.colors.textSoft,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 12,
    marginTop: -4,
  },
  cardFeeSubDim: { color: theme.colors.textFaint },

  cardDivider: {
    width: '100%',
    height: 1,
    backgroundColor: theme.colors.outline,
    marginVertical: theme.spacing.xs,
  },
  cardDividerDim: { backgroundColor: 'rgba(77,70,53,0.12)' },

  cardPrize: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardPrizeText: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 12,
  },
  cardPrizeTextDim: { color: theme.colors.textFaint },

  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  lockedText: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 10,
  },

  footnote: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 11,
    textAlign: 'center',
    marginTop: theme.spacing.md,
    lineHeight: 18,
  },
});

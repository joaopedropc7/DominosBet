import { router } from 'expo-router';
import { Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/base/Card';
import { Screen } from '@/components/base/Screen';
import { AppHeader } from '@/components/layout/AppHeader';
import { useResponsive } from '@/hooks/useResponsive';
import { useUserData } from '@/hooks/useUserData';
import { ENTRY_FEE } from '@/services/online-match';
import { theme } from '@/theme';
import { formatCoins } from '@/utils/format';

interface MatchMode {
  id: string;
  eyebrow: string;
  eyebrowAccent: boolean;
  title: string;
  description: string;
  badge: string;
  badgeAccent: boolean;
  icon: string;
  cta: string;
  isOnline: boolean;
  onPress: () => void;
}

export function MatchSelectionScreenView() {
  const { isPhone, isCompact } = useResponsive();
  const { profile } = useUserData();

  const balance = profile?.balance ?? 0;
  const hasBalance = balance >= ENTRY_FEE;

  function handleOnlinePress(mode: 'classic' | 'express') {
    if (!hasBalance) {
      Alert.alert(
        'Saldo insuficiente',
        `Você precisa de ${formatCoins(ENTRY_FEE)} moedas para entrar. Seu saldo: ${formatCoins(balance)} moedas.`,
        [{ text: 'OK' }],
      );
      return;
    }
    router.push({ pathname: '/(main)/busca-partida', params: { mode } } as any);
  }

  const modes: MatchMode[] = [
    {
      id: 'classic',
      eyebrow: '1v1 Clássico',
      eyebrowAccent: true,
      title: 'Arena Clássica',
      description: `Com compra do monte · Entrada: ${formatCoins(ENTRY_FEE)} · Prêmio: ${formatCoins(Math.round(ENTRY_FEE * 2 * 0.9))} moedas`,
      badge: 'Ao vivo',
      badgeAccent: true,
      icon: 'account-group',
      isOnline: true,
      cta: hasBalance ? 'Buscar partida' : 'Saldo insuficiente',
      onPress: () => handleOnlinePress('classic'),
    },
    {
      id: 'express',
      eyebrow: '1v1 Expresso',
      eyebrowAccent: true,
      title: 'Arena Expresso',
      description: `Sem monte · Bloqueia = fim · Entrada: ${formatCoins(ENTRY_FEE)} · Prêmio: ${formatCoins(Math.round(ENTRY_FEE * 2 * 0.9))} moedas`,
      badge: 'Ao vivo',
      badgeAccent: true,
      icon: 'lightning-bolt',
      isOnline: true,
      cta: hasBalance ? 'Buscar partida' : 'Saldo insuficiente',
      onPress: () => handleOnlinePress('express'),
    },
    {
      id: 'bot',
      eyebrow: '1v1 vs Bot',
      eyebrowAccent: false,
      title: 'Treino',
      description: 'Pratique contra o Bot Noir — sem pressão de tempo.',
      badge: 'Offline',
      badgeAccent: false,
      icon: 'robot',
      isOnline: false,
      cta: 'Jogar vs Bot',
      onPress: () => router.push('/(main)/jogo-bot'),
    },
  ];

  return (
    <Screen withBottomNav>
      <AppHeader
        title="Arena de Elite"
        subtitle="Escolha sua mesa e domine o tabuleiro."
        onRightPress={() => router.push('/(main)/configuracoes')}
      />

      {/* Balance row */}
      <View style={[styles.balanceRow, isCompact && styles.balanceRowCompact]}>
        <Text style={styles.balanceLabel}>Saldo</Text>
        <Text style={styles.balanceValue}>
          {formatCoins(profile?.balance ?? 0)} moedas
        </Text>
      </View>

      {/* Mode cards */}
      <View style={styles.stack}>
        {modes.map((mode) => (
          <Card key={mode.id} variant="low">
            <View style={styles.modeCard}>
              {/* Header */}
              <View style={[styles.modeHeader, isPhone && styles.modeHeaderMobile]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.eyebrow, mode.eyebrowAccent && styles.eyebrowAccent]}>
                    {mode.eyebrow}
                  </Text>
                  <Text style={styles.modeTitle}>{mode.title}</Text>
                </View>
                <View style={[styles.statusBadge, mode.badgeAccent && styles.statusBadgeAccent]}>
                  <MaterialCommunityIcons
                    name={mode.icon as any}
                    size={12}
                    color={mode.badgeAccent ? theme.colors.accent : theme.colors.textMuted}
                  />
                  <Text style={[styles.statusText, mode.badgeAccent && styles.statusTextAccent]}>
                    {mode.badge}
                  </Text>
                </View>
              </View>

              {/* Description */}
              <Text style={styles.modeDescription}>{mode.description}</Text>

              {/* CTA */}
              <Pressable
                onPress={mode.onPress}
                style={({ pressed }) => [
                  styles.ctaBtn,
                  mode.isOnline && hasBalance && styles.ctaBtnAccent,
                  mode.isOnline && !hasBalance && styles.ctaBtnDisabled,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={[styles.ctaBtnText, !mode.isOnline && styles.ctaBtnTextMuted]}>
                  {mode.cta}
                </Text>
                <MaterialCommunityIcons
                  name="arrow-right"
                  size={16}
                  color={mode.isOnline ? '#241A00' : theme.colors.text}
                />
              </Pressable>
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceRowCompact: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
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
    fontSize: 22,
  },
  stack: { gap: theme.spacing.lg },

  modeCard: { gap: theme.spacing.md },
  modeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  modeHeaderMobile: { flexDirection: 'column', alignItems: 'flex-start' },

  eyebrow: {
    color: theme.colors.textSoft,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  eyebrowAccent: { color: theme.colors.accent },

  modeTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 30,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceHigh,
  },
  statusBadgeAccent: { backgroundColor: theme.colors.accentSoft },

  statusText: {
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  statusTextAccent: { color: theme.colors.accent },

  modeDescription: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
    lineHeight: 20,
  },

  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.surfaceHigh,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  ctaBtnAccent: {
    backgroundColor: theme.colors.primary,
    borderColor: 'transparent',
  },
  ctaBtnDisabled: {
    backgroundColor: theme.colors.surfaceHigh,
    borderColor: theme.colors.outline,
    opacity: 0.6,
  },
  ctaBtnText: {
    color: '#241A00',
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 14,
  },
  ctaBtnTextMuted: { color: theme.colors.text },
});

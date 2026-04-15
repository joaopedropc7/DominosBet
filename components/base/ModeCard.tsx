import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { QuickMatch } from '@/types/app';
import { theme } from '@/theme';
import { formatCoins } from '@/utils/format';

interface ModeCardProps {
  mode: QuickMatch;
  onPress?: () => void;
}

export function ModeCard({ mode, onPress }: ModeCardProps) {
  const isGold = mode.accent === 'gold';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.container, pressed && styles.pressed]}>
      {isGold ? (
        <LinearGradient colors={[theme.colors.primary, theme.colors.primaryDeep]} style={styles.gold}>
          <MaterialCommunityIcons name={mode.icon} size={34} color="#241A00" />
          <Text style={styles.goldTitle}>{mode.title}</Text>
          <Text style={styles.goldSubtitle}>{mode.subtitle}</Text>
        </LinearGradient>
      ) : (
        <View style={styles.dark}>
          <MaterialCommunityIcons name={mode.icon} size={34} color={theme.colors.accent} />
          <Text style={styles.darkTitle}>{mode.title}</Text>
          <Text style={styles.darkSubtitle}>{mode.subtitle}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>Entrada {formatCoins(mode.entry)}</Text>
            <Text style={styles.metaText}>Prêmio {formatCoins(mode.reward)}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 142,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.96,
  },
  gold: {
    flex: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  dark: {
    flex: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    justifyContent: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.surfaceHigh,
  },
  goldTitle: {
    color: '#241A00',
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 22,
  },
  goldSubtitle: {
    color: 'rgba(36,26,0,0.8)',
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  darkTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 22,
  },
  darkSubtitle: {
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.sm,
  },
  metaText: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodySemiBold,
    fontSize: 11,
  },
});

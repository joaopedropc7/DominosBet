import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/theme';
import { formatCoins } from '@/utils/format';

interface BalanceBadgeProps {
  label?: string;
  value: number;
}

export function BalanceBadge({ label = 'Saldo atual', value }: BalanceBadgeProps) {
  return (
    <View style={styles.badge}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <MaterialCommunityIcons name="cash-multiple" size={22} color={theme.colors.primary} />
        <Text style={styles.value}>
          {formatCoins(value)} <Text style={styles.currency}>moedas</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    gap: theme.spacing.xs,
  },
  label: {
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  value: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 20,
  },
  currency: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.bodySemiBold,
    fontSize: 18,
  },
});

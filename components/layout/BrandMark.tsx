import { StyleSheet, Text, View } from 'react-native';
import { APP_NAME, APP_TAGLINE } from '@/constants/app';
import { theme } from '@/theme';

interface BrandMarkProps {
  center?: boolean;
  compact?: boolean;
}

export function BrandMark({ center = false, compact = false }: BrandMarkProps) {
  return (
    <View style={[styles.root, center && styles.center]}>
      <Text style={[styles.title, compact && styles.titleCompact]}>{APP_NAME}</Text>
      <Text style={styles.tagline}>{APP_TAGLINE}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 6,
  },
  center: {
    alignItems: 'center',
  },
  title: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 44,
    fontStyle: 'italic',
  },
  titleCompact: {
    fontSize: 28,
  },
  tagline: {
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
});

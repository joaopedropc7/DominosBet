import { StyleSheet, View } from 'react-native';
import type { PropsWithChildren } from 'react';
import { theme } from '@/theme';

interface CardProps extends PropsWithChildren {
  variant?: 'low' | 'high' | 'glass';
  padded?: boolean;
}

export function Card({ children, variant = 'low', padded = true }: CardProps) {
  return <View style={[styles.base, styles[variant], padded && styles.padded]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
  },
  padded: {
    padding: theme.spacing.lg,
  },
  low: {
    backgroundColor: theme.colors.surface,
  },
  high: {
    backgroundColor: theme.colors.surfaceHigh,
  },
  glass: {
    backgroundColor: 'rgba(42, 42, 42, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
});

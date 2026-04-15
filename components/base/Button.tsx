import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { theme } from '@/theme';

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: ReactNode;
  fullWidth?: boolean;
}

export function Button({ title, onPress, variant = 'primary', icon, fullWidth = true }: ButtonProps) {
  const content = (
    <View style={[styles.content, !fullWidth && styles.fitContent]}>
      {icon}
      <Text style={[styles.label, variant !== 'primary' && styles.labelOnDark]}>{title}</Text>
    </View>
  );

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.pressable, pressed && styles.pressed, !fullWidth && styles.inline]}>
      {variant === 'primary' ? (
        <LinearGradient colors={[theme.colors.primary, theme.colors.primaryDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
          {content}
        </LinearGradient>
      ) : (
        <View style={[styles.secondary, variant === 'ghost' && styles.ghost]}>{content}</View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: '100%',
  },
  inline: {
    width: 'auto',
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  gradient: {
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 16,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  secondary: {
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 16,
    backgroundColor: theme.colors.surfaceHigh,
    borderWidth: 1,
    borderColor: 'rgba(77, 70, 53, 0.4)',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  fitContent: {
    paddingHorizontal: theme.spacing.sm,
  },
  label: {
    color: '#241A00',
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 15,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  labelOnDark: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyBold,
  },
});

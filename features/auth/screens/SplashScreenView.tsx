import { useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/base/Screen';
import { BrandMark } from '@/components/layout/BrandMark';
import { useAuth } from '@/hooks/useAuth';
import { theme } from '@/theme';

export function SplashScreenView() {
  const { isLoading, session } = useAuth();

  // useFocusEffect garante que o redirect só acontece quando
  // o splash está visível — evita redirecionar telas em background (ex: /admin).
  useFocusEffect(
    useCallback(() => {
      if (isLoading) return;

      const timeout = setTimeout(() => {
        router.replace(session ? '/(main)/home' : '/login');
      }, 1200);

      return () => clearTimeout(timeout);
    }, [isLoading, session]),
  );

  return (
    <Screen centered>
      <View style={styles.hero}>
        <BrandMark center />
        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>
        <Text style={styles.status}>Sincronizando com a mesa</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    minHeight: '88%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xxl,
  },
  progressTrack: {
    width: 180,
    height: 3,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceHigh,
    overflow: 'hidden',
  },
  progressFill: {
    width: '38%',
    height: '100%',
    backgroundColor: theme.colors.primary,
  },
  status: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2.4,
  },
});

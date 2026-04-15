import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { PropsWithChildren, ReactNode } from 'react';
import { theme } from '@/theme';
import { AppBottomNav } from '@/features/navigation/components/AppBottomNav';
import { useResponsive } from '@/hooks/useResponsive';

interface ScreenProps extends PropsWithChildren {
  withBottomNav?: boolean;
  stickyFooter?: ReactNode;
  centered?: boolean;
}

export function Screen({ children, withBottomNav = false, stickyFooter, centered = false }: ScreenProps) {
  const { contentMaxWidth, horizontalPadding, isDesktop, isPhone } = useResponsive();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.root}>
        <BackgroundDecor />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            {
              paddingHorizontal: horizontalPadding,
              paddingBottom: withBottomNav ? theme.layout.bottomNavHeight + theme.spacing.xxxl : theme.spacing.xxxl,
              alignItems: centered ? 'center' : 'stretch',
            },
          ]}>
          <View style={[styles.inner, { maxWidth: contentMaxWidth }, isDesktop && styles.desktopInner]}>{children}</View>
        </ScrollView>
        {stickyFooter ? <View style={[styles.footer, { left: horizontalPadding, right: horizontalPadding, bottom: theme.layout.bottomNavHeight + (isPhone ? theme.spacing.sm : theme.spacing.md) }]}>{stickyFooter}</View> : null}
        {withBottomNav ? <AppBottomNav /> : null}
      </View>
    </SafeAreaView>
  );
}

function BackgroundDecor() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={['#131313', '#101010', '#121615']} locations={[0, 0.7, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.goldGlow} />
      <View style={styles.cyanGlow} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
  },
  content: {
    paddingTop: theme.spacing.md,
    width: '100%',
  },
  inner: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'center',
    gap: theme.spacing.xl,
  },
  desktopInner: {
    gap: theme.spacing.xxl,
  },
  footer: {
    position: 'absolute',
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    bottom: theme.layout.bottomNavHeight + theme.spacing.md,
  },
  goldGlow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: 'rgba(242, 202, 80, 0.08)',
    top: 80,
    left: -120,
  },
  cyanGlow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 228, 241, 0.08)',
    right: -120,
    bottom: 80,
  },
});

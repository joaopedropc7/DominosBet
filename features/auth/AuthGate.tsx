import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { theme } from '@/theme';

const publicRoutes = new Set(['/', '/splash', '/login', '/cadastro', '/seja-afiliado']);

export function AuthGate({ children }: PropsWithChildren) {
  const { isLoading, session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const inMainGroup      = segments[0] === '(main)';
    const inAdminGroup     = segments[0] === 'admin';
    const inAfiliadoGroup  = segments[0] === 'afiliado';
    const isPublicRoute    = publicRoutes.has(pathname);

    if (!session && (inMainGroup || inAdminGroup || inAfiliadoGroup)) {
      router.replace('/login');
      return;
    }

    if (session && isPublicRoute) {
      router.replace('/(main)/home');
    }
  }, [isLoading, pathname, router, segments, session]);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
        }}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

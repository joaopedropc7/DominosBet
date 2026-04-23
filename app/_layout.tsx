import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { AuthGate } from '@/features/auth/AuthGate';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { UserDataProvider } from '@/features/data/UserDataProvider';
import { supabase } from '@/services/supabase';
import { theme } from '@/theme';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'splash',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // Aplica título e meta tags SEO vindos do banco
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    supabase.rpc('get_seo_settings').then(({ data }) => {
      if (!data) return;
      const title = data.seo_title?.trim();
      const desc  = data.seo_description?.trim();
      const kw    = data.seo_keywords?.trim();

      if (title) document.title = title;

      function setMeta(name: string, content: string) {
        if (!content) return;
        let el = document.querySelector(`meta[name="${name}"]`);
        if (!el) {
          el = document.createElement('meta');
          el.setAttribute('name', name);
          document.head.appendChild(el);
        }
        el.setAttribute('content', content);
      }

      setMeta('description', desc ?? '');
      setMeta('keywords',    kw   ?? '');
    });
  }, []);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  const navigationTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: theme.colors.background,
      card: theme.colors.surface,
      border: theme.colors.outline,
      primary: theme.colors.primary,
      text: theme.colors.text,
      notification: theme.colors.accent,
    },
  };

  return (
    <AuthProvider>
      <ThemeProvider value={navigationTheme}>
        <UserDataProvider>
          <AuthGate>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="splash" options={{ headerShown: false }} />
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="cadastro" options={{ headerShown: false }} />
              <Stack.Screen name="(main)" options={{ headerShown: false }} />
              <Stack.Screen name="admin" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" options={{ headerShown: false }} />
            </Stack>
          </AuthGate>
        </UserDataProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

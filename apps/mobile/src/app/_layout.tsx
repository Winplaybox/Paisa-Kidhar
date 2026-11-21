import { BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque';
import { InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BackButton } from '@/design-system/BackButton';
import { ThemeProvider, useTheme } from '@/design-system/ThemeProvider';
import { AuthProvider } from '@/lib/auth';
import { initLanguage } from '@/i18n';
import { initFirebase } from '@/lib/firebase';
import { queryClient } from '@/lib/queries';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Native: sheets slide up. Web: a normal page so the header and back button always show.
const MODAL = Platform.OS === 'web' ? 'card' : 'modal';

function Shell() {
  const t = useTheme();
  useEffect(() => { SystemUI.setBackgroundColorAsync(t.colors.bg).catch(() => {}); }, [t.colors.bg]);
  return (
    <>
      <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.colors.bg },
          headerTintColor: t.colors.text,
          headerTitleStyle: { fontFamily: t.font.displaySemi },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.colors.bg },
          animation: 'slide_from_right',
          headerBackVisible: false,
          headerLeft: () => <BackButton fallback="/home" />,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
        <Stack.Screen name="r/[slug]" options={{ headerShown: false }} />
        <Stack.Screen name="card/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="card/new" options={{ headerShown: false }} />
        <Stack.Screen name="registry/setup" options={{ title: 'Your registry', presentation: MODAL }} />
        <Stack.Screen name="goal/[id]" options={{ title: 'Goal', presentation: MODAL }} />
        <Stack.Screen name="premium" options={{ title: 'Premium', presentation: MODAL }} />
        <Stack.Screen name="billing/return" options={{ title: 'Payment' }} />
        <Stack.Screen name="admin" options={{ title: 'Admin' }} />
        <Stack.Screen name="legal/[doc]" options={{ title: '', headerLeft: () => <BackButton fallback="/" /> }} />
        <Stack.Screen name="reset-password" options={{ title: 'New password' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  useEffect(() => { initFirebase(); initLanguage(); }, []);
  const [loaded] = useFonts({
    InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold,
    BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold,
  });
  useEffect(() => { if (loaded) SplashScreen.hideAsync().catch(() => {}); }, [loaded]);
  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <Shell />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

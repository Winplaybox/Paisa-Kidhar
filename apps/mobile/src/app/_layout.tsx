import { BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque';
import { InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, useTheme } from '@/design-system/ThemeProvider';
import { AuthProvider } from '@/lib/auth';
import { queryClient } from '@/lib/queries';

SplashScreen.preventAutoHideAsync().catch(() => {});

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
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
        <Stack.Screen name="r/[slug]" options={{ headerShown: false }} />
        <Stack.Screen name="registry/setup" options={{ title: 'Your registry', presentation: 'modal' }} />
        <Stack.Screen name="goal/[id]" options={{ title: 'Goal', presentation: 'modal' }} />
        <Stack.Screen name="premium" options={{ title: 'Premium', presentation: 'modal' }} />
        <Stack.Screen name="billing/return" options={{ title: 'Payment' }} />
        <Stack.Screen name="admin" options={{ title: 'Admin' }} />
        <Stack.Screen name="legal/[doc]" options={{ title: '' }} />
        <Stack.Screen name="reset-password" options={{ title: 'New password' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
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

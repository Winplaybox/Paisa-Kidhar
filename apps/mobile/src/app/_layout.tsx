import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import { Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold } from '@expo-google-fonts/sora';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ToastProvider } from '@/components/Toast';
import { Button, T } from '@/components/ui';
import { useProfile } from '@/data/queries';
import { warmUp } from '@/lib/api';
import { AdsProvider } from '@/providers/ads';
import { AuthProvider, useAuth } from '@/providers/auth';
import { useTheme } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 2, refetchOnWindowFocus: true },
    mutations: { retry: 1 },
  },
});

// React Query "window focus" == app foreground on mobile
AppState.addEventListener('change', (s) => focusManager.setFocused(s === 'active'));

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold,
  });
  if (!fontsLoaded) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <Gate />
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function Gate() {
  const t = useTheme();
  const { session, loading } = useAuth();
  const profile = useProfile();
  const signedIn = !!session;
  const profileReady = signedIn && !profile.isLoading;
  const hasProfile = !!profile.data;
  const booting = loading || (signedIn && profile.isLoading);

  useEffect(() => {
    if (!booting) SplashScreen.hideAsync().catch(() => undefined);
  }, [booting]);

  useEffect(() => { warmUp(); }, []);

  // Tap on notification → deep link
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const url = (r.notification.request.content.data as { url?: string } | null)?.url;
      if (url === '/report') router.push('/report');
    });
    return () => sub.remove();
  }, []);

  if (booting) return null;

  // Network/DB failure must not be mistaken for "new user" → onboarding.
  if (signedIn && profile.isError && profile.data === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
        <T v="h2" center>Connect nahi ho pa raha 📶</T>
        <T muted center>Internet check karo aur dobara try karo.</T>
        <Button title="Retry" onPress={() => { profile.refetch(); }} style={{ alignSelf: 'stretch', marginTop: 8 }} />
      </View>
    );
  }

  const nav = t.mode === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider value={{ ...nav, colors: { ...nav.colors, background: t.bg, card: t.bg, text: t.text, border: t.line, primary: t.accent } }}>
      <StatusBar style={t.mode === 'dark' ? 'light' : 'dark'} />
      <AdsProvider enabled={signedIn && hasProfile}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg }, animation: 'fade_from_bottom' }}>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="sign-in" />
          </Stack.Protected>
          <Stack.Protected guard={profileReady && !hasProfile}>
            <Stack.Screen name="onboarding" />
          </Stack.Protected>
          <Stack.Protected guard={profileReady && hasProfile}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="add" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.92], sheetGrabberVisible: true, sheetCornerRadius: 28, animation: 'slide_from_bottom' }} />
            <Stack.Screen name="import-sms" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.95], sheetGrabberVisible: true, sheetCornerRadius: 28 }} />
            <Stack.Screen name="import-statement" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.95], sheetGrabberVisible: true, sheetCornerRadius: 28 }} />
            <Stack.Screen name="report" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          </Stack.Protected>
        </Stack>
      </AdsProvider>
    </ThemeProvider>
  );
}

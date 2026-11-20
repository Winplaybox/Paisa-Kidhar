import { Redirect, Stack } from 'expo-router';

import { useTheme } from '@/design-system/ThemeProvider';
import { useAuth } from '@/lib/auth';

export default function AuthLayout() {
  const { ready, session } = useAuth();
  const t = useTheme();
  if (ready && session) return <Redirect href="/home" />;
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: t.colors.bg }, headerTintColor: t.colors.text, headerShadowVisible: false,
      headerTitle: '', contentStyle: { backgroundColor: t.colors.bg } }}>
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
    </Stack>
  );
}

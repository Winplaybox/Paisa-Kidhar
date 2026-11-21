import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useTheme } from '@/design-system/ThemeProvider';
import { useAuth } from '@/lib/auth';

export default function Index() {
  const { ready, session } = useAuth();
  const t = useTheme();
  if (!ready) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.bg }}><ActivityIndicator color={t.colors.accent} /></View>;
  }
  return <Redirect href={session ? '/home' : '/welcome'} />;
}

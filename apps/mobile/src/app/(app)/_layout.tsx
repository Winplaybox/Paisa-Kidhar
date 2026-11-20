import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';

import { useTheme } from '@/design-system/ThemeProvider';
import { useAuth } from '@/lib/auth';

type IconName = ComponentProps<typeof Ionicons>['name'];
const tab = (title: string, icon: IconName, iconActive: IconName) => ({
  title,
  tabBarIcon: ({ color, focused }: { color: import('react-native').ColorValue; focused: boolean }) => <Ionicons name={focused ? iconActive : icon} size={24} color={color as string} />,
});

export default function AppLayout() {
  const { ready, session } = useAuth();
  const t = useTheme();
  if (ready && !session) return <Redirect href="/welcome" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.colors.accent,
        tabBarInactiveTintColor: t.colors.textMuted,
        tabBarStyle: { backgroundColor: t.colors.surface, borderTopColor: t.colors.border, height: 64, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: t.font.semibold, fontSize: 12 },
        sceneStyle: { backgroundColor: t.colors.bg },
      }}
    >
      <Tabs.Screen name="home" options={tab('Home', 'home-outline', 'home')} />
      <Tabs.Screen name="goals" options={tab('My Registry', 'gift-outline', 'gift')} />
      <Tabs.Screen name="gifts" options={tab('Gifts', 'wallet-outline', 'wallet')} />
      <Tabs.Screen name="settings" options={tab('Profile', 'person-circle-outline', 'person-circle')} />
    </Tabs>
  );
}

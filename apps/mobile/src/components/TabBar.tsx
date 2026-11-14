import type { BottomTabBarProps } from 'expo-router/tabs';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { T, Tap } from '@/components/ui';
import { font, useTheme } from '@/theme/tokens';

const ICONS: Record<string, { icon: string; label: string }> = {
  index: { icon: '🏠', label: 'Today' },
  insights: { icon: '📊', label: 'Insights' },
  history: { icon: '🧾', label: 'History' },
  settings: { icon: '⚙️', label: 'Settings' },
};

export function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const routes = state.routes;
  const left = routes.slice(0, 2);
  const right = routes.slice(2);

  const item = (r: (typeof routes)[number]) => {
    const idx = routes.indexOf(r);
    const focused = state.index === idx;
    const meta = ICONS[r.name] ?? { icon: '•', label: r.name };
    return (
      <Tap
        key={r.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={meta.label}
        onPress={() => { if (!focused) navigateToTab(r.key); }}
        style={{ flex: 1, alignItems: 'center', paddingVertical: 6, gap: 2 }}
      >
        <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{meta.icon}</Text>
        <T v="caption" color={focused ? t.accent : t.textMuted} style={{ fontSize: 11, fontFamily: focused ? font.bodySemi : font.bodyMedium }}>{meta.label}</T>
      </Tap>
    );
  };

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 60 : 0}
        tint={t.mode === 'dark' ? 'dark' : 'light'}
        style={{
          paddingBottom: Math.max(insets.bottom, 8), paddingTop: 6, flexDirection: 'row', alignItems: 'center',
          backgroundColor: t.mode === 'dark' ? 'rgba(11,15,26,0.96)' : 'rgba(255,255,255,0.97)',
          borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line,
        }}
      >
        {left.map(item)}
        <View style={{ width: 76, alignItems: 'center' }}>
          <Tap
            accessibilityRole="button"
            accessibilityLabel="Kharcha add karo"
            scaleTo={0.9}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined); router.push('/add'); }}
            style={{
              width: 58, height: 58, borderRadius: 20, backgroundColor: t.accent, marginTop: -26,
              alignItems: 'center', justifyContent: 'center',
              shadowColor: t.accent, shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8,
            }}
          >
            <Text style={{ fontSize: 30, color: t.accentText, fontFamily: font.displayBold, marginTop: -2 }}>+</Text>
          </Tap>
        </View>
        {right.map(item)}
      </BlurView>
    </View>
  );
}

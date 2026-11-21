/* Header back button for every pushed screen. Deep links (no history) fall back to the dashboard / home. */
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { useTheme } from './ThemeProvider';

export function goBackOr(fallback: string) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as never);
}

export function BackButton({ fallback = '/', color }: { fallback?: string; color?: string }) {
  const t = useTheme();
  return (
    <Pressable onPress={() => goBackOr(fallback)} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12}
      style={({ pressed }) => ({
        width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginLeft: -6,
        backgroundColor: pressed ? t.colors.bgAlt : 'transparent',
      })}>
      <Ionicons name="arrow-back" size={24} color={color ?? t.colors.text} />
    </Pressable>
  );
}

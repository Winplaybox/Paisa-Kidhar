/* OVD-contract primitives for React Native + web. Every colour/size comes from the theme. */
import { FluidBackground } from './FluidBackground';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator, Animated, Platform, Pressable, ScrollView, Text as RNText, TextInput, View,
  type GestureResponderEvent, type PressableProps, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { Anim } from './Anim';
import { useTheme } from './ThemeProvider';
import type { Theme } from './theme';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption';

export function Text({ variant = 'body', muted, color, style, children, ...rest }: ComponentProps<typeof RNText> & {
  variant?: Variant; muted?: boolean; color?: string;
}) {
  const t = useTheme();
  const map: Record<Variant, TextStyle> = {
    display: { fontFamily: t.font.display, fontSize: t.size.display, lineHeight: t.size.display * 1.1, letterSpacing: -0.7 },
    title: { fontFamily: t.font.display, fontSize: t.size.xxl, lineHeight: t.size.xxl * 1.15, letterSpacing: -0.5 },
    heading: { fontFamily: t.font.displaySemi, fontSize: t.size.lg, lineHeight: t.size.lg * 1.3, letterSpacing: -0.2 },
    body: { fontFamily: t.font.body, fontSize: t.size.md, lineHeight: t.size.md * 1.55 },
    label: { fontFamily: t.font.semibold, fontSize: t.size.sm, lineHeight: t.size.sm * 1.4 },
    caption: { fontFamily: t.font.body, fontSize: t.size.xs, lineHeight: t.size.xs * 1.5 },
  };
  return (
    <RNText
      maxFontSizeMultiplier={1.6}
      accessibilityRole={variant === 'display' || variant === 'title' || variant === 'heading' ? 'header' : undefined}
      style={[map[variant], { color: color ?? (muted ? t.colors.textMuted : t.colors.text) }, style]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

export function Screen({ children, scroll = true, padded = true, style, edges, fluid }: {
  children: ReactNode; scroll?: boolean; padded?: boolean; style?: StyleProp<ViewStyle>; edges?: ('top' | 'bottom')[]; fluid?: boolean;
}) {
  const t = useTheme();
  const inner: ViewStyle = { padding: padded ? t.space.lg : 0, gap: t.space.lg, width: '100%', maxWidth: 760, alignSelf: 'center' };
  return (
    <SafeAreaView edges={edges ?? ['bottom']} style={{ flex: 1, backgroundColor: t.colors.bg }}>
      {fluid ? <FluidBackground /> : null}
      {scroll ? (
        <ScrollView contentContainerStyle={[inner, { paddingBottom: t.space.xxxl }, style]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style, tone = 'surface', onPress, accessibilityLabel }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'surface' | 'accent' | 'alt';
  onPress?: () => void; accessibilityLabel?: string;
}) {
  const t = useTheme();
  const bg = tone === 'accent' ? t.colors.accentBg : tone === 'alt' ? t.colors.bgAlt : t.colors.surface;
  const base: ViewStyle = {
    backgroundColor: bg, borderRadius: t.radius.lg, borderWidth: 1, borderColor: tone === 'surface' ? t.colors.border : 'transparent',
    padding: t.space.lg, gap: t.space.sm, ...(tone === 'surface' ? t.elevation(1) : {}),
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}
      style={({ pressed }) => [base, { transform: [{ scale: pressed ? 0.985 : 1 }] }, style]}>
      {children}
    </Pressable>
  );
}

type ButtonKind = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';

export function Button({ title, onPress, kind = 'primary', loading, disabled, icon, style, full = true, accessibilityHint }: {
  title: string; onPress?: () => void; kind?: ButtonKind; loading?: boolean; disabled?: boolean;
  icon?: ComponentProps<typeof Ionicons>['name']; style?: StyleProp<ViewStyle>; full?: boolean; accessibilityHint?: string;
}) {
  const t = useTheme();
  const palette: Record<ButtonKind, { bg: string; fg: string; border: string }> = {
    primary: { bg: t.colors.primary, fg: t.colors.onPrimary, border: t.colors.primary },
    accent: { bg: t.colors.accent, fg: t.colors.onAccent, border: t.colors.accent },
    secondary: { bg: t.colors.surface, fg: t.colors.text, border: t.colors.border },
    ghost: { bg: 'transparent', fg: t.colors.text, border: 'transparent' },
    danger: { bg: t.colors.negativeBg, fg: t.colors.negative, border: t.colors.negativeBg },
  };
  const p = palette[kind];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button" accessibilityState={{ disabled: !!off, busy: !!loading }} accessibilityHint={accessibilityHint}
      disabled={off}
      onPress={() => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); onPress?.(); }}
      style={({ pressed }) => [{
        minHeight: 52, paddingHorizontal: t.space.xl, borderRadius: t.radius.pill, backgroundColor: p.bg,
        borderWidth: 1.5, borderColor: p.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row',
        gap: t.space.sm, opacity: off ? 0.55 : 1, transform: [{ scale: pressed ? 0.98 : 1 }],
        alignSelf: full ? 'stretch' : 'flex-start',
      }, style]}
    >
      {loading ? <ActivityIndicator color={p.fg} /> : icon ? <Ionicons name={icon} size={18} color={p.fg} /> : null}
      <RNText style={{ color: p.fg, fontFamily: t.font.semibold, fontSize: t.size.md }}>{title}</RNText>
    </Pressable>
  );
}

export function Field({ label, error, hint, style, ...input }: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  const t = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={t.colors.textMuted}
        onFocus={(e) => { setFocus(true); input.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); input.onBlur?.(e); }}
        style={[{
          minHeight: 52, borderRadius: t.radius.md, borderWidth: 2, paddingHorizontal: t.space.lg, paddingVertical: 12,
          borderColor: error ? t.colors.negative : focus ? t.colors.accent : t.colors.border,
          backgroundColor: t.colors.surface, color: t.colors.text, fontFamily: t.font.body, fontSize: t.size.md,
          ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
        }, input.multiline ? { minHeight: 96, textAlignVertical: 'top' } : null, style]}
        {...input}
      />
      {error ? <Text variant="caption" color={t.colors.negative} accessibilityLiveRegion="polite">{error}</Text>
        : hint ? <Text variant="caption" muted>{hint}</Text> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress, color }: { label: string; selected?: boolean; onPress?: (e?: GestureResponderEvent) => void; color?: string }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!selected }} onPress={onPress}
      style={{
        minHeight: t.touch, paddingHorizontal: t.space.lg, borderRadius: t.radius.pill, justifyContent: 'center', flexDirection: 'row',
        alignItems: 'center', gap: 6, borderWidth: 1.5,
        borderColor: selected ? (color ?? t.colors.accent) : t.colors.border,
        backgroundColor: selected ? t.colors.accentBg : t.colors.surface,
      }}>
      {color ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }} /> : null}
      <RNText style={{ fontFamily: t.font.semibold, fontSize: t.size.sm, color: selected ? t.colors.accent : t.colors.text }}>{label}</RNText>
    </Pressable>
  );
}

export function ProgressBar({ value, color, height = 10, label }: { value: number; color?: string; height?: number; label?: string }) {
  const t = useTheme();
  const v = Math.max(0, Math.min(1, value || 0));
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: v, duration: t.motion.slow * 2, useNativeDriver: false }).start();
  }, [v, anim, t.motion.slow]);
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
      style={{ height, borderRadius: height, backgroundColor: t.colors.bgAlt, overflow: 'hidden' }}>
      <Animated.View style={{ height, borderRadius: height, backgroundColor: color ?? t.colors.accent,
        width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
    </View>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const t = useTheme();
  return (
    <Card style={{ flex: 1, minWidth: 150, gap: 4 }}>
      <Text variant="caption" muted>{label}</Text>
      <Text variant="heading" style={{ fontSize: t.size.xl }}>{value}</Text>
      {sub ? <Text variant="caption" muted>{sub}</Text> : null}
    </Card>
  );
}

export function Banner({ tone = 'info', title, body, action }: {
  tone?: 'info' | 'positive' | 'warning' | 'negative'; title: string; body?: string; action?: ReactNode;
}) {
  const t = useTheme();
  const c = {
    info: [t.colors.accentBg, t.colors.accent, 'information-circle'],
    positive: [t.colors.positiveBg, t.colors.positive, 'checkmark-circle'],
    warning: [t.colors.warningBg, t.colors.warning, 'alert-circle'],
    negative: [t.colors.negativeBg, t.colors.negative, 'close-circle'],
  }[tone] as [string, string, ComponentProps<typeof Ionicons>['name']];
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: c[0], borderRadius: t.radius.md, padding: t.space.lg, flexDirection: 'row', gap: t.space.md }}>
      <Ionicons name={c[2]} size={22} color={c[1]} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="label" color={c[1]}>{title}</Text>
        {body ? <Text variant="caption">{body}</Text> : null}
        {action}
      </View>
    </View>
  );
}

export function EmptyState({ icon, title, body, action, animated }: {
  icon: ComponentProps<typeof Ionicons>['name']; title: string; body: string; action?: ReactNode; animated?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: t.space.xxl, gap: t.space.md }}>
      {animated ? <Anim name="gift" size={150} loop /> : (
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: t.colors.accentBg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={32} color={t.colors.accent} />
        </View>
      )}
      <Text variant="heading" style={{ textAlign: 'center' }}>{title}</Text>
      <Text muted style={{ textAlign: 'center', maxWidth: 420 }}>{body}</Text>
      {action}
    </View>
  );
}

export function Skeleton({ height = 20, width = '100%', radius }: { height?: number; width?: ViewStyle['width']; radius?: number }) {
  const t = useTheme();
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View accessibilityElementsHidden style={{ height, width, borderRadius: radius ?? t.radius.sm, backgroundColor: t.colors.bgAlt, opacity: pulse }} />;
}

export function LoadingList({ rows = 3 }: { rows?: number }) {
  const t = useTheme();
  const { t: tx } = useI18n();
  return (
    <View style={{ gap: t.space.md }} accessibilityLabel={tx('cm_loading')}>
      {Array.from({ length: rows }).map((_, i) => (
        <Card key={i}><Skeleton width="60%" /><Skeleton height={12} /><Skeleton height={10} width="40%" /></Card>
      ))}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t: tx } = useI18n();
  return (
    <EmptyState icon="cloud-offline-outline" title={tx('cm_cant_load')} body={message}
      action={onRetry ? <Button title={tx('cm_try_again')} kind="secondary" full={false} icon="refresh" onPress={onRetry} /> : undefined} />
  );
}

export function Row({ children, gap, style, wrap }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; wrap?: boolean }) {
  const t = useTheme();
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: gap ?? t.space.md, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: 1, backgroundColor: t.colors.border }} />;
}

export function IconButton({ icon, label, onPress, color }: {
  icon: ComponentProps<typeof Ionicons>['name']; label: string; onPress: PressableProps['onPress']; color?: string;
}) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8}
      style={({ pressed }) => ({ width: t.touch, height: t.touch, borderRadius: t.touch / 2, alignItems: 'center', justifyContent: 'center',
        backgroundColor: pressed ? t.colors.bgAlt : 'transparent' })}>
      <Ionicons name={icon} size={22} color={color ?? t.colors.text} />
    </Pressable>
  );
}

export type { Theme };

export function OrDivider() {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md }}>
      <View style={{ flex: 1, height: 1, backgroundColor: t.colors.border }} />
      <Text variant="caption" muted>or</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: t.colors.border }} />
    </View>
  );
}

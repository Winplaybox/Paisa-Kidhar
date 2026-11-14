import * as Haptics from 'expo-haptics';
import { useEffect, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';

import { font, radius, space, useTheme } from '@/theme/tokens';

/* ---------------- Text ---------------- */
type Variant = 'hero' | 'h1' | 'h2' | 'title' | 'body' | 'bodyStrong' | 'caption' | 'label' | 'num' | 'numLg';
const VARIANTS: Record<Variant, TextStyle> = {
  hero: { fontFamily: font.num, fontSize: 40, letterSpacing: -1.4, lineHeight: 48 },
  h1: { fontFamily: font.display, fontSize: 28, letterSpacing: -0.6, lineHeight: 34 },
  h2: { fontFamily: font.displayBold, fontSize: 20, letterSpacing: -0.3, lineHeight: 26 },
  title: { fontFamily: font.displaySemi, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: font.body, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: font.bodySemi, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: font.body, fontSize: 12.5, lineHeight: 17 },
  label: { fontFamily: font.bodySemi, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', lineHeight: 14 },
  num: { fontFamily: font.num, fontSize: 16, fontVariant: ['tabular-nums'] },
  numLg: { fontFamily: font.num, fontSize: 22, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
};

export function T({ v = 'body', color, muted, center, style, ...rest }: TextProps & { v?: Variant; color?: string; muted?: boolean; center?: boolean }) {
  const t = useTheme();
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={1.3}
      style={[VARIANTS[v], { color: color ?? (muted ? t.textMuted : t.text) }, center && { textAlign: 'center' }, style]}
    />
  );
}

/* ---------------- Surfaces ---------------- */
export function Card({ children, style, pad = space.lg }: { children: ReactNode; style?: StyleProp<ViewStyle>; pad?: number }) {
  const t = useTheme();
  return (
    <View style={[{ backgroundColor: t.card, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: t.line, padding: pad }, style]}>
      {children}
    </View>
  );
}

export function Row({ children, style, gap = space.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function SectionTitle({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginBottom: space.md }}>
      <T v="title">{title}</T>
      {right}
    </Row>
  );
}

/* ---------------- Pressables ---------------- */
const APressable = Animated.createAnimatedComponent(Pressable);

export function Tap({ children, style, onPress, haptic = true, scaleTo = 0.96, disabled, ...rest }: PressableProps & { style?: StyleProp<ViewStyle>; haptic?: boolean; scaleTo?: number; children?: ReactNode }) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));
  return (
    <APressable
      {...rest}
      disabled={disabled}
      onPressIn={() => { s.set(withSpring(scaleTo, { damping: 20, stiffness: 400 })); }}
      onPressOut={() => { s.set(withSpring(1, { damping: 14, stiffness: 300 })); }}
      onPress={(e) => {
        if (haptic) Haptics.selectionAsync().catch(() => undefined);
        onPress?.(e);
      }}
      style={[a, style, disabled && { opacity: 0.5 }]}
    >
      {children}
    </APressable>
  );
}

export function Button({ title, onPress, kind = 'primary', loading, disabled, icon, style }: {
  title: string; onPress?: () => void; kind?: 'primary' | 'ghost' | 'danger' | 'soft'; loading?: boolean; disabled?: boolean; icon?: string; style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.accent : kind === 'soft' ? t.cardAlt : 'transparent';
  const fg = kind === 'primary' ? t.accentText : kind === 'danger' ? t.danger : t.text;
  const border = kind === 'ghost' ? t.line : kind === 'danger' ? t.danger + '55' : 'transparent';
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      disabled={disabled || loading}
      style={[{ backgroundColor: bg, borderColor: border, borderWidth: 1, borderRadius: radius.md, paddingVertical: 15, paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon ? <Text style={{ fontSize: 16 }}>{icon}</Text> : null}
          <T v="bodyStrong" color={fg} style={{ fontFamily: kind === 'primary' ? font.bodyBold : font.bodySemi }}>{title}</T>
        </>
      )}
    </Tap>
  );
}

/* ---------------- Inputs ---------------- */
export function Input({ label, big, style, ...rest }: TextInputProps & { label?: string; big?: boolean }) {
  const t = useTheme();
  const focus = useSharedValue(0);
  const a = useAnimatedStyle(() => ({ borderColor: focus.get() ? t.accent : t.line }));
  return (
    <View style={{ marginBottom: space.md }}>
      {label ? <T v="caption" muted style={{ marginBottom: 6 }}>{label}</T> : null}
      <Animated.View style={[{ borderWidth: 1, borderRadius: radius.md, backgroundColor: t.bgElevated }, a]}>
        <TextInput
          placeholderTextColor={t.textFaint}
          selectionColor={t.accent}
          {...rest}
          onFocus={(e) => { focus.set(withTiming(1)); rest.onFocus?.(e); }}
          onBlur={(e) => { focus.set(withTiming(0)); rest.onBlur?.(e); }}
          style={[
            { color: t.text, paddingHorizontal: 14, paddingVertical: big ? 16 : 13, fontFamily: big ? font.display : font.body, fontSize: big ? 34 : 15, textAlign: big ? 'center' : 'left' },
            style,
          ]}
        />
      </Animated.View>
    </View>
  );
}

export function Segmented<K extends string>({ value, options, onChange }: { value: K; options: { key: K; label: string }[]; onChange: (k: K) => void }) {
  const t = useTheme();
  return (
    <Row gap={4} style={{ backgroundColor: t.bgElevated, borderRadius: radius.md, padding: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: t.line }}>
      {options.map((o) => {
        const sel = o.key === value;
        return (
          <Tap key={o.key} onPress={() => onChange(o.key)} style={{ flex: 1, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: sel ? t.cardAlt : 'transparent', alignItems: 'center' }}>
            <T v="caption" color={sel ? t.text : t.textMuted} style={{ fontFamily: sel ? font.bodySemi : font.bodyMedium }}>{o.label}</T>
          </Tap>
        );
      })}
    </Row>
  );
}

export function ToggleRow({ title, subtitle, value, onChange }: { title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: space.md }}>
      <View style={{ flex: 1, paddingRight: space.md }}>
        <T v="bodyStrong">{title}</T>
        {subtitle ? <T v="caption" muted>{subtitle}</T> : null}
      </View>
      <Switch value={value} onValueChange={(v) => { Haptics.selectionAsync().catch(() => undefined); onChange(v); }} trackColor={{ true: t.accent, false: t.line }} thumbColor="#fff" />
    </Row>
  );
}

export function Pill({ text, color, bg }: { text: string; color?: string; bg?: string }) {
  const t = useTheme();
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: bg ?? t.cardAlt }}>
      <T v="caption" color={color ?? t.textMuted} style={{ fontFamily: font.bodySemi }}>{text}</T>
    </View>
  );
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.line }} />;
}

export function Skeleton({ h = 16, w = '100%', r = 8, style }: { h?: number; w?: number | `${number}%`; r?: number; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const o = useSharedValue(0.45);
  useEffect(() => { o.set(withRepeat(withTiming(1, { duration: 750 }), -1, true)); }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.get() }));
  return <Animated.View style={[{ height: h, width: w, borderRadius: r, backgroundColor: t.cardAlt }, a, style]} />;
}

export function Empty({ emoji, title, body, action }: { emoji: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xl, gap: 6 }}>
      <Text style={{ fontSize: 34 }}>{emoji}</Text>
      <T v="bodyStrong" center>{title}</T>
      {body ? <T v="caption" muted center style={{ maxWidth: 260 }}>{body}</T> : null}
      {action ? <View style={{ marginTop: space.sm }}>{action}</View> : null}
    </View>
  );
}

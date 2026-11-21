/* Slow, soft "fluid" gradient blobs behind a screen. Theme-aware (light/dark), pure RN Animated + SVG, no assets.
   Respects reduce-motion (static). Sits behind content and never intercepts touches. */
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from './ThemeProvider';

const native = Platform.OS !== 'web';

function Blob({ color, size, x, y, dx, dy, ms, opacity, reduced }: {
  color: string; size: number; x: number; y: number; dx: number; dy: number; ms: number; opacity: number; reduced: boolean;
}) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(p, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      Animated.timing(p, { toValue: 0, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [p, ms, reduced]);
  const id = `g${color.replace('#', '')}${size}`;
  return (
    <Animated.View
      style={{
        position: 'absolute', left: x, top: y, width: size, height: size, opacity,
        transform: [
          { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
          { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
          { scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) },
        ],
      }}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity="1" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

export function FluidBackground({ intensity = 1 }: { intensity?: number }) {
  const t = useTheme();
  const { width, height } = useWindowDimensions();
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  const dark = t.colors.bg.toLowerCase() < '#808080'; // cheap light/dark check from the bg token
  const a = dark ? 0.32 : 0.22;
  const big = Math.min(Math.max(width, 360) * 0.95, 720);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Blob color={t.colors.accent} size={big} x={-big * 0.3} y={-big * 0.25} dx={big * 0.18} dy={big * 0.12} ms={9000} opacity={a * intensity} reduced={reduced} />
      <Blob color={dark ? '#6D5BFF' : '#FFB36B'} size={big * 0.85} x={width - big * 0.55} y={height * 0.25} dx={-big * 0.15} dy={big * 0.2} ms={11000} opacity={a * 0.9 * intensity} reduced={reduced} />
      <Blob color={dark ? '#1FB5A8' : '#FF8FB1'} size={big * 0.7} x={-big * 0.15} y={height * 0.62} dx={big * 0.22} dy={-big * 0.12} ms={13000} opacity={a * 0.8 * intensity} reduced={reduced} />
    </View>
  );
}

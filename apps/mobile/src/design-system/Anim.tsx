/* Lottie animations (native: lottie-react-native, web: dotLottie). Respects the OS "reduce motion" setting. */
import './lottie-setup';
import LottieView from 'lottie-react-native';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, useWindowDimensions, View, type ViewStyle } from 'react-native';

const SOURCES = {
  success: require('../../assets/lottie/success.json'),
  heart: require('../../assets/lottie/heart-burst.json'),
  confetti: require('../../assets/lottie/confetti.json'),
  gift: require('../../assets/lottie/gift.json'),
} as const;

export type AnimName = keyof typeof SOURCES;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}

export function Anim({ name, size = 140, width, height, cover, loop = false, style, onFinish }: {
  name: AnimName; size?: number; width?: number; height?: number; cover?: boolean; loop?: boolean; style?: ViewStyle; onFinish?: () => void;
}) {
  const reduced = useReducedMotion();
  const w = width ?? size;
  const h = height ?? size;
  return (
    <View style={[{ width: w, height: h }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
      <LottieView
        source={SOURCES[name]}
        autoPlay={!reduced}
        loop={loop && !reduced}
        progress={reduced ? 1 : undefined}
        resizeMode={cover ? 'cover' : 'contain'}
        style={{ width: w, height: h }}
        webStyle={{ width: w, height: h, objectFit: cover ? 'cover' : 'contain' } as object}
        onAnimationFinish={onFinish}
      />
    </View>
  );
}

/** Full-screen confetti burst that removes itself when done (timer fallback: web players don't always report completion). */
export function ConfettiBurst({ show, durationMs = 3000 }: { show: boolean; durationMs?: number }) {
  const [visible, setVisible] = useState(show);
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!show) return;
    setVisible(true);
    const id = setTimeout(() => setVisible(false), durationMs);
    return () => clearTimeout(id);
  }, [show, durationMs]);
  if (!visible || reduced) return null;
  return (
    <View pointerEvents="none"
      style={{ position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', overflow: 'hidden', zIndex: 50 }}>
      {Platform.OS === 'web'
        // dotLottie on web always 'contains', so tile portrait columns across wide screens (mirrored for variety).
        ? <View style={{ flexDirection: 'row' }}>
            {Array.from({ length: Math.max(1, Math.ceil(width / (height / 2))) }).map((_, i) => (
              <Anim key={i} name="confetti" width={height / 2} height={height} style={i % 2 ? { transform: [{ scaleX: -1 }] } : undefined}
                onFinish={i === 0 ? () => setVisible(false) : undefined} />
            ))}
          </View>
        : <Anim name="confetti" width={width} height={height} cover onFinish={() => setVisible(false)} />}
    </View>
  );
}

/** Centered one-shot overlay (e.g. a heart when the couple confirms a gift). Re-triggers whenever `trigger` changes. */
export function Pop({ trigger, name = 'heart', size = 180, durationMs = 1600 }: { trigger: number; name?: AnimName; size?: number; durationMs?: number }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!trigger) return;
    setOn(true);
    const id = setTimeout(() => setOn(false), durationMs);
    return () => clearTimeout(id);
  }, [trigger, durationMs]);
  if (!on) return null;
  return (
    <View pointerEvents="none" style={{ position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <Anim key={trigger} name={name} size={size} />
    </View>
  );
}

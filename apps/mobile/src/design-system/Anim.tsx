/* Lottie animations (native: lottie-react-native, web: dotLottie). Respects the OS "reduce motion" setting. */
import './lottie-setup';
import LottieView from 'lottie-react-native';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, View, type ViewStyle } from 'react-native';

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

export function Anim({ name, size = 140, loop = false, style, onFinish }: {
  name: AnimName; size?: number; loop?: boolean; style?: ViewStyle; onFinish?: () => void;
}) {
  const reduced = useReducedMotion();
  return (
    <View style={[{ width: size, height: size }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
      <LottieView
        source={SOURCES[name]}
        autoPlay={!reduced}
        loop={loop && !reduced}
        progress={reduced ? 1 : undefined}
        resizeMode="contain"
        style={{ width: size, height: size }}
        webStyle={{ width: size, height: size }}
        onAnimationFinish={onFinish}
      />
    </View>
  );
}

/** Full-screen confetti burst that removes itself when done. */
export function ConfettiBurst({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(show);
  useEffect(() => { if (show) setVisible(true); }, [show]);
  if (!visible) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', zIndex: 10 }}>
      <Anim name="confetti" size={420} onFinish={() => setVisible(false)} />
    </View>
  );
}

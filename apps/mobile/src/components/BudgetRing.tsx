import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { useTheme } from '@/theme/tokens';

const ACircle = Animated.createAnimatedComponent(Circle);

export function BudgetRing({ progress, over, size = 240, stroke = 18, children }: {
  progress: number; over: boolean; size?: number; stroke?: number; children?: React.ReactNode;
}) {
  const t = useTheme();
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const p = useSharedValue(0);

  useEffect(() => {
    p.set(withTiming(Math.max(0, Math.min(1, progress)), { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [progress, p]);

  const props = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - p.get()) }));
  const warn = !over && progress > 0.8;
  const [c1, c2] = over ? [t.coral, '#FF8A5B'] : warn ? [t.amber, '#FACC15'] : [t.accent, '#5EE6A8'];

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={c1} />
            <Stop offset="1" stopColor={c2} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.ringTrack} strokeWidth={stroke} fill="none" />
        <ACircle
          cx={size / 2} cy={size / 2} r={r}
          stroke="url(#ring)" strokeWidth={stroke} strokeLinecap="round" fill="none"
          strokeDasharray={`${C} ${C}`}
          animatedProps={props}
        />
      </Svg>
      {children}
    </View>
  );
}

/* Animated presentation of a Shagun Card: envelope-open reveal (RN Animated, native driver) + soft Lottie ambience
   (petals / sparkles / hearts / balloons / diya) + a one-shot fireworks burst on first reveal. Respects "reduce motion". */
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, View } from 'react-native';
import Svg, { Polygon, Rect } from 'react-native-svg';

import { paletteFor, templateById } from '@/cards/catalog';
import { Anim } from '@/design-system/Anim';
import { ShagunCardView, type CardHandle, type CardSpec } from './ShagunCardView';
import { forwardRef } from 'react';

export const CardStage = forwardRef<CardHandle, {
  spec: CardSpec; width: number; reveal?: boolean; autoOpenMs?: number | null; celebrate?: boolean; ambient?: boolean; hint?: string; onOpened?: () => void;
}>(function CardStage({ spec, width, reveal = false, autoOpenMs = 900, celebrate = false, ambient = true, hint, onOpened }, ref) {
  const h = Math.round(width * 1.5);
  const tpl = templateById(spec.template);
  const p = paletteFor(spec.template, spec.palette);
  const [reduced, setReduced] = useState(false);
  const [opened, setOpened] = useState(!reveal);
  const [boom, setBoom] = useState(false);
  const flap = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(reveal ? 0 : 1)).current;
  const env = useRef(new Animated.Value(0)).current;
  const started = useRef(false);

  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => {}); }, []);

  const open = useCallback(() => {
    if (started.current) return;
    started.current = true;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const done = () => { setOpened(true); if (celebrate && !reduced) { setBoom(true); setTimeout(() => setBoom(false), 3600); } onOpened?.(); };
    if (reduced) { flap.setValue(1); rise.setValue(1); env.setValue(1); done(); return; }
    Animated.sequence([
      Animated.timing(flap, { toValue: 1, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(rise, { toValue: 1, duration: 760, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true }),
      Animated.timing(env, { toValue: 1, duration: 420, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(done);
  }, [celebrate, env, flap, onOpened, reduced, rise]);

  useEffect(() => {
    if (!reveal || autoOpenMs == null) return;
    const id = setTimeout(open, reduced ? 0 : autoOpenMs);
    return () => clearTimeout(id);
  }, [reveal, autoOpenMs, open, reduced]);

  const ew = width * 0.94; const eh = h * 0.5; const etop = h * 0.3;
  const dark = p.accent;
  const cardY = rise.interpolate({ inputRange: [0, 1], outputRange: [h * 0.32, 0] });
  const cardScale = rise.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] });
  const cardOpacity = rise.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 1] });
  const flapDeg = flap.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const flapOpacity = flap.interpolate({ inputRange: [0, 0.55, 0.6, 1], outputRange: [1, 1, 0, 0] });
  const envY = env.interpolate({ inputRange: [0, 1], outputRange: [0, h * 0.35] });
  const envOpacity = env.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const fxOn = ambient && opened && !reduced;
  const diya = tpl.fx.includes('diya');

  return (
    <View style={{ width, height: h, alignItems: 'center' }}>
      <Animated.View style={{ position: 'absolute', transform: [{ translateY: cardY }, { scale: cardScale }], opacity: cardOpacity }}>
        <ShagunCardView ref={ref} spec={spec} width={width} />
      </Animated.View>

      {fxOn ? tpl.fx.filter((f) => f !== 'diya').map((f) => (
        <View key={f} pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width, height: h, overflow: 'hidden', borderRadius: Math.round(width * 0.055) }}>
          <Anim name={f} width={width} height={h} loop />
        </View>
      )) : null}
      {fxOn && diya ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: (200 / 360) * width - width * 0.3, top: (478 / 540) * h - width * 0.3 }}>
          <Anim name="diya" size={width * 0.6} loop />
        </View>
      ) : null}
      {boom ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width, height: h, overflow: 'hidden' }}><Anim name="fireworks" width={width} height={h} /></View> : null}

      {!opened ? (
        <Animated.View style={{ position: 'absolute', top: etop, width: ew, height: eh, opacity: envOpacity, transform: [{ translateY: envY }] }}>
          <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={hint ?? 'Open the card'} style={{ width: ew, height: eh }}>
            <Svg width={ew} height={eh} viewBox="0 0 300 180">
              <Rect x={0} y={0} width={300} height={180} rx={10} fill={dark} />
              <Polygon points="0,180 150,86 300,180" fill={p.soft} opacity={0.95} />
              <Polygon points="0,0 150,98 0,180" fill={p.soft} opacity={0.8} />
              <Polygon points="300,0 150,98 300,180" fill={p.soft} opacity={0.8} />
              <Rect x={0} y={0} width={300} height={180} rx={10} fill="none" stroke="#00000022" strokeWidth={1.5} />
            </Svg>
            {hint ? <Animated.Text style={{ position: 'absolute', bottom: 12, width: ew, textAlign: 'center', color: p.ink, fontWeight: '700', fontSize: 13, opacity: flap.interpolate({ inputRange: [0, 0.3], outputRange: [1, 0] }) }}>{hint}</Animated.Text> : null}
          </Pressable>
          <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, width: ew, height: eh * 0.56, opacity: flapOpacity, transformOrigin: '50% 0%', transform: [{ perspective: 900 }, { rotateX: flapDeg }] }}>
            <Svg width={ew} height={eh * 0.56} viewBox="0 0 300 100">
              <Polygon points="0,0 300,0 150,98" fill={dark} /><Polygon points="0,0 300,0 150,98" fill="#FFFFFF" opacity={0.14} />
              <Polygon points="0,0 150,98 300,0" fill="none" stroke="#00000026" strokeWidth={1.5} />
            </Svg>
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
});

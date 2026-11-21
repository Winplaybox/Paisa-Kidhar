/* Sun ⇄ moon toggle. A Lottie icon plays on every switch while the screen does the circular colour-wash from the tap point. */
import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Anim } from './Anim';
import { Text } from './components';
import { useThemeCtx } from './ThemeProvider';

export function ThemeToggle({ label, hint }: { label: string; hint?: string }) {
  const { theme: t, setPref } = useThemeCtx();
  const dark = t.scheme === 'dark';
  const [plays, setPlays] = useState(0); // 0 = show the resting icon, >0 = a switch just happened
  const iconKey = useRef(0);
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: dark }} accessibilityLabel={label}
      onPress={(e) => { iconKey.current += 1; setPlays(iconKey.current); setPref(dark ? 'light' : 'dark', { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY }); }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md, minHeight: 64 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.colors.bgAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Anim key={`${dark}-${plays}`} name={dark ? 'toDark' : 'toLight'} size={56} still={plays === 0} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="label">{label}</Text>
        {hint ? <Text variant="caption" muted>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

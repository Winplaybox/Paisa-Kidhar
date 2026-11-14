import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { T } from '@/components/ui';
import { font, radius, useTheme } from '@/theme/tokens';

const Ctx = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ id: number; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const show = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMsg({ id: Date.now(), text });
    timer.current = setTimeout(() => setMsg(null), 2600);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 100, alignItems: 'center' }}>
        {msg ? (
          <Animated.View key={msg.id} entering={FadeInDown.springify().damping(18)} exiting={FadeOutDown.duration(180)}
            style={{ backgroundColor: t.text, paddingHorizontal: 16, paddingVertical: 11, borderRadius: radius.md, maxWidth: '88%' }}>
            <T v="caption" color={t.bg} center style={{ fontFamily: font.bodySemi, fontSize: 13.5 }}>{msg.text}</T>
          </Animated.View>
        ) : null}
      </View>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '@/components/Toast';
import { Button, T, Tap } from '@/components/ui';
import { env } from '@/lib/env';
import { useAuth } from '@/providers/auth';
import { space, useTheme } from '@/theme/tokens';

const POINTS = [
  { e: '☀️', t: 'Har subah: aaj ka daily budget' },
  { e: '➖', t: 'Har kharcha live minus hota hai' },
  { e: '🌙', t: 'Har raat: report card + grade' },
  { e: '📊', t: 'Paisa kidhar gaya — charts mein' },
];

export default function SignIn() {
  const t = useTheme();
  const toast = useToast();
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setBusy(true);
    const { error } = await signInWithGoogle();
    setBusy(false);
    if (error && error !== 'cancelled') toast(error);
  };

  return (
    <LinearGradient colors={[t.heroFrom, t.bg]} style={{ flex: 1 }} start={{ x: 0, y: 0 }} end={{ x: 0.3, y: 0.7 }}>
      <SafeAreaView style={{ flex: 1, paddingHorizontal: space.xl, justifyContent: 'space-between' }}>
        <View style={{ marginTop: 56 }}>
          <Animated.Text entering={FadeInDown.duration(500)} style={{ fontSize: 64 }}>💸</Animated.Text>
          <Animated.View entering={FadeInDown.delay(80).duration(500)}>
            <T v="hero" style={{ marginTop: space.lg }}>Paisa{'\n'}<T v="hero" color={t.accent}>Kidhar?</T></T>
            <T v="body" muted style={{ marginTop: space.md, fontSize: 16, lineHeight: 23 }}>
              Salary aati hai, gayab ho jaati hai. Ab pata chalega kidhar.
            </T>
          </Animated.View>
          <View style={{ marginTop: space.xxl, gap: space.md }}>
            {POINTS.map((p, i) => (
              <Animated.View key={p.t} entering={FadeInDown.delay(180 + i * 70).duration(450)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: t.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 18 }}>{p.e}</Text>
                </View>
                <T v="bodyStrong">{p.t}</T>
              </Animated.View>
            ))}
          </View>
        </View>

        <Animated.View entering={FadeInUp.delay(400).duration(500)} style={{ paddingBottom: space.lg, gap: space.md }}>
          <Button title="Continue with Google" icon="🔐" onPress={go} loading={busy} />
          <Tap haptic={false} onPress={() => WebBrowser.openBrowserAsync(env.privacyUrl)}>
            <T v="caption" muted center>
              Continue karke tum hamari <T v="caption" color={t.accent}>Privacy Policy</T> accept karte ho. Tumhara data sirf tumhara hai — encrypted & private.
            </T>
          </Tap>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

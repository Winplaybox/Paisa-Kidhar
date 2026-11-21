import { Link, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Anim } from '@/design-system/Anim';
import { GoogleButton } from '@/components/GoogleButton';
import { Banner, Button, Card, Row, Screen, Text } from '@/design-system/components';
import { useTheme } from '@/design-system/ThemeProvider';

export default function Welcome() {
  const t = useTheme();
  const [err, setErr] = useState<string | null>(null);
  return (
    <Screen edges={['top', 'bottom']} style={{ paddingTop: t.space.xxxl, minHeight: '100%', justifyContent: 'center' }}>
      <View style={{ gap: t.space.md }}>
        <Anim name="gift" size={130} loop style={{ marginLeft: -12 }} />
        <View style={{ alignSelf: 'flex-start', backgroundColor: t.colors.accentBg, borderRadius: t.radius.pill, paddingHorizontal: 12, paddingVertical: 6 }}>
          <Text variant="label" color={t.colors.accent}>Wedding dream registry</Text>
        </View>
        <Text variant="display">Don't gift another mixer.</Text>
        <Text variant="display" color={t.colors.accent}>Fund a dream.</Text>
        <Text muted>
          Couples list the things they truly want — a honeymoon, a first home, a trip to Japan. Guests send their shagun straight to
          your UPI, and you watch every goal fill up.
        </Text>
      </View>

      <Row gap={t.space.sm} wrap>
        {[['heart-outline', 'Goals you choose'], ['flash-outline', 'Direct UPI — no wallet'], ['stats-chart-outline', 'Live progress']].map(([i, l]) => (
          <Card key={l} tone="alt" style={{ paddingVertical: 10, paddingHorizontal: 14 }}><Text variant="caption">{l}</Text></Card>
        ))}
      </Row>

      {err ? <Banner tone="negative" title={err} /> : null}
      <View style={{ gap: t.space.md }}>
        <GoogleButton onError={setErr} />
        <Button title="Create account with email" kind="accent" icon="mail-outline" onPress={() => router.push('/sign-up')} />
        <Button title="I already have an account" kind="ghost" onPress={() => router.push('/sign-in')} />
      </View>
      <Text variant="caption" muted style={{ textAlign: 'center' }}>
        By continuing you agree to our <Link href="/legal/terms" style={{ color: t.colors.accent }}>Terms</Link> and{' '}
        <Link href="/legal/privacy" style={{ color: t.colors.accent }}>Privacy Policy</Link>.
      </Text>
    </Screen>
  );
}

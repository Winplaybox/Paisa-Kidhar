import { Link, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Anim } from '@/design-system/Anim';
import { GoogleButton } from '@/components/GoogleButton';
import { Banner, Button, Card, Row, Screen, Text } from '@/design-system/components';
import { useTheme } from '@/design-system/ThemeProvider';
import { useI18n } from '@/i18n';

export default function Welcome() {
  const t = useTheme();
  const { t: tx } = useI18n();
  const [err, setErr] = useState<string | null>(null);
  return (
    <Screen fluid edges={['top', 'bottom']} style={{ paddingTop: t.space.xxxl, minHeight: '100%', justifyContent: 'center' }}>
      <View style={{ gap: t.space.md }}>
        <Anim name="gift" size={130} loop style={{ marginLeft: -12 }} />
        <View style={{ alignSelf: 'flex-start', backgroundColor: t.colors.accentBg, borderRadius: t.radius.pill, paddingHorizontal: 12, paddingVertical: 6 }}>
          <Text variant="label" color={t.colors.accent}>{tx('wel_badge')}</Text>
        </View>
        <Text variant="display">{tx('wel_h1')}</Text>
        <Text variant="display" color={t.colors.accent}>{tx('wel_h2')}</Text>
        <Text muted>{tx('wel_body')}</Text>
      </View>

      <Row gap={t.space.sm} wrap>
        {[['heart-outline', tx('wel_f1')], ['flash-outline', tx('wel_f2')], ['stats-chart-outline', tx('wel_f3')]].map(([i, l]) => (
          <Card key={l} tone="alt" style={{ paddingVertical: 10, paddingHorizontal: 14 }}><Text variant="caption">{l}</Text></Card>
        ))}
      </Row>

      {err ? <Banner tone="negative" title={err} /> : null}
      <View style={{ gap: t.space.md }}>
        <GoogleButton onError={setErr} />
        <Button title={tx('wel_email')} kind="accent" icon="mail-outline" onPress={() => router.push('/sign-up')} />
        <Button title={tx('wel_have')} kind="ghost" onPress={() => router.push('/sign-in')} />
      </View>
      <Text variant="caption" muted style={{ textAlign: 'center' }}>
        {tx('wel_agree')}<Link href="/legal/terms" style={{ color: t.colors.accent }}>{tx('legal_terms')}</Link>{tx('and_word')}<Link href="/legal/privacy" style={{ color: t.colors.accent }}>{tx('legal_privacy')}</Link>{tx('wel_agree_end')}
      </Text>
    </Screen>
  );
}

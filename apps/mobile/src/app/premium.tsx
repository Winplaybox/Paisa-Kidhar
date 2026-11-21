import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { Banner, Button, Card, LoadingList, Row, Screen, Text } from '@/design-system/components';
import { useTheme } from '@/design-system/ThemeProvider';
import { api } from '@/lib/api';
import { config } from '@/lib/config';
import { formatINR } from '@/lib/money';
import { errorMessage, usePlans } from '@/lib/queries';
import { useCurrentRegistry } from '@/lib/useCurrentRegistry';

export default function Premium() {
  const t = useTheme();
  const plans = usePlans();
  const cur = useCurrentRegistry();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api.track('premium_viewed'); }, []);

  const buy = async () => {
    if (!cur.id) { router.push('/registry/setup'); return; }
    setBusy(true); setErr(null);
    try {
      const { checkout_url, order_id } = await api.checkout(cur.id);
      api.track('premium_checkout');
      if (Platform.OS === 'web') { window.location.href = checkout_url; return; }
      await WebBrowser.openBrowserAsync(checkout_url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
      router.replace({ pathname: '/billing/return', params: { order: order_id } });
    } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };

  if (plans.isLoading || cur.isLoading) return <Screen><LoadingList rows={2} /></Screen>;
  const plan = plans.data?.plans[0];
  const isPremium = cur.registry?.plan === 'premium';
  return (
    <Screen>
      <Text variant="caption" color={t.colors.highlight} style={{ letterSpacing: 2 }}>✦ PREMIUM REGISTRY</Text>
      <Text variant="title">Make it unforgettable</Text>
      {isPremium ? <Banner tone="positive" title="Your registry is Premium. Enjoy!" /> : null}
      {err ? <Banner tone="negative" title={err} /> : null}
      {plan ? (
        <Card style={{ gap: t.space.md }}>
          <Row style={{ alignItems: 'flex-end' }}>
            <Text variant="display">{formatINR(plan.price_paise)}</Text>
            <Text muted style={{ marginBottom: 6 }}>{plan.billing}</Text>
          </Row>
          {plan.features.map((f) => <Text key={f}>✓  {f}</Text>)}
        </Card>
      ) : null}
      {!isPremium ? (
        plans.data?.payments_enabled && (Platform.OS !== 'android' || config.androidExternalBilling)
          ? <Button title="Upgrade now" kind="accent" icon="diamond-outline" loading={busy} onPress={buy} />
          : <Banner tone="info" title="Premium is coming soon" body="We're finishing payment setup. Your free registry works fully in the meantime." />
      ) : null}
      <Text variant="caption" muted>
        Secure checkout by Dodo Payments (UPI & cards). Premium is a one-time purchase for one registry. Guest gifts are never charged and always go directly to your UPI.
      </Text>
    </Screen>
  );
}

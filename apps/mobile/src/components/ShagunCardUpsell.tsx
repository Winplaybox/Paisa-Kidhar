/* Offered on the guest's thank-you screen. A ₹49 digital card from the guest to the couple (sold via Dodo). */
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';

import { CARD_DESIGNS, ShagunCardView } from '@/components/ShagunCardView';
import { Banner, Button, Card, Chip, Field, Row, Text } from '@/design-system/components';
import { useTheme } from '@/design-system/ThemeProvider';
import { api, type CardDesign, type Pledge } from '@/lib/api';
import { formatINR } from '@/lib/money';
import { errorMessage, usePlans } from '@/lib/queries';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function ShagunCardUpsell({ pledge, partnerOne, partnerTwo, guestName, message, weddingDate }: {
  pledge: Pledge; partnerOne: string; partnerTwo: string; guestName?: string; message?: string; weddingDate?: string | null;
}) {
  const t = useTheme();
  const plans = usePlans();
  const offer = plans.data?.shagun_card;
  const [design, setDesign] = useState<CardDesign>('marigold');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!offer?.enabled) return null;

  const buy = async () => {
    if (!EMAIL.test(email.trim())) { setErr('Enter your email for the receipt.'); return; }
    setBusy(true); setErr(null);
    try {
      const r = await api.cardCheckout(pledge.reference, pledge.token, email.trim(), design);
      api.track('premium_checkout', { item: 'shagun_card' });
      if (Platform.OS === 'web') { window.location.href = r.checkout_url; return; }
      await WebBrowser.openBrowserAsync(r.checkout_url);
    } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <Card style={{ width: '100%', gap: t.space.md }}>
      <Text variant="label" color={t.colors.highlight}>✦ Make it memorable</Text>
      <Text variant="heading">Send a Digital Shagun Card</Text>
      <Text muted variant="caption">A beautiful card with your blessing that {partnerOne} & {partnerTwo} can keep and share. {formatINR(offer.price_paise)} — your UPI gift stays exactly as it is.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: t.space.sm }}>
        {offer.designs.map((d) => <Chip key={d} label={CARD_DESIGNS[d].label} color={CARD_DESIGNS[d].accent} selected={design === d} onPress={() => setDesign(d)} />)}
      </ScrollView>
      <View style={{ alignItems: 'center' }}>
        <ShagunCardView design={design} from={guestName} message={message} partnerOne={partnerOne} partnerTwo={partnerTwo} date={weddingDate} width={260} />
      </View>
      {err ? <Banner tone="negative" title={err} /> : null}
      <Field label="Email for receipt" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="you@gmail.com" />
      <Row><Button title={`Send card · ${formatINR(offer.price_paise)}`} kind="accent" icon="mail-outline" loading={busy} onPress={buy} /></Row>
      <Text variant="caption" muted style={{ textAlign: 'center' }}>Secure checkout by Dodo Payments (UPI & cards).</Text>
    </Card>
  );
}

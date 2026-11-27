import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { TEMPLATES } from '@/cards/catalog';
import { ShagunCardView } from '@/components/ShagunCardView';
import { Button, Card, Text } from '@/design-system/components';
import { useTheme } from '@/design-system/ThemeProvider';
import { useI18n } from '@/i18n';
import { useCanShowRewardedCardAd } from '@/lib/ads';
import type { Pledge } from '@/lib/api';
import { canUseExternalBilling } from '@/lib/billing';
import { saveCardContext } from '@/lib/cardDraft';
import { formatINR } from '@/lib/money';
import { usePlans } from '@/lib/queries';

export function ShagunCardUpsell({ pledge, partnerOne, partnerTwo, guestName, message, weddingDate, slug, premium }: {
  pledge: Pledge; partnerOne: string; partnerTwo: string; guestName?: string; message?: string; weddingDate?: string | null; slug?: string;
  premium: boolean;
}) {
  const t = useTheme();
  const { t: tx } = useI18n();
  const offer = usePlans().data?.shagun_card;
  const externalBilling = canUseExternalBilling();
  const rewarded = useCanShowRewardedCardAd(externalBilling || !offer?.rewarded_enabled || premium);
  if (!offer || (!rewarded && !(offer.enabled && externalBilling))) return null;
  const price = formatINR(offer.price_paise);
  const names = `${partnerOne} & ${partnerTwo}`;
  const go = async () => {
    await saveCardContext({ reference: pledge.reference, token: pledge.token, slug, partnerOne, partnerTwo, weddingDate, guestName, message, premium });
    router.push('/card/new');
  };
  const samples = ['marigold', 'royal', 'rose', 'peacock', 'mehendi'] as const;
  return (
    <Card style={{ width: '100%', gap: t.space.md }}>
      <Text variant="label" color={t.colors.highlight}>{tx('cd_make_memorable')}</Text>
      <Text variant="heading">{tx('cd_upsell_title')}</Text>
      <Text muted variant="caption">{rewarded ? tx('cd_reward_upsell_body', { couple: names }) : tx('cd_upsell_body', { couple: names, price })}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: t.space.md, paddingVertical: 6 }}>
        {samples.map((id) => (
          <View key={id}><ShagunCardView spec={{ template: id, occasion: TEMPLATES.find((x) => x.id === id)!.occasion, palette: 0, lang: 'en', recipient: names, date: weddingDate, from: guestName, blessing: message }} width={150} /></View>
        ))}
      </ScrollView>
      <Button title={rewarded ? tx('cd_reward_send') : tx('cd_upsell_cta', { price })} kind="accent" icon="sparkles-outline" onPress={go} />
    </Card>
  );
}

import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Linking, Platform, Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Button, Card, Row, Text } from '@/design-system/components';
import { useTheme } from '@/design-system/ThemeProvider';
import { useI18n } from '@/i18n';
import { api, type Registry } from '@/lib/api';
import { config } from '@/lib/config';

export function ShareCard({ registry }: { registry: Registry }) {
  const t = useTheme();
  const { t: tx } = useI18n();
  const url = `${config.webUrl}/r/${registry.slug}`;
  const [copied, setCopied] = useState<'url' | 'insta' | null>(null);
  const message = tx('sc_msg', { url });
  const meta = [registry.wedding_date, registry.city].filter(Boolean).join(' · ');
  return (
    <Card tone="accent" style={{ gap: t.space.md }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="heading">{tx('sc_title')}</Text>
        <Text variant="caption" color={t.colors.accent}>{registry.partner_one} & {registry.partner_two}</Text>
      </Row>
      <Row gap={t.space.lg} wrap>
        <View style={{ backgroundColor: '#FFFFFF', padding: 10, borderRadius: t.radius.md }} accessible accessibilityLabel={tx('sc_qr', { url })}>
          <QRCode value={url} size={120} color="#0A0A0A" backgroundColor="#FFFFFF" />
        </View>
        <View style={{ flex: 1, minWidth: 180, gap: t.space.xs }}>
          {meta ? <Text variant="caption" color={t.colors.accent}>{meta}</Text> : null}
          <Text variant="label" selectable>{url.replace('https://', '')}</Text>
          <Text variant="caption" muted>{tx('sc_hint')}</Text>
        </View>
      </Row>
      <Row gap={t.space.sm} wrap>
        <Button title={tx('sc_whatsapp')} kind="primary" icon="logo-whatsapp" full={false} onPress={async () => {
          api.track('share_tapped', { via: 'whatsapp' });
          const text = encodeURIComponent(message);
          try { await Linking.openURL(`whatsapp://send?text=${text}`); } catch { await Linking.openURL(`https://wa.me/?text=${text}`).catch(() => {}); }
        }} />
        <Button title={copied === 'insta' ? tx('sc_insta_copied') : tx('sc_instagram')} kind="secondary" icon="logo-instagram" full={false} onPress={async () => {
          api.track('share_tapped', { via: 'instagram' });
          await Clipboard.setStringAsync(url);
          setCopied('insta');
          setTimeout(() => setCopied(null), 3000);
          try { await Linking.openURL('instagram://story-camera'); } catch { await Share.share({ message, url }).catch(() => {}); }
        }} />
        <Button title={tx('sc_share')} kind="secondary" icon="share-social-outline" full={false} onPress={async () => {
          api.track('share_tapped', { via: 'sheet' });
          if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !('share' in navigator)) {
            await Clipboard.setStringAsync(message); setCopied('url'); return;
          }
          await Share.share({ message, url });
        }} />
        <Button title={copied === 'url' ? tx('sc_copied') : tx('sc_copy')} kind="secondary" icon="copy-outline" full={false}
          onPress={async () => { await Clipboard.setStringAsync(url); setCopied('url'); setTimeout(() => setCopied(null), 2000); }} />
      </Row>
    </Card>
  );
}

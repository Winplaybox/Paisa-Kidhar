import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Platform, Share, View } from 'react-native';
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
  const [copied, setCopied] = useState(false);
  const message = tx('sc_msg', { url });
  return (
    <Card tone="accent" style={{ gap: t.space.md }}>
      <Text variant="heading">{tx('sc_title')}</Text>
      <Row gap={t.space.lg} wrap>
        <View style={{ backgroundColor: '#FFFFFF', padding: 10, borderRadius: t.radius.md }} accessible accessibilityLabel={tx('sc_qr', { url })}>
          <QRCode value={url} size={120} color="#0A0A0A" backgroundColor="#FFFFFF" />
        </View>
        <View style={{ flex: 1, minWidth: 180, gap: t.space.sm }}>
          <Text variant="label" selectable>{url.replace('https://', '')}</Text>
          <Text variant="caption" muted>{tx('sc_hint')}</Text>
        </View>
      </Row>
      <Row gap={t.space.sm} wrap>
        <Button title={tx('sc_share')} kind="accent" icon="share-social-outline" full={false} onPress={async () => {
          api.track('share_tapped', { via: 'sheet' });
          if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !('share' in navigator)) {
            await Clipboard.setStringAsync(message); setCopied(true); return;
          }
          await Share.share({ message, url });
        }} />
        <Button title={copied ? tx('sc_copied') : tx('sc_copy')} kind="secondary" icon="copy-outline" full={false}
          onPress={async () => { await Clipboard.setStringAsync(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }} />
      </Row>
    </Card>
  );
}

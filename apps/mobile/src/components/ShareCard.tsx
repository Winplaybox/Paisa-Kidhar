import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Platform, Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Button, Card, Row, Text } from '@/design-system/components';
import { useTheme } from '@/design-system/ThemeProvider';
import { api, type Registry } from '@/lib/api';
import { config } from '@/lib/config';

export function ShareCard({ registry }: { registry: Registry }) {
  const t = useTheme();
  const url = `${config.webUrl}/r/${registry.slug}`;
  const [copied, setCopied] = useState(false);
  const message = `We're getting married! 💍 Instead of gifts, help us fund our dreams: ${url}`;
  return (
    <Card tone="accent" style={{ gap: t.space.md }}>
      <Text variant="heading">Share with your guests</Text>
      <Row gap={t.space.lg} wrap>
        <View style={{ backgroundColor: '#FFFFFF', padding: 10, borderRadius: t.radius.md }} accessible accessibilityLabel={`QR code for ${url}`}>
          <QRCode value={url} size={120} color="#0A0A0A" backgroundColor="#FFFFFF" />
        </View>
        <View style={{ flex: 1, minWidth: 180, gap: t.space.sm }}>
          <Text variant="label" selectable>{url.replace('https://', '')}</Text>
          <Text variant="caption" muted>Print the QR on your card, or send the link on WhatsApp.</Text>
        </View>
      </Row>
      <Row gap={t.space.sm} wrap>
        <Button title="Share link" kind="accent" icon="share-social-outline" full={false} onPress={async () => {
          api.track('share_tapped', { via: 'sheet' });
          if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !('share' in navigator)) {
            await Clipboard.setStringAsync(message); setCopied(true); return;
          }
          await Share.share({ message, url });
        }} />
        <Button title={copied ? 'Copied ✓' : 'Copy'} kind="secondary" icon="copy-outline" full={false}
          onPress={async () => { await Clipboard.setStringAsync(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }} />
      </Row>
    </Card>
  );
}

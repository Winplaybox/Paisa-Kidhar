import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as StoreReview from 'expo-store-review';
import { useState } from 'react';
import { Platform, Pressable } from 'react-native';

import { Banner, Button, Card, Field, Row, Screen, Text } from '@/design-system/components';
import { useTheme } from '@/design-system/ThemeProvider';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { openStoreListing, shareApp } from '@/lib/appShare';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/queries';

export default function Feedback() {
  const t = useTheme();
  const { t: tx, lang } = useI18n();
  const { profile } = useAuth();
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!rating) { setErr(tx('fb_pick_rating')); return; }
    setBusy(true); setErr(null);
    try {
      await api.sendFeedback({
        rating, message: message.trim() || undefined, email: profile?.email || undefined,
        app_version: Constants.expoConfig?.version, platform: Platform.OS === 'web' ? 'web' : Platform.OS === 'ios' ? 'ios' : 'android', lang,
      });
      setDone(true);
      // Happy users get Google's in-app review sheet; it is quota-limited, so the button below is the reliable path.
      if (rating >= 4 && Platform.OS !== 'web') {
        try { if (await StoreReview.hasAction()) await StoreReview.requestReview(); } catch { /* optional */ }
      }
    } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };

  if (done) {
    return (
      <Screen>
        <Card style={{ gap: t.space.md, alignItems: 'center' }}>
          <Text variant="title" style={{ textAlign: 'center' }}>{tx('fb_thanks')}</Text>
          <Text muted style={{ textAlign: 'center' }}>{tx(rating >= 4 ? 'fb_thanks_high' : 'fb_thanks_low')}</Text>
        </Card>
        {rating >= 4 ? <Button title={tx('fb_rate_play')} kind="primary" icon="star-outline" onPress={() => openStoreListing()} /> : null}
        <Button title={tx('fb_share')} kind="secondary" icon="share-social-outline" onPress={() => shareApp()} />
        <Button title={tx('common_done')} kind="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="title">{tx('fb_title')}</Text>
      <Text muted>{tx('fb_sub')}</Text>
      {err ? <Banner tone="negative" title={err} /> : null}
      <Card style={{ gap: t.space.lg }}>
        <Text variant="label">{tx('fb_rating')}</Text>
        <Row gap={t.space.sm}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => setRating(n)} accessibilityRole="button" hitSlop={6}
              accessibilityLabel={tx('fb_star', { n })} accessibilityState={{ selected: rating === n }}>
              <Text style={{ fontSize: 40, color: n <= rating ? t.colors.highlight : t.colors.border }}>★</Text>
            </Pressable>
          ))}
        </Row>
        <Field label={tx('fb_message')} value={message} onChangeText={setMessage} multiline maxLength={1000}
          style={{ minHeight: 100, textAlignVertical: 'top' }} placeholder={tx('fb_message_ph')} />
        <Button title={tx('fb_send')} kind="primary" loading={busy} onPress={submit} />
      </Card>
    </Screen>
  );
}

import { Stack, useLocalSearchParams } from 'expo-router';

import { Screen, Text } from '@/design-system/components';
import { useI18n } from '@/i18n';
import { deleteAccount, LAST_UPDATED, privacy, terms } from '@/content/legal';
import { legalI18n } from '@/content/legalI18n';
import { pick, useRemoteConfig } from '@/lib/remoteConfig';

type DocKey = 'privacy' | 'terms' | 'delete_account';

export default function Legal() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const { t: tx, lang } = useI18n();
  const rc = useRemoteConfig();
  const key: DocKey = doc === 'terms' ? 'terms' : doc === 'delete-account' ? 'delete_account' : 'privacy';
  const title = tx(key === 'terms' ? 'lg_terms' : key === 'delete_account' ? 'lg_delete' : 'lg_privacy');

  // Order: backend override (editable without a release) -> bundled translation -> bundled English.
  const tr = lang === 'en' ? undefined : legalI18n[lang as 'hi' | 'gu' | 'mr'];
  const bundled = tr ? (key === 'terms' ? tr.terms : key === 'delete_account' ? tr.deleteAccount : tr.privacy)
    : (key === 'terms' ? terms : key === 'delete_account' ? deleteAccount : privacy);
  const remote = pick(rc.legal[key], lang);
  const body = remote || bundled;
  const updated = rc.legal.updated || tr?.updated || LAST_UPDATED;

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <Text variant="title">{title}</Text>
      <Text variant="caption" muted>{tx('lg_updated', { date: updated })}</Text>
      {tr && !remote ? <Text variant="caption" muted>{tr.note}</Text> : null}
      <Text selectable>{body}</Text>
    </Screen>
  );
}

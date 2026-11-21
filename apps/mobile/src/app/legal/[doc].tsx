import { Stack, useLocalSearchParams } from 'expo-router';

import { Screen, Text } from '@/design-system/components';
import { useI18n } from '@/i18n';
import { deleteAccount, LAST_UPDATED, privacy, terms } from '@/content/legal';

export default function Legal() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const { t: tx } = useI18n();
  const page = doc === 'terms' ? { title: tx('lg_terms'), body: terms }
    : doc === 'delete-account' ? { title: tx('lg_delete'), body: deleteAccount }
    : { title: tx('lg_privacy'), body: privacy };
  return (
    <Screen>
      <Stack.Screen options={{ title: page.title }} />
      <Text variant="title">{page.title}</Text>
      <Text variant="caption" muted>{tx('lg_updated', { date: LAST_UPDATED })}</Text>
      <Text selectable>{page.body}</Text>
    </Screen>
  );
}

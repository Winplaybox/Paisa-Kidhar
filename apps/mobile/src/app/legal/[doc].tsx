import { Stack, useLocalSearchParams } from 'expo-router';

import { Screen, Text } from '@/design-system/components';
import { deleteAccount, LAST_UPDATED, privacy, terms } from '@/content/legal';

export default function Legal() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const page = doc === 'terms' ? { title: 'Terms of Use', body: terms }
    : doc === 'delete-account' ? { title: 'Delete your account', body: deleteAccount }
    : { title: 'Privacy Policy', body: privacy };
  return (
    <Screen>
      <Stack.Screen options={{ title: page.title }} />
      <Text variant="title">{page.title}</Text>
      <Text variant="caption" muted>Last updated {LAST_UPDATED}</Text>
      <Text selectable>{page.body}</Text>
    </Screen>
  );
}

import { Stack, useLocalSearchParams } from 'expo-router';

import { Screen, Text } from '@/design-system/components';
import { LAST_UPDATED, privacy, terms } from '@/content/legal';

export default function Legal() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const isPrivacy = doc !== 'terms';
  return (
    <Screen>
      <Stack.Screen options={{ title: isPrivacy ? 'Privacy Policy' : 'Terms of Use' }} />
      <Text variant="title">{isPrivacy ? 'Privacy Policy' : 'Terms of Use'}</Text>
      <Text variant="caption" muted>Last updated {LAST_UPDATED}</Text>
      <Text selectable>{isPrivacy ? privacy : terms}</Text>
    </Screen>
  );
}

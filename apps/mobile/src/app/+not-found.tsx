import { router } from 'expo-router';

import { Button, EmptyState, Screen } from '@/design-system/components';

export default function NotFound() {
  return (
    <Screen>
      <EmptyState icon="compass-outline" title="Page not found" body="This link doesn't go anywhere."
        action={<Button title="Go home" kind="secondary" full={false} onPress={() => router.replace('/')} />} />
    </Screen>
  );
}

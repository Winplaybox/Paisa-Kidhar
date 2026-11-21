import { router } from 'expo-router';

import { Button, EmptyState, Screen } from '@/design-system/components';
import { useI18n } from '@/i18n';

export default function NotFound() {
  const { t: tx } = useI18n();
  return (
    <Screen>
      <EmptyState icon="compass-outline" title={tx('nf_title')} body={tx('nf_body')}
        action={<Button title={tx('nf_home')} kind="secondary" full={false} onPress={() => router.replace('/')} />} />
    </Screen>
  );
}

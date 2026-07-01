import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Screen } from '@/components/layout/Screen';

export default function NotFoundRoute() {
  const { t } = useTranslation('common');
  const router = useRouter();

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <EmptyState
        cta={{ label: t('cta.goHome'), onPress: () => router.replace('/') }}
        mascotState="sad"
        message={t('notFound.message')}
        title={t('notFound.title')}
      />
    </Screen>
  );
}

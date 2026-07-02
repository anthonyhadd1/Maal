import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useChallengeDetail } from '@/api/queries/challenges';
import { ClayButton } from '@/components/clay/ClayButton';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Screen } from '@/components/layout/Screen';
import { SessionScreen } from '@/features/session/SessionScreen';
import { radii, spacing } from '@/theme/tokens';

/**
 * MODAL /session/challenge/:challengeId — challenge entry into the SAME
 * session engine: resolves the challenge's level, then SessionScreen starts
 * the attempt via POST /challenges/{id}/attempts/.
 */
export default function ChallengeSessionRoute() {
  const { t: tCommon } = useTranslation('common');
  const router = useRouter();
  const { challengeId } = useLocalSearchParams<{ challengeId: string }>();
  const id = Number(challengeId);
  const valid = Number.isFinite(id) && id > 0;

  const detail = useChallengeDetail(valid ? id : null);

  if (!valid) {
    return <Redirect href="/" />;
  }

  if (detail.isPending) {
    return (
      <Screen edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.skeleton} testID="challenge-session-skeleton">
          <Skeleton height={20} width="55%" />
          <Skeleton height={26} width="75%" />
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton height={56} key={i} radius={radii.m} width="100%" />
          ))}
        </View>
      </Screen>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <Screen edges={['top', 'left', 'right', 'bottom']}>
        <ErrorState onRetry={() => void detail.refetch()} retrying={detail.isRefetching} />
        <View style={styles.footer}>
          <ClayButton
            fullWidth
            onPress={() => router.back()}
            title={tCommon('cta.back')}
            variant="secondary"
          />
        </View>
      </Screen>
    );
  }

  return <SessionScreen challengeId={id} levelId={detail.data.level.id} />;
}

const styles = StyleSheet.create({
  skeleton: {
    flex: 1,
    gap: spacing.m,
    paddingTop: spacing.l,
  },
  footer: {
    paddingBottom: spacing.l,
  },
});

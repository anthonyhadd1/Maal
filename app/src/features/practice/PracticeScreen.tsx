import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { usePracticeMistakes } from '@/api/queries/session';
import { ClayButton } from '@/components/clay/ClayButton';
import { ClayCard } from '@/components/clay/ClayCard';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { getSubjectAccent, colors, radii, spacing, typography } from '@/theme/tokens';

/**
 * PUSH /practice — entry point for spaced-repetition mistake review (PLAN
 * reconciled decision 8 / gameplay §hearts): shows the due-item queue (count
 * + truncated preview, GET /practice/mistakes/ — never answers) with a CTA
 * that pushes into the actual quiz at /session/practice. The daily free-tier
 * cap and premium gating are enforced server-side on attempt START, not
 * here — SessionScreen already redirects a 402 there to the paywall.
 */
export function PracticeScreen() {
  const { t } = useTranslation('session');
  const router = useRouter();
  const mistakes = usePracticeMistakes();

  return (
    <Screen scroll>
      <ScreenHeader title={t('review.title')} />

      {mistakes.isPending ? (
        <View style={styles.skeleton} testID="practice-skeleton">
          <Skeleton height={20} width="60%" />
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton height={64} key={i} radius={radii.m} width="100%" />
          ))}
        </View>
      ) : mistakes.isError ? (
        <ErrorState onRetry={() => void mistakes.refetch()} retrying={mistakes.isRefetching} />
      ) : mistakes.data.count === 0 ? (
        <EmptyState
          mascotState="celebrate"
          message={t('review.emptyMessage')}
          title={t('review.emptyTitle')}
        />
      ) : (
        <>
          <Text style={styles.subtitle}>{t('review.subtitle')}</Text>
          <Text style={styles.count}>
            {t('review.queueCount', { count: mistakes.data.count })}
          </Text>

          <View style={styles.list} testID="practice-preview-list">
            {mistakes.data.questions.map((q) => (
              <ClayCard key={q.id} style={styles.item}>
                <View
                  style={[styles.dot, { backgroundColor: getSubjectAccent(q.subject) }]}
                />
                <Text numberOfLines={2} style={styles.itemText}>
                  {q.text}
                </Text>
              </ClayCard>
            ))}
          </View>

          <ClayButton
            fullWidth
            onPress={() => router.push('/session/practice')}
            size="l"
            style={styles.start}
            testID="practice-start"
            title={t('review.start')}
            variant="primary"
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    gap: spacing.m,
  },
  subtitle: {
    ...typography.body,
    color: colors.neutral[500],
    marginBottom: spacing.l,
  },
  count: {
    ...typography.smallMedium,
    color: colors.neutral[700],
    marginBottom: spacing.m,
  },
  list: {
    gap: spacing.m,
    marginBottom: spacing.xl,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radii.pill,
  },
  itemText: {
    ...typography.body,
    color: colors.neutral[900],
    flex: 1,
  },
  start: {
    marginBottom: spacing.l,
  },
});

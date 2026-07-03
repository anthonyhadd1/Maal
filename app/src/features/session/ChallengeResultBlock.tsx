import { Swords } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useMe } from '@/api/queries/auth';
import { useChallengeDetail } from '@/api/queries/challenges';
import { keys } from '@/api/queries/keys';
import { queryClient } from '@/api/queryClient';
import { ClayCard } from '@/components/clay/ClayCard';
import { Skeleton } from '@/components/feedback/Skeleton';
import { challengeOutcome, challengeResultKey } from '@/features/friends/challengeStatus';
import { colors, radii, spacing, typography } from '@/theme/tokens';

interface ChallengeResultBlockProps {
  challengeId: number;
}

/**
 * VS outcome card on the results screen after a challenge attempt:
 * « Tu as battu {name} {a}–{b} ! » / lost / tie. The detail is fetched fresh
 * (server resolves the winner on completion).
 */
export function ChallengeResultBlock({ challengeId }: ChallengeResultBlockProps) {
  const { t } = useTranslation('friends');
  const me = useMe();
  const detail = useChallengeDetail(challengeId);

  // The inbox list is stale the moment the attempt completes.
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: keys.challenges });
  }, []);

  const outcome =
    detail.data && me.data ? challengeOutcome(detail.data, me.data.username) : null;

  if (!outcome) {
    return (
      <ClayCard style={styles.card} testID="challenge-result-pending">
        <View style={styles.headerRow}>
          <Swords color={colors.primary[500]} size={18} />
          <Text style={styles.headerLabel}>{t('challenges.title')}</Text>
        </View>
        <Skeleton height={22} radius={radii.s} width="70%" />
      </ClayCard>
    );
  }

  const tone =
    outcome.result === 'won'
      ? colors.success
      : outcome.result === 'lost'
        ? colors.danger
        : colors.primary[600];

  return (
    <ClayCard style={styles.card} testID="challenge-result">
      <View style={styles.headerRow}>
        <Swords color={tone} size={18} />
        <Text style={styles.headerLabel}>{t('challenges.title')}</Text>
      </View>
      <Text style={[styles.outcome, { color: tone }]}>
        {t(`challenges.result.${challengeResultKey(outcome)}`, {
          name: outcome.otherName,
          a: outcome.myScore,
          b: outcome.otherScore,
        })}
      </Text>
    </ClayCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.s,
    marginBottom: spacing.l,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
  },
  headerLabel: {
    ...typography.caption,
    color: colors.neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  outcome: {
    ...typography.h2,
  },
});

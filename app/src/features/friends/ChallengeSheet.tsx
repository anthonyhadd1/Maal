import { ChevronRight } from 'lucide-react-native';
import { StyleSheet, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useCreateChallenge } from '@/api/queries/challenges';
import { useSubjectMap } from '@/api/queries/map';
import type { Friend, MapLevel } from '@/api/types';
import { ClayButton } from '@/components/clay/ClayButton';
import { ClayDialog } from '@/components/feedback/ClayDialog';
import { useToast } from '@/components/feedback/Toast';
import { Skeleton } from '@/components/feedback/Skeleton';
import { StarRating } from '@/components/game/StarRating';
import { PressableScale } from '@/components/layout/PressableScale';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, getSubjectAccent, radii, spacing, typography } from '@/theme/tokens';

interface ChallengeSheetProps {
  friend: Friend | null;
  onClose: () => void;
}

/**
 * « Défier » picker: choose one of MY completed levels (from the active
 * subject's map — design_gameplay.md §6) → POST /challenges/.
 */
export function ChallengeSheet({ friend, onClose }: ChallengeSheetProps) {
  const { t } = useTranslation('friends');
  const { t: tCommon } = useTranslation('common');
  const { t: tErrors } = useTranslation('errors');
  const toast = useToast();
  const activeSlug = useSettingsStore((s) => s.activeSubjectSlug);
  const map = useSubjectMap(friend ? activeSlug : null);
  const createChallenge = useCreateChallenge();

  if (!friend) return null;

  const accent = getSubjectAccent(activeSlug ?? '', map.data?.subject.color_hex);
  const completedLevels: MapLevel[] =
    map.data?.units.flatMap((unit) => unit.levels.filter((l) => l.status === 'completed')) ?? [];

  const send = (level: MapLevel) => {
    if (createChallenge.isPending) return;
    createChallenge.mutate(
      { opponent_id: friend.user_id, level_id: level.id },
      {
        onSuccess: () => {
          toast.show({
            type: 'success',
            message: t('challengeSheet.sent', {
              name: friend.display_name || friend.username,
            }),
          });
          onClose();
        },
        onError: () => toast.show({ type: 'error', message: tErrors('server') }),
      },
    );
  };

  return (
    <ClayDialog
      actions={[
        { label: tCommon('cta.cancel'), onPress: onClose, variant: 'secondary' },
      ]}
      message={t('challengeSheet.subtitle')}
      onRequestClose={onClose}
      title={t('challengeSheet.title', { name: friend.display_name || friend.username })}
      visible
    >
      {map.isPending ? (
        <View style={styles.skeleton}>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton height={52} key={i} radius={radii.m} width="100%" />
          ))}
        </View>
      ) : map.isError ? (
        // A failed load must NOT masquerade as "no completed levels" (which
        // would tell a user with real progress they have nothing to challenge
        // with) — surface the error and offer a retry.
        <View style={styles.errorBox}>
          <Text style={styles.empty}>{tErrors('network')}</Text>
          <ClayButton
            loading={map.isRefetching}
            onPress={() => void map.refetch()}
            size="m"
            testID="challenge-level-retry"
            title={tErrors('retry')}
            variant="secondary"
          />
        </View>
      ) : completedLevels.length === 0 ? (
        <Text style={styles.empty}>{t('challengeSheet.empty')}</Text>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.list}
          testID="challenge-level-list"
        >
          {completedLevels.map((level) => (
            <PressableScale
              // StarRating below carries its own accessibilityLabel, but a
              // wrapper with an explicit label of its own absorbs the whole
              // subtree into one accessible node — the child's label never
              // gets announced. Fold the star count in here instead of
              // silently dropping how well this level was played.
              accessibilityLabel={`${level.title}, ${tCommon('a11y.stars', { count: level.stars })}`}
              clay={false}
              disabled={createChallenge.isPending}
              key={level.id}
              onPress={() => send(level)}
              pressedTranslateY={2}
              style={styles.levelRow}
              testID={`challenge-level-${level.id}`}
            >
              <View style={[styles.levelDot, { backgroundColor: accent }]} />
              <View style={styles.levelBody}>
                <Text numberOfLines={1} style={styles.levelTitle}>
                  {level.title}
                </Text>
                <StarRating size={14} stars={level.stars} />
              </View>
              <ChevronRight color={colors.neutral[500]} size={18} />
            </PressableScale>
          ))}
        </ScrollView>
      )}
    </ClayDialog>
  );
}

const styles = StyleSheet.create({
  list: {
    alignSelf: 'stretch',
    maxHeight: 260,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    backgroundColor: colors.neutral[50],
    borderRadius: radii.m,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.m,
    marginBottom: spacing.s,
  },
  levelDot: {
    width: 12,
    height: 12,
    borderRadius: radii.pill,
  },
  levelBody: {
    flex: 1,
    gap: spacing.xs,
  },
  levelTitle: {
    ...typography.smallMedium,
    color: colors.neutral[900],
  },
  empty: {
    ...typography.small,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  errorBox: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spacing.m,
    paddingVertical: spacing.s,
  },
  skeleton: {
    alignSelf: 'stretch',
    gap: spacing.s,
  },
});

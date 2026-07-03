import { useRouter } from 'expo-router';
import { Check, Swords, X } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useMe } from '@/api/queries/auth';
import {
  useAcceptChallenge,
  useChallengeDetail,
  useChallenges,
  useDeclineChallenge,
} from '@/api/queries/challenges';
import type { IncomingChallenge, OutgoingChallenge } from '@/api/types';
import { ClayButton } from '@/components/clay/ClayButton';
import { ClayDialog } from '@/components/feedback/ClayDialog';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { useToast } from '@/components/feedback/Toast';
import { Avatar } from '@/components/game/Avatar';
import { PressableScale } from '@/components/layout/PressableScale';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import {
  challengeAction,
  challengeChip,
  challengeOutcome,
  challengeResultKey,
  orientChallenge,
  type ChallengeChip,
  type ChallengeDirection,
} from '@/features/friends/challengeStatus';
import { msToParts } from '@/lib/format';
import { colors, fonts, getSubjectAccent, radii, spacing, typography } from '@/theme/tokens';
import { tints } from '@/theme/tints';

/**
 * PUSH /friends/challenges — Reçus / Envoyés inbox (design_gameplay.md §6):
 * accept → « Jouer » starts the challenge attempt in the session engine;
 * completed → detail dialog with scores + per-question ✓✗ comparison.
 */
export function ChallengesScreen() {
  const { t } = useTranslation('friends');
  const { t: tErrors } = useTranslation('errors');
  const router = useRouter();
  const toast = useToast();
  const me = useMe();
  const challenges = useChallenges();
  const acceptChallenge = useAcceptChallenge();
  const declineChallenge = useDeclineChallenge();

  const [detailId, setDetailId] = useState<number | null>(null);

  const myUsername = me.data?.username ?? '';
  const myName = me.data?.profile.display_name || myUsername;
  const myAvatarId = me.data?.profile.avatar_id ?? null;
  const onError = () => toast.show({ type: 'error', message: tErrors('server') });

  const empty =
    challenges.data &&
    challenges.data.incoming.length === 0 &&
    challenges.data.outgoing.length === 0;

  return (
    <Screen scroll>
      <ScreenHeader title={t('challenges.title')} />

      {challenges.isPending ? (
        <View style={styles.skeleton} testID="challenges-skeleton">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton height={120} key={i} radius={radii.l} width="100%" />
          ))}
        </View>
      ) : challenges.isError ? (
        <ErrorState onRetry={() => void challenges.refetch()} retrying={challenges.isRefetching} />
      ) : empty ? (
        <EmptyState
          cta={{ label: t('challenges.emptyCta'), onPress: () => router.push('/friends') }}
          mascotState="idle"
          message={t('challenges.empty.message')}
          title={t('challenges.empty.title')}
        />
      ) : (
        <>
          {challenges.data.incoming.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>{t('challenges.received')}</Text>
              <View style={styles.section} testID="challenges-incoming">
                {challenges.data.incoming.map((challenge) => (
                  <ChallengeCard
                    challenge={challenge}
                    direction="incoming"
                    key={challenge.id}
                    myAvatarId={myAvatarId}
                    myName={myName}
                    myUsername={myUsername}
                    onAccept={() => acceptChallenge.mutate(challenge.id, { onError })}
                    onDecline={() => declineChallenge.mutate(challenge.id, { onError })}
                    onOpenDetail={() => setDetailId(challenge.id)}
                    onPlay={() =>
                      router.push({
                        pathname: '/session/challenge/[challengeId]',
                        params: { challengeId: String(challenge.id) },
                      })
                    }
                    pending={acceptChallenge.isPending || declineChallenge.isPending}
                  />
                ))}
              </View>
            </>
          ) : null}

          {challenges.data.outgoing.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>{t('challenges.sent')}</Text>
              <View style={styles.section} testID="challenges-outgoing">
                {challenges.data.outgoing.map((challenge) => (
                  <ChallengeCard
                    challenge={challenge}
                    direction="outgoing"
                    key={challenge.id}
                    myAvatarId={myAvatarId}
                    myName={myName}
                    myUsername={myUsername}
                    onOpenDetail={() => setDetailId(challenge.id)}
                    pending={false}
                  />
                ))}
              </View>
            </>
          ) : null}
        </>
      )}

      <ChallengeDetailDialog
        challengeId={detailId}
        myUsername={myUsername}
        onClose={() => setDetailId(null)}
      />
    </Screen>
  );
}

const CHIP_TONES: Record<ChallengeChip, { bg: string; fg: string }> = {
  pending: { bg: tints.gold, fg: tints.goldText },
  inProgress: { bg: colors.primary[100], fg: colors.primary[700] },
  expired: { bg: colors.neutral[100], fg: colors.neutral[500] },
  declined: { bg: colors.neutral[100], fg: colors.neutral[500] },
  won: { bg: tints.success, fg: tints.successText },
  lost: { bg: tints.danger, fg: tints.dangerText },
  tie: { bg: colors.primary[100], fg: colors.primary[700] },
};

function ChallengeCard({
  challenge,
  direction,
  myUsername,
  myName,
  myAvatarId,
  pending,
  onAccept,
  onDecline,
  onPlay,
  onOpenDetail,
}: {
  challenge: IncomingChallenge | OutgoingChallenge;
  direction: ChallengeDirection;
  myUsername: string;
  myName: string;
  myAvatarId: string | null;
  pending: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onPlay?: () => void;
  onOpenDetail: () => void;
}) {
  const { t } = useTranslation('friends');
  const chip = challengeChip(challenge, myUsername);
  const action = challengeAction(direction, challenge);
  const oriented = orientChallenge(challenge, direction);
  const accent = getSubjectAccent(challenge.level.subject.slug, challenge.level.subject.color_hex);
  const tone = CHIP_TONES[chip];
  const otherName = oriented.other.display_name || oriented.other.username;
  const completed = chip === 'won' || chip === 'lost' || chip === 'tie';

  const expiresIn = () => {
    const ms = Date.parse(challenge.expires_at) - Date.now();
    if (!Number.isFinite(ms) || ms <= 0) return null;
    const { days, hours, minutes } = msToParts(ms);
    if (days > 0) return t('countdown.daysHours', { days, hours });
    if (hours > 0) return t('countdown.hoursMinutes', { hours, minutes });
    return t('countdown.minutes', { minutes });
  };
  const expiry = chip === 'pending' ? expiresIn() : null;

  const card = (
    <View style={styles.card} testID={`challenge-${challenge.id}`}>
      <View style={[styles.accentBar, { backgroundColor: accent }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={styles.cardTitleWrap}>
            <Text numberOfLines={1} style={styles.levelTitle}>
              {challenge.level.title}
            </Text>
            <Text numberOfLines={1} style={[styles.subjectName, { color: accent }]}>
              {challenge.level.subject.name}
            </Text>
          </View>
          <View style={[styles.chip, { backgroundColor: tone.bg }]} testID={`chip-${chip}`}>
            <Text style={[styles.chipText, { color: tone.fg }]}>
              {t(`challenges.status.${chip}`)}
            </Text>
          </View>
        </View>

        {/* VS row: the other player vs me — both avatars, scores when done */}
        <View style={styles.vsRow}>
          <View style={styles.vsSide}>
            <Avatar avatarId={oriented.other.avatar_id} name={otherName} size={38} />
            <Text numberOfLines={1} style={styles.vsName}>
              {otherName}
            </Text>
          </View>
          {completed ? (
            <Text style={styles.vsScore} testID={`score-${challenge.id}`}>
              {oriented.otherScore ?? 0} – {oriented.myScore ?? 0}
            </Text>
          ) : (
            <View style={styles.vsPill}>
              <Text style={styles.vsLabel}>{t('challenges.vs')}</Text>
            </View>
          )}
          <View style={[styles.vsSide, styles.vsSideMe]}>
            <Text numberOfLines={1} style={[styles.vsName, styles.vsNameMe]}>
              {t('challenges.you')}
            </Text>
            <View style={styles.meAvatarRing}>
              <Avatar avatarId={myAvatarId} name={myName} size={34} />
            </View>
          </View>
        </View>

        {expiry ? <Text style={styles.expiry}>{t('challenges.expiresIn', { time: expiry })}</Text> : null}

        {/* Actions */}
        {action === 'acceptDecline' ? (
          <View style={styles.actionsRow}>
            <ClayButton
              fullWidth={false}
              icon={<Check color={colors.neutral[0]} size={16} strokeWidth={3} />}
              loading={pending}
              onPress={onAccept}
              style={styles.actionBtn}
              testID={`challenge-accept-${challenge.id}`}
              title={t('challenges.accept')}
              variant="success"
            />
            <ClayButton
              icon={<X color={colors.neutral[0]} size={16} strokeWidth={3} />}
              loading={pending}
              onPress={onDecline}
              style={styles.actionBtn}
              testID={`challenge-decline-${challenge.id}`}
              title={t('challenges.decline')}
              variant="danger"
            />
          </View>
        ) : action === 'play' ? (
          <ClayButton
            fullWidth
            icon={<Swords color={colors.neutral[0]} size={16} />}
            onPress={onPlay}
            testID={`challenge-play-${challenge.id}`}
            title={t('challenges.play')}
          />
        ) : null}
      </View>
    </View>
  );

  if (action === 'detail') {
    return (
      <PressableScale
        accessibilityLabel={challenge.level.title}
        clay={false}
        onPress={onOpenDetail}
        pressedTranslateY={2}
        testID={`challenge-open-${challenge.id}`}
      >
        {card}
      </PressableScale>
    );
  }
  return card;
}

function ChallengeDetailDialog({
  challengeId,
  myUsername,
  onClose,
}: {
  challengeId: number | null;
  myUsername: string;
  onClose: () => void;
}) {
  const { t } = useTranslation('friends');
  const { t: tCommon } = useTranslation('common');
  const detail = useChallengeDetail(challengeId);

  if (challengeId == null) return null;

  const outcome = detail.data ? challengeOutcome(detail.data, myUsername) : null;
  const meIsChallenger = detail.data?.challenger?.username === myUsername;

  return (
    <ClayDialog
      actions={[{ label: tCommon('cta.close'), onPress: onClose, variant: 'primary' }]}
      onRequestClose={onClose}
      title={detail.data ? t('challenges.detail.title', { level: detail.data.level.title }) : ''}
      visible
    >
      {detail.isPending ? (
        <View style={styles.detailSkeleton}>
          <Skeleton height={22} width="70%" />
          <Skeleton height={16} width="50%" />
        </View>
      ) : detail.isError || !detail.data ? (
        <Text style={styles.detailError}>{t('challenges.detail.error')}</Text>
      ) : (
        <>
          {outcome ? (
            <Text
              style={[
                styles.detailOutcome,
                {
                  color:
                    outcome.result === 'won'
                      ? colors.success
                      : outcome.result === 'lost'
                        ? colors.danger
                        : colors.primary[600],
                },
              ]}
              testID="detail-outcome"
            >
              {t(`challenges.result.${challengeResultKey(outcome)}`, {
                name: outcome.otherName,
                a: outcome.myScore,
                b: outcome.otherScore,
              })}
            </Text>
          ) : null}

          {/* Per-question ✓✗ comparison, when the payload includes it */}
          {detail.data.questions && detail.data.questions.length > 0 ? (
            <View style={styles.compareWrap} testID="detail-comparison">
              <View style={styles.compareHeader}>
                <Text style={styles.compareHeaderLabel}>{t('challenges.detail.perQuestion')}</Text>
                <View style={styles.compareHeaderIcons}>
                  <Text style={styles.compareColLabel}>{t('challenges.you')}</Text>
                  <Text style={styles.compareColLabel} numberOfLines={1}>
                    {outcome?.otherName ?? t('challenges.them')}
                  </Text>
                </View>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} style={styles.compareList}>
                {detail.data.questions.map((question, index) => {
                  const mine = meIsChallenger
                    ? question.challenger_correct
                    : question.opponent_correct;
                  const theirs = meIsChallenger
                    ? question.opponent_correct
                    : question.challenger_correct;
                  return (
                    <View key={index} style={styles.compareRow}>
                      <Text numberOfLines={1} style={styles.compareQuestion}>
                        {t('challenges.detail.questionN', { n: index + 1 })}
                      </Text>
                      <View style={styles.compareMarks}>
                        <CompareMark correct={mine} />
                        <CompareMark correct={theirs} />
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </>
      )}
    </ClayDialog>
  );
}

function CompareMark({ correct }: { correct: boolean }) {
  return correct ? (
    <Check color={colors.success} size={18} strokeWidth={3} />
  ) : (
    <X color={colors.danger} size={18} strokeWidth={3} />
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    ...typography.h2,
    color: colors.neutral[900],
    marginBottom: spacing.m,
  },
  section: {
    gap: spacing.m,
    marginBottom: spacing.xl,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[0],
    borderRadius: radii.l,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(36, 31, 62, 0.05)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(36, 31, 62, 0.09)',
  },
  accentBar: {
    width: 6,
  },
  cardBody: {
    flex: 1,
    padding: spacing.l,
    gap: spacing.m,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.s,
  },
  cardTitleWrap: {
    flex: 1,
    gap: 1,
  },
  levelTitle: {
    ...typography.bodyMedium,
    color: colors.neutral[900],
  },
  subjectName: {
    ...typography.caption,
  },
  chip: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
  },
  chipText: {
    ...typography.caption,
    fontFamily: fonts.bodyBold,
  },
  vsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
  },
  vsSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
  },
  vsSideMe: {
    justifyContent: 'flex-end',
  },
  vsName: {
    ...typography.smallMedium,
    color: colors.neutral[700],
    flexShrink: 1,
  },
  vsNameMe: {
    textAlign: 'right',
    color: colors.primary[600],
    fontFamily: typography.bodyBold.fontFamily,
  },
  meAvatarRing: {
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.primary[400],
    padding: 2,
    backgroundColor: colors.neutral[0],
  },
  vsScore: {
    ...typography.h2,
    fontFamily: fonts.headingBlack,
    color: colors.neutral[900],
    fontVariant: ['tabular-nums'],
  },
  vsPill: {
    backgroundColor: colors.neutral[100],
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    paddingVertical: 3,
  },
  vsLabel: {
    ...typography.caption,
    fontFamily: fonts.headingBlack,
    color: colors.neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  expiry: {
    ...typography.caption,
    color: colors.streakOrange,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.m,
  },
  actionBtn: {
    flex: 1,
  },
  skeleton: {
    gap: spacing.m,
  },
  detailSkeleton: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spacing.s,
  },
  detailError: {
    ...typography.small,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  detailOutcome: {
    ...typography.h2,
    textAlign: 'center',
  },
  compareWrap: {
    alignSelf: 'stretch',
    gap: spacing.s,
  },
  compareHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.m,
  },
  compareHeaderLabel: {
    ...typography.caption,
    color: colors.neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  compareHeaderIcons: {
    flexDirection: 'row',
    gap: spacing.l,
  },
  compareColLabel: {
    ...typography.caption,
    color: colors.neutral[500],
    maxWidth: 72,
  },
  compareList: {
    maxHeight: 220,
    alignSelf: 'stretch',
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    gap: spacing.m,
  },
  compareQuestion: {
    ...typography.small,
    color: colors.neutral[700],
    flex: 1,
  },
  compareMarks: {
    flexDirection: 'row',
    gap: spacing.xl,
    paddingRight: spacing.m,
  },
});

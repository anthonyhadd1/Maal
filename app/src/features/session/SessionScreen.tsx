import { useNavigation, useRouter } from 'expo-router';
import { Brain, Crown } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useMeGame } from '@/api/queries/game';
import { ClayDialog } from '@/components/feedback/ClayDialog';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { useToast } from '@/components/feedback/Toast';
import { ClayButton } from '@/components/clay/ClayButton';
import { Screen } from '@/components/layout/Screen';
import { FeedbackSheet } from '@/features/session/FeedbackSheet';
import { SessionHeader } from '@/features/session/SessionHeader';
import { SessionPager } from '@/features/session/SessionPager';
import { useSessionEngine } from '@/features/session/useSessionEngine';
import { useSessionStore } from '@/stores/sessionStore';
import { colors, getSubjectAccent, radii, spacing, typography } from '@/theme/tokens';
import { useSettingsStore } from '@/stores/settingsStore';

interface SessionScreenProps {
  /** Omitted in practice mode — the attempt has no fixed level. */
  levelId?: number;
  /** Friend-challenge mode: starts via POST /challenges/{id}/attempts/. */
  challengeId?: number;
  /** Spaced-repetition mistake review: starts via POST /practice/attempts/. */
  practice?: boolean;
}

/**
 * MODAL /session/:levelId (or /session/practice) — the question loop, a
 * TikTok/Reels-style swipe-card pager: each question is a full-screen card,
 * free navigation (swipe up/down at any time, not gated by answering the
 * card in view — see useSessionEngine's header comment for why that's safe).
 */
export function SessionScreen({ levelId, challengeId, practice }: SessionScreenProps) {
  const { t } = useTranslation('session');
  const { t: tCommon } = useTranslation('common');
  const { t: tErrors } = useTranslation('errors');
  const router = useRouter();
  const navigation = useNavigation();
  const toast = useToast();
  const game = useMeGame();
  const activeSlug = useSettingsStore((s) => s.activeSubjectSlug);
  const accent = getSubjectAccent(activeSlug ?? '');

  const engine = useSessionEngine(
    levelId ?? null,
    {
      onHeartsDepleted: () =>
        toast.show({ type: 'error', message: t('hearts.emptyMidSession') }),
      onRequestError: () => toast.show({ type: 'error', message: tErrors('server') }),
    },
    { challengeId: challengeId ?? null, practice: practice ?? false },
  );

  const legendary = useSessionStore((s) => s.legendary);
  const [quitVisible, setQuitVisible] = useState(false);
  // Hardware back button (Android) and the browser back button both bypass
  // the header's X entirely by default — neither is a `router.back()` call
  // WE make, so without this, "quitting goes through the confirm dialog"
  // (see session/_layout.tsx) only ever held for the one path a player is
  // least likely to reach for. `gestureEnabled: false` on the stack only
  // covers the iOS edge-swipe; this covers the rest.
  const [leaveNow, setLeaveNow] = useState(false);
  const pendingLeaveAction = useRef<unknown>(null);
  const canLeaveFreely = leaveNow || engine.phase === 'error' || engine.phase === 'done';

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (canLeaveFreely) return;
        e.preventDefault();
        pendingLeaveAction.current = e.data.action;
        setQuitVisible(true);
      }),
    [navigation, canLeaveFreely],
  );

  // Deferred a render behind `leaveNow` (rather than dispatched inline from
  // confirmQuit) so the listener above has already re-subscribed with
  // `canLeaveFreely: true` by the time this actually navigates — dispatching
  // the preserved action synchronously would just re-trigger the same
  // `beforeRemove` block with last render's (still-blocking) closure.
  useEffect(() => {
    if (!leaveNow) return;
    engine.abandon();
    if (pendingLeaveAction.current) {
      navigation.dispatch(pendingLeaveAction.current as never);
    } else {
      router.back();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaveNow]);

  // Completion → results. Waits for the last card's feedback overlay to be
  // dismissed first — the level is objectively "done" the instant every
  // question is answered, but the player should still get to read that
  // final verdict before being whisked to the results screen.
  useEffect(() => {
    if (engine.phase === 'done' && engine.justAnsweredId == null) {
      router.push('/session/results');
    }
  }, [engine.phase, engine.justAnsweredId, router]);

  // 402 premium on a deep-linked/resumed start → paywall.
  useEffect(() => {
    if (
      engine.phase === 'error' &&
      (engine.startError?.code === 'premium_required' || engine.startError?.status === 402)
    ) {
      router.replace('/paywall');
    }
  }, [engine.phase, engine.startError, router]);

  // Practice queue emptied between the preview screen and launch (another
  // device, or a race with the daily cap) — bounce back rather than show a
  // bare error screen for a session that was never really available.
  useEffect(() => {
    if (engine.phase === 'error' && engine.startError?.code === 'nothing_to_review') {
      toast.show({ type: 'error', message: t('review.emptyMidLaunch') });
      router.back();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.phase, engine.startError, router]);

  const confirmQuit = () => {
    setQuitVisible(false);
    setLeaveNow(true);
  };

  const stayInSession = () => {
    setQuitVisible(false);
    // Don't replay a stale blocked action next time the dialog reopens.
    pendingLeaveAction.current = null;
  };

  const hearts = engine.heartsRemaining ?? game.data?.hearts ?? null;
  const heartsUnlimited = engine.heartsUnlimited || (game.data?.hearts_unlimited ?? false);

  const justAnsweredQuestion =
    engine.justAnsweredId != null
      ? engine.questions.find((q) => q.id === engine.justAnsweredId)
      : null;
  const justAnsweredRecord =
    engine.justAnsweredId != null ? engine.answers[engine.justAnsweredId] : null;

  if (engine.phase === 'error') {
    return (
      <Screen edges={['top', 'left', 'right', 'bottom']}>
        <ErrorState
          message={engine.startError?.detail ?? undefined}
          onRetry={engine.retry}
        />
        <View style={styles.errorFooter}>
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

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} padded={false}>
      <View style={styles.chrome}>
        <SessionHeader
          accent={accent}
          answeredCount={engine.answeredCount}
          combo={engine.combo}
          currentIndex={engine.viewedIndex}
          hearts={hearts}
          heartsUnlimited={heartsUnlimited}
          onQuit={() => setQuitVisible(true)}
          total={engine.total}
        />
        {legendary ? (
          <View accessibilityRole="text" style={styles.legendaryBanner} testID="legendary-banner">
            <Crown color={colors.neutral[900]} fill={colors.neutral[900]} size={14} />
            <Text style={styles.legendaryBannerText}>{t('legendary.banner')}</Text>
          </View>
        ) : practice ? (
          <View accessibilityRole="text" style={styles.practiceBanner} testID="practice-banner">
            <Brain color={colors.neutral[0]} size={14} />
            <Text style={styles.practiceBannerText}>{t('review.banner')}</Text>
          </View>
        ) : null}
      </View>

      {engine.phase === 'loading' || engine.questions.length === 0 ? (
        <SessionSkeleton />
      ) : (
        <SessionPager
          accent={accent}
          answers={engine.answers}
          initialIndex={engine.viewedIndex}
          onShown={engine.markShown}
          onSubmit={engine.submit}
          onViewedIndexChange={engine.setViewedIndex}
          questions={engine.questions}
          submittingId={engine.submittingId}
        />
      )}

      {engine.phase === 'completing' ? (
        <View pointerEvents="none" style={styles.completingOverlay} testID="completing-overlay">
          <ActivityIndicator color={accent} size="large" />
        </View>
      ) : null}

      {justAnsweredQuestion && justAnsweredRecord ? (
        <FeedbackSheet
          answer={justAnsweredRecord}
          onContinue={engine.dismissFeedback}
          question={justAnsweredQuestion}
        />
      ) : null}

      <ClayDialog
        actions={[
          { label: t('quit.stay'), onPress: stayInSession, variant: 'primary' },
          {
            label: t('quit.confirm'),
            onPress: confirmQuit,
            variant: 'danger',
            testID: 'quit-confirm',
          },
        ]}
        message={t('quit.body')}
        onRequestClose={stayInSession}
        title={t('quit.title')}
        visible={quitVisible}
      />
    </Screen>
  );
}

function SessionSkeleton() {
  return (
    <View style={styles.skeleton} testID="session-skeleton">
      <Skeleton height={26} width="70%" />
      <Skeleton height={26} width="45%" />
      <View style={styles.skeletonOptions}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton height={56} key={i} radius={radii.m} width="100%" />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chrome: {
    paddingHorizontal: spacing.l,
    paddingTop: spacing.s,
  },
  legendaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    alignSelf: 'center',
    backgroundColor: colors.xpGold,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
  },
  legendaryBannerText: {
    ...typography.caption,
    color: colors.neutral[900],
    letterSpacing: 0.4,
  },
  practiceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    alignSelf: 'center',
    backgroundColor: colors.primary[500],
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
  },
  practiceBannerText: {
    ...typography.caption,
    color: colors.neutral[0],
    letterSpacing: 0.4,
  },
  errorFooter: {
    paddingBottom: spacing.l,
  },
  skeleton: {
    flex: 1,
    gap: spacing.m,
    paddingHorizontal: spacing.l,
    paddingTop: spacing.l,
  },
  skeletonOptions: {
    gap: spacing.m,
    marginTop: spacing.xl,
  },
  completingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

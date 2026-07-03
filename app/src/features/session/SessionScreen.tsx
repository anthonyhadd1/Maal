import { useRouter } from 'expo-router';
import { Brain, Crown } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useMeGame } from '@/api/queries/game';
import { ClayButton } from '@/components/clay/ClayButton';
import { ClayDialog } from '@/components/feedback/ClayDialog';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { useToast } from '@/components/feedback/Toast';
import { Screen } from '@/components/layout/Screen';
import { FeedbackSheet } from '@/features/session/FeedbackSheet';
import { QuestionRenderer } from '@/features/session/QuestionRenderer';
import { SessionHeader } from '@/features/session/SessionHeader';
import { useSessionEngine } from '@/features/session/useSessionEngine';
import { shade, withAlpha } from '@/lib/color';
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

/** MODAL /session/:levelId (or /session/practice) — the question loop (hero screen §4b). */
export function SessionScreen({ levelId, challengeId, practice }: SessionScreenProps) {
  const { t } = useTranslation('session');
  const { t: tCommon } = useTranslation('common');
  const { t: tErrors } = useTranslation('errors');
  const router = useRouter();
  const toast = useToast();
  const game = useMeGame();
  const activeSlug = useSettingsStore((s) => s.activeSubjectSlug);
  const accent = getSubjectAccent(activeSlug ?? '');

  const engine = useSessionEngine(
    levelId ?? null,
    {
      onHeartsDepleted: () =>
        toast.show({ type: 'error', message: t('hearts.emptyMidSession') }),
      onRequestError: (info) =>
        toast.show({ type: 'error', message: info.detail ?? tErrors('server') }),
    },
    { challengeId: challengeId ?? null, practice: practice ?? false },
  );

  const attemptId = useSessionStore((s) => s.attemptId);
  const legendary = useSessionStore((s) => s.legendary);
  const [selected, setSelected] = useState<number[]>([]);
  const [quitVisible, setQuitVisible] = useState(false);

  // Fresh selection per question (and per replayed attempt).
  useEffect(() => {
    setSelected([]);
  }, [engine.currentIndex, attemptId]);

  // Completion → results (navigation stays out of the engine).
  useEffect(() => {
    if (engine.phase === 'done') {
      router.push('/session/results');
    }
  }, [engine.phase, router]);

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

  const question = engine.question;
  const isMulti = question?.qtype === 'multi';

  const onToggle = (choiceId: number) => {
    if (engine.phase !== 'question' || !question) return;
    if (isMulti) {
      setSelected((prev) =>
        prev.includes(choiceId) ? prev.filter((id) => id !== choiceId) : [...prev, choiceId],
      );
    } else {
      setSelected([choiceId]);
    }
  };

  const confirmQuit = () => {
    setQuitVisible(false);
    engine.abandon();
    router.back();
  };

  const hearts = engine.heartsRemaining ?? game.data?.hearts ?? null;
  const heartsUnlimited = engine.heartsUnlimited || (game.data?.hearts_unlimited ?? false);

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
          currentIndex={engine.currentIndex}
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

      {engine.phase === 'loading' || !question ? (
        <SessionSkeleton />
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.questionContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.counterChip, { backgroundColor: withAlpha(accent, 0.12) }]}>
              <Text style={[styles.counter, { color: shade(accent, -0.35) }]}>
                {t('questionCounter', { n: engine.currentIndex + 1, total: engine.total })}
              </Text>
            </View>
            <QuestionRenderer
              accent={accent}
              disabled={engine.phase !== 'question'}
              onToggle={onToggle}
              question={question}
              revealed={engine.lastAnswer}
              selected={selected}
            />
          </ScrollView>

          <View style={styles.footer}>
            <ClayButton
              disabled={selected.length === 0 || engine.phase !== 'question'}
              fullWidth
              loading={engine.isSubmitting}
              onPress={() => engine.submit(selected)}
              size="l"
              testID="session-check"
              title={isMulti ? t('cta.validate') : tCommon('cta.check')}
              variant="primary"
            />
          </View>
        </>
      )}

      {engine.phase === 'completing' ? (
        <View pointerEvents="none" style={styles.completingOverlay} testID="completing-overlay">
          <ActivityIndicator color={accent} size="large" />
        </View>
      ) : null}

      {engine.phase === 'feedback' && engine.lastAnswer && question ? (
        <FeedbackSheet
          answer={engine.lastAnswer}
          onContinue={engine.continueNext}
          question={question}
        />
      ) : null}

      <ClayDialog
        actions={[
          { label: t('quit.stay'), onPress: () => setQuitVisible(false), variant: 'primary' },
          {
            label: t('quit.confirm'),
            onPress: confirmQuit,
            variant: 'danger',
            testID: 'quit-confirm',
          },
        ]}
        message={t('quit.body')}
        onRequestClose={() => setQuitVisible(false)}
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
    paddingVertical: 3,
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
    paddingVertical: 3,
    marginTop: spacing.xs,
  },
  practiceBannerText: {
    ...typography.caption,
    color: colors.neutral[0],
    letterSpacing: 0.4,
  },
  counterChip: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
    marginBottom: spacing.m,
  },
  counter: {
    ...typography.caption,
    fontFamily: typography.h2.fontFamily,
    letterSpacing: 0.4,
  },
  questionContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.l,
    paddingTop: spacing.s,
    paddingBottom: spacing.xxl,
  },
  footer: {
    paddingHorizontal: spacing.l,
    paddingBottom: spacing.l,
    paddingTop: spacing.s,
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

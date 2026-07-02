import { Redirect, useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import { Crown, Star } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { parseApiError } from '@/api/errors';
import { useStartAttempt } from '@/api/queries/session';
import type { LegendaryResult, XpBreakdown } from '@/api/types';
import { ClayButton } from '@/components/clay/ClayButton';
import { ClayCard } from '@/components/clay/ClayCard';
import { useToast } from '@/components/feedback/Toast';
import { Screen } from '@/components/layout/Screen';
import { Mascot } from '@/components/mascot/Mascot';
import { ChallengeResultBlock } from '@/features/session/ChallengeResultBlock';
import { formatElapsedMs, formatNumber, formatPercent } from '@/lib/format';
import { impactMedium, notifySuccess } from '@/lib/haptics';
import { useReducedMotionPref } from '@/lib/motion';
import { scheduleStreakReminders } from '@/lib/notifications';
import { play } from '@/lib/sounds';
import { useSessionStore } from '@/stores/sessionStore';
import { colors, radii, spacing, typography } from '@/theme/tokens';

const STAR_STAGGER_MS = 380;
const STAGE_DELAYS_MS = [0, 1300, 2000, 2400, 2800]; // stars, xp, confetti, stats, ctas

/**
 * Results choreography (design_mobile.md §4b): stars punch in one-by-one →
 * XP count-up with breakdown → confetti + mascot → stat rows → CTAs.
 * Reduced motion: everything renders instantly, no confetti.
 */
export function ResultsScreen() {
  const { t } = useTranslation('session');
  const { t: tCommon } = useTranslation('common');
  const { t: tErrors } = useTranslation('errors');
  const router = useRouter();
  const toast = useToast();
  const reduceMotion = useReducedMotionPref();
  const startAttempt = useStartAttempt();

  // Snapshot at mount: « Rejouer » reseeds the store without unmounting us.
  const [snapshot] = useState(() => {
    const s = useSessionStore.getState();
    return {
      results: s.results,
      maxCombo: s.maxCombo,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
      levelId: s.levelId,
      challengeId: s.challengeId,
    };
  });

  const [stage, setStage] = useState(reduceMotion ? STAGE_DELAYS_MS.length - 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    const timers = STAGE_DELAYS_MS.map((delay, index) =>
      setTimeout(() => setStage((current) => Math.max(current, index)), delay),
    );
    return () => timers.forEach(clearTimeout);
  }, [reduceMotion]);

  // Mount-time game feel + follow-ups (results snapshot is stable):
  // level-complete SFX, trophy toasts (+success haptic), streak reminders.
  useEffect(() => {
    const results = snapshot.results;
    if (!results) return;

    if (results.passed) play('level_complete');

    const unlocked = results.achievements_unlocked;
    if (unlocked.length > 0) {
      notifySuccess();
      const timers = unlocked.map((achievement, index) =>
        setTimeout(
          () =>
            toast.show({
              type: 'success',
              message: tCommon('trophy.unlocked', { name: achievement.title }),
            }),
          index * 2000, // single-slot toast — stagger multiples
        ),
      );
      // Cancel pending toasts if the user leaves early; shown ones auto-dismiss.
      return () => timers.forEach(clearTimeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reschedule the local streak reminders with the fresh streak value.
  // No-op without permission / with the settings toggle off (never prompts).
  useEffect(() => {
    const streak = snapshot.results?.streak;
    if (streak) void scheduleStreakReminders(streak.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const results = snapshot.results;
  if (!results) {
    // Direct navigation without a completed attempt.
    return <Redirect href="/" />;
  }

  const perfect = results.score_pct >= 100;
  const title = perfect
    ? t('results.perfect')
    : results.passed
      ? t('results.passed')
      : t('results.failed');

  const elapsed =
    snapshot.completedAt != null && snapshot.startedAt != null
      ? snapshot.completedAt - snapshot.startedAt
      : null;

  const onContinue = () => {
    const { streak } = results;
    useSessionStore.getState().reset();
    router.dismissAll();
    if (streak.extended_today) {
      router.push({ pathname: '/streak', params: { days: String(streak.current) } });
    }
  };

  const onReplay = () => {
    if (snapshot.levelId == null || startAttempt.isPending) return;
    startAttempt.mutate(snapshot.levelId, {
      onSuccess: (data) => {
        useSessionStore.getState().startSession({
          attemptId: data.attempt_id,
          levelId: snapshot.levelId!,
          questions: data.questions,
        });
        router.back();
      },
      onError: (error) => {
        const info = parseApiError(error);
        if (info.code === 'premium_required' || info.status === 402) {
          router.push('/paywall');
          return;
        }
        if (info.code === 'out_of_hearts') {
          toast.show({ type: 'error', message: t('hearts.empty.title') });
          return;
        }
        toast.show({ type: 'error', message: info.detail ?? tErrors('server') });
      },
    });
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} scroll>
      {/* 1 — stars punch in */}
      <View style={styles.starsRow} testID="results-stars">
        {Array.from({ length: 3 }, (_, i) => (
          <PunchStar
            delay={i * STAR_STAGGER_MS}
            earned={i < results.stars}
            key={i}
            reduceMotion={reduceMotion}
          />
        ))}
      </View>

      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>

      {/* Challenge mode: VS outcome block (fetched fresh after completion). */}
      {snapshot.challengeId != null ? (
        <ChallengeResultBlock challengeId={snapshot.challengeId} />
      ) : null}

      {/* Legendary outcome — crown moment (earned) or encouragement. */}
      {results.legendary?.attempted && stage >= 1 ? (
        <LegendaryBlock legendary={results.legendary} reduceMotion={reduceMotion} />
      ) : null}

      {/* 2 — XP count-up + breakdown */}
      {stage >= 1 ? (
        <XpBlock reduceMotion={reduceMotion} xp={results.xp} />
      ) : (
        <View style={styles.xpPlaceholder} />
      )}

      {/* 3 — mascot (+ confetti overlay below) */}
      {stage >= 2 ? (
        <Mascot size={132} state={results.passed ? 'celebrate' : 'sad'} />
      ) : null}

      {/* 4 — stat rows */}
      {stage >= 3 ? (
        <View style={styles.stats} testID="results-stats">
          <StatRow
            label={t('results.accuracy')}
            value={formatPercent(results.score_pct)}
          />
          <StatRow label={t('results.maxCombo')} value={formatNumber(snapshot.maxCombo)} />
          {elapsed != null ? (
            <StatRow label={t('results.time')} value={formatElapsedMs(elapsed)} />
          ) : null}
        </View>
      ) : null}

      {/* 5 — CTAs */}
      {stage >= 4 ? (
        <View style={styles.actions}>
          <ClayButton
            fullWidth
            onPress={onContinue}
            size="l"
            testID="results-continue"
            title={tCommon('cta.continue')}
            variant={results.passed ? 'success' : 'primary'}
          />
          {/* Replay would start a NORMAL level attempt — hidden in challenge mode. */}
          {snapshot.challengeId == null ? (
            <ClayButton
              fullWidth
              loading={startAttempt.isPending}
              onPress={onReplay}
              testID="results-replay"
              title={t('results.replay')}
              variant="secondary"
            />
          ) : null}
        </View>
      ) : null}

      {/* Confetti overlay (skipped at reduced motion / failed levels). */}
      {stage >= 2 && results.passed && !reduceMotion ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="results-confetti">
          <LottieView
            autoPlay
            loop={false}
            source={require('../../../assets/lottie/confetti.json')}
            style={styles.confetti}
          />
        </View>
      ) : null}
    </Screen>
  );
}

function PunchStar({
  earned,
  delay,
  reduceMotion,
}: {
  earned: boolean;
  delay: number;
  reduceMotion: boolean;
}) {
  const scale = useSharedValue(reduceMotion || !earned ? 1 : 0);

  useEffect(() => {
    if (reduceMotion || !earned) return;
    const id = setTimeout(() => {
      scale.value = withSpring(1, { damping: 9, stiffness: 240 });
      impactMedium();
    }, delay);
    return () => clearTimeout(id);
  }, [earned, delay, reduceMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Star
        color={earned ? colors.xpGold : colors.neutral[300]}
        fill={earned ? colors.xpGold : 'transparent'}
        size={64}
      />
    </Animated.View>
  );
}

/**
 * Legendary run outcome. Earned: gold crown punch-in + legendary SFX +
 * medium haptic (the « couronne » moment). Attempted only: encouragement.
 */
function LegendaryBlock({
  legendary,
  reduceMotion,
}: {
  legendary: LegendaryResult;
  reduceMotion: boolean;
}) {
  const { t } = useTranslation('session');
  const scale = useSharedValue(reduceMotion || !legendary.earned ? 1 : 0);

  useEffect(() => {
    if (!legendary.earned) return;
    play('legendary');
    impactMedium();
    if (!reduceMotion) {
      scale.value = withSpring(1, { damping: 9, stiffness: 220 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const crownStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (!legendary.earned) {
    return (
      <Text style={styles.legendaryMiss} testID="legendary-not-earned">
        {t('legendary.notEarned')}
      </Text>
    );
  }

  return (
    <View style={styles.legendaryEarned} testID="legendary-earned">
      <Animated.View style={crownStyle}>
        <Crown color={colors.xpGold} fill={colors.xpGold} size={56} />
      </Animated.View>
      <Text style={styles.legendaryTitle}>{t('legendary.earnedTitle')}</Text>
    </View>
  );
}

function XpBlock({ xp, reduceMotion }: { xp: XpBreakdown; reduceMotion: boolean }) {
  const { t } = useTranslation('session');
  const value = useCountUp(xp.total, reduceMotion);

  // 3-4 soft discrete ticks under the count-up (skipped at reduced motion —
  // the value renders instantly there).
  useEffect(() => {
    if (reduceMotion || xp.total <= 0) return;
    const timers = [0, 240, 480, 720].map((delay) =>
      setTimeout(() => play('xp_tick'), delay),
    );
    return () => timers.forEach(clearTimeout);
  }, [reduceMotion, xp.total]);

  const rows: { label: string; amount: number | undefined }[] = [
    { label: t('results.xp.base'), amount: xp.base },
    { label: t('results.xp.perfect'), amount: xp.perfect_bonus },
    { label: t('results.xp.combo'), amount: xp.combo_bonus },
    { label: t('results.xp.firstClear'), amount: xp.first_clear_bonus },
    { label: t('results.xp.streak'), amount: xp.streak_bonus },
    { label: t('results.xp.legendary'), amount: xp.legendary_bonus },
  ];

  return (
    <ClayCard style={styles.xpCard}>
      <Text style={styles.xpTotal} testID="results-xp-total">
        {t('results.xpEarned', { xp: formatNumber(value) })}
      </Text>
      {rows
        .filter((row) => (row.amount ?? 0) > 0)
        .map((row) => (
          <View key={row.label} style={styles.xpRow}>
            <Text style={styles.xpLabel}>{row.label}</Text>
            <Text style={styles.xpAmount}>{t('results.xpEarned', { xp: row.amount })}</Text>
          </View>
        ))}
    </ClayCard>
  );
}

/** JS-driven count-up (~900 ms); instant at reduced motion. */
function useCountUp(target: number, reduceMotion: boolean, durationMs = 900): number {
  const [value, setValue] = useState(reduceMotion ? target : 0);

  useEffect(() => {
    if (reduceMotion || target <= 0) {
      setValue(target);
      return;
    }
    const startedAt = Date.now();
    const id = setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / durationMs);
      setValue(Math.round(target * progress));
      if (progress >= 1) clearInterval(id);
    }, 40);
    return () => clearInterval(id);
  }, [target, reduceMotion, durationMs]);

  return value;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.m,
    marginTop: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.neutral[900],
    textAlign: 'center',
    marginTop: spacing.l,
    marginBottom: spacing.l,
  },
  xpPlaceholder: {
    height: 96,
  },
  legendaryEarned: {
    alignItems: 'center',
    gap: spacing.s,
    marginBottom: spacing.l,
  },
  legendaryTitle: {
    ...typography.h2,
    color: colors.xpGold,
    textAlign: 'center',
  },
  legendaryMiss: {
    ...typography.bodyMedium,
    color: colors.neutral[700],
    textAlign: 'center',
    marginBottom: spacing.l,
  },
  xpCard: {
    gap: spacing.s,
    marginBottom: spacing.l,
  },
  xpTotal: {
    ...typography.display,
    color: colors.xpGold,
    textAlign: 'center',
  },
  xpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  xpLabel: {
    ...typography.small,
    color: colors.neutral[500],
  },
  xpAmount: {
    ...typography.smallMedium,
    color: colors.neutral[900],
  },
  stats: {
    gap: spacing.s,
    marginTop: spacing.l,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.neutral[0],
    borderRadius: radii.m,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
  },
  statLabel: {
    ...typography.bodyMedium,
    color: colors.neutral[500],
  },
  statValue: {
    ...typography.bodyBold,
    color: colors.neutral[900],
  },
  actions: {
    gap: spacing.m,
    marginTop: 'auto',
    paddingTop: spacing.xl,
    paddingBottom: spacing.l,
  },
  confetti: {
    width: '100%',
    height: '100%',
  },
});

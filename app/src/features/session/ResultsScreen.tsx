import { Redirect, useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import {
  CalendarCheck,
  Check,
  Crown,
  Flame,
  Medal,
  Sparkles,
  Star,
  Target,
  Timer,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
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
import { withAlpha } from '@/lib/color';
import { useSessionStore } from '@/stores/sessionStore';
import { ClaySurface } from '@/components/clay/ClaySurface';
import { ParticleBurst, PodiumDisc, RadialRays } from '@/features/scenes';
import { colors, spacing, typography } from '@/theme/tokens';

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
      isPractice: s.isPractice,
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

  // Practice's "révision-pour-gagner": a good-enough review run earns a
  // heart back — surface it, it's otherwise invisible (no stars/pass-fail UI).
  useEffect(() => {
    if (snapshot.results?.hearts.earned) {
      notifySuccess();
      toast.show({ type: 'success', message: t('hearts.earned') });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const results = snapshot.results;
  if (!results) {
    // Direct navigation without a completed attempt.
    return <Redirect href="/" />;
  }

  // Practice/challenge attempts carry stars=null/passed=null (no pass-fail
  // framing server-side). Practice gets its own neutral, always-positive
  // "review done" treatment; challenge keeps its existing behavior (the VS
  // outcome is what actually matters there, via ChallengeResultBlock below).
  const isPractice = snapshot.isPractice;

  const perfect = results.score_pct >= 100;
  const title = isPractice
    ? t('review.done')
    : perfect
      ? t('results.perfect')
      : results.passed
        ? t('results.passed')
        : t('results.failed');
  // Practice is framed as inherently positive (mistakes reviewed = progress),
  // never as a pass/fail outcome — drives mascot state, button variant and
  // whether confetti fires.
  const positive = isPractice ? true : Boolean(results.passed);

  const elapsed =
    snapshot.completedAt != null && snapshot.startedAt != null
      ? snapshot.completedAt - snapshot.startedAt
      : null;

  const onContinue = () => {
    const { streak } = results;
    useSessionStore.getState().reset();
    // `session` is ONE fullScreenModal group in the root Stack, but it hosts
    // its OWN nested Stack (`session/_layout.tsx`) with two screens pushed
    // inside it: [levelId] then this results screen. `dismissAll()`
    // (POP_TO_TOP) and `dismiss(n)` (POP) both dispatch against the nearest
    // stack navigator in context — the nested one — so they only pop within
    // it (bottoming out at [levelId], since a stack can't pop below its
    // first screen) and never close the fullScreenModal itself. The result:
    // the map underneath never gets focus back, and [levelId] re-renders
    // with an emptied (just-reset) session store, hanging forever on its
    // loading skeleton (no attempt to resume, no start call fired).
    // `dismissTo` resolves the target href against the real route tree
    // (like a Link), so it correctly crosses out of the nested stack and
    // back to the tabs root underneath the whole modal group.
    router.dismissTo('/');
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
      {/* 1 — stars punch in (arc: side stars tilted, middle raised),
             wrapped by the reward scene: slow-turning light rays behind
             the arc + a one-shot burst of clay particles drifting up.
             Skipped for practice — stars/passed are null server-side, and a
             review run isn't a pass-fail moment. */}
      {!isPractice ? (
        <View style={styles.starsRow} testID="results-stars">
          {results.passed ? (
            <RadialRays durationMs={60000} opacity={0.2} size={340} style={styles.rays} />
          ) : null}
          {results.passed ? (
            <ParticleBurst height={240} style={styles.particles} width={340} />
          ) : null}
          <View style={[styles.starSide, styles.starLeft]}>
            <PunchStar
              delay={0}
              earned={(results.stars ?? 0) >= 1}
              reduceMotion={reduceMotion}
              size={56}
            />
          </View>
          <View style={styles.starCenter}>
            <PunchStar
              delay={STAR_STAGGER_MS}
              earned={(results.stars ?? 0) >= 2}
              reduceMotion={reduceMotion}
              size={76}
            />
          </View>
          <View style={[styles.starSide, styles.starRight]}>
            <PunchStar
              delay={STAR_STAGGER_MS * 2}
              earned={(results.stars ?? 0) >= 3}
              reduceMotion={reduceMotion}
              size={56}
            />
          </View>
        </View>
      ) : null}

      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {isPractice ? (
        <Text style={styles.subtitle}>
          {t('review.doneSubtitle', { count: results.correct_count, total: results.total_count })}
        </Text>
      ) : null}

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

      {/* 3 — mascot on a small clay podium (+ confetti overlay below) */}
      {stage >= 2 ? (
        <View style={styles.mascotScene}>
          <Mascot size={132} state={positive ? 'celebrate' : 'sad'} style={styles.mascotOnPodium} />
          <PodiumDisc width={158} />
        </View>
      ) : null}

      {/* 4 — stat chips */}
      {stage >= 3 ? (
        <View style={styles.stats} testID="results-stats">
          <StatChip
            color={colors.primary[600]}
            icon={Target}
            label={t('results.accuracy')}
            value={formatPercent(results.score_pct)}
          />
          <StatChip
            color={colors.streakOrange}
            icon={Flame}
            label={t('results.maxCombo')}
            value={formatNumber(snapshot.maxCombo)}
          />
          {elapsed != null ? (
            <StatChip
              color={colors.freezeBlue}
              icon={Timer}
              label={t('results.time')}
              value={formatElapsedMs(elapsed)}
            />
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
            variant={positive ? 'success' : 'primary'}
          />
          {/* Replay would start a NORMAL level attempt at snapshot.levelId —
              hidden in challenge mode (its own resolution flow) and practice
              mode (no fixed levelId; a fresh révision pulls from the queue
              via the map/quests entry point instead). */}
          {snapshot.challengeId == null && snapshot.levelId != null ? (
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
  size = 64,
}: {
  earned: boolean;
  delay: number;
  reduceMotion: boolean;
  size?: number;
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
        size={size}
        strokeWidth={earned ? 1.5 : 2}
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

  const rows: { label: string; amount: number | undefined; icon: LucideIcon; color: string }[] = [
    { label: t('results.xp.base'), amount: xp.base, icon: Check, color: colors.success },
    { label: t('results.xp.perfect'), amount: xp.perfect_bonus, icon: Sparkles, color: colors.primary[500] },
    { label: t('results.xp.combo'), amount: xp.combo_bonus, icon: Flame, color: colors.streakOrange },
    { label: t('results.xp.firstClear'), amount: xp.first_clear_bonus, icon: Medal, color: colors.freezeBlue },
    { label: t('results.xp.streak'), amount: xp.streak_bonus, icon: CalendarCheck, color: colors.streakOrange },
    { label: t('results.xp.legendary'), amount: xp.legendary_bonus, icon: Crown, color: colors.xpGold },
  ];
  const visible = rows.filter((row) => (row.amount ?? 0) > 0);

  return (
    <ClayCard style={styles.xpCard}>
      <View style={styles.xpTotalRow}>
        <Zap color={colors.xpGold} fill={colors.xpGold} size={30} />
        <Text style={styles.xpTotal} testID="results-xp-total">
          {t('results.xpEarned', { xp: formatNumber(value) })}
        </Text>
      </View>
      {visible.length > 0 ? <View style={styles.xpDivider} /> : null}
      {visible.map((row) => (
        <View key={row.label} style={styles.xpRow}>
          <View style={[styles.xpIcon, { backgroundColor: withAlpha(row.color, 0.14) }]}>
            <row.icon color={row.color} size={15} strokeWidth={2.6} />
          </View>
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

function StatChip({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
}) {
  return (
    <ClaySurface radius="m" style={styles.statChip}>
      <View style={[styles.statIcon, { backgroundColor: withAlpha(color, 0.14) }]}>
        <Icon color={color} size={17} strokeWidth={2.6} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text numberOfLines={1} style={styles.statLabel}>
        {label}
      </Text>
    </ClaySurface>
  );
}

const styles = StyleSheet.create({
  starsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginTop: spacing.xl,
    minHeight: 96,
  },
  rays: {
    left: '50%',
    top: -122,
    marginLeft: -170,
  },
  particles: {
    left: '50%',
    top: -80,
    marginLeft: -170,
  },
  mascotScene: {
    alignItems: 'center',
  },
  mascotOnPodium: {
    marginBottom: -26,
    zIndex: 2,
  },
  starCenter: {
    marginTop: -6,
    zIndex: 2,
  },
  starSide: {
    marginTop: spacing.l,
  },
  starLeft: {
    marginRight: -spacing.s,
    transform: [{ rotate: '-16deg' }],
  },
  starRight: {
    marginLeft: -spacing.s,
    transform: [{ rotate: '16deg' }],
  },
  title: {
    ...typography.display,
    fontSize: 28,
    lineHeight: 34,
    color: colors.neutral[900],
    textAlign: 'center',
    marginTop: spacing.m,
    marginBottom: spacing.l,
  },
  subtitle: {
    ...typography.body,
    color: colors.neutral[500],
    textAlign: 'center',
    marginTop: -spacing.m,
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
  xpTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s,
  },
  xpTotal: {
    ...typography.display,
    color: colors.xpGold,
    textAlign: 'center',
  },
  xpDivider: {
    height: 1,
    backgroundColor: colors.neutral[100],
    marginVertical: spacing.xs,
  },
  xpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
  },
  xpIcon: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  xpLabel: {
    ...typography.smallMedium,
    color: colors.neutral[700],
    flex: 1,
  },
  xpAmount: {
    ...typography.smallMedium,
    fontFamily: typography.h2.fontFamily,
    color: colors.neutral[900],
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.m,
    marginTop: spacing.l,
  },
  statChip: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.s,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statLabel: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  statValue: {
    ...typography.bodyBold,
    fontFamily: typography.h2.fontFamily,
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

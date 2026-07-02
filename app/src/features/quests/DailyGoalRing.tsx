import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { Mascot } from '@/components/mascot/Mascot';
import { dailyGoalMascotState, questFraction } from '@/features/quests/questLogic';
import { formatNumber } from '@/lib/format';
import { colors, spacing, typography } from '@/theme/tokens';

const RING_SIZE = 148;
const STROKE = 14;

interface DailyGoalRingProps {
  current: number;
  target: number;
}

/**
 * SVG circular progress for the daily XP goal (goal picked at onboarding:
 * 20/40/60) + mascot reacting to progress.
 */
export function DailyGoalRing({ current, target }: DailyGoalRingProps) {
  const { t } = useTranslation('quests');
  const fraction = questFraction(current, target);
  const radius = (RING_SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const done = fraction >= 1;

  const subtitle = done
    ? t('dailyGoal.done')
    : current > 0
      ? t('dailyGoal.keepGoing', { remaining: formatNumber(Math.max(0, target - current)) })
      : t('dailyGoal.start');

  return (
    <View style={styles.root}>
      <View
        accessibilityLabel={t('dailyGoal.progressA11y', { current, target })}
        accessibilityRole="progressbar"
        style={styles.ringWrap}
        testID="daily-goal-ring"
      >
        <Svg height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} width={RING_SIZE}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            fill="none"
            r={radius}
            stroke={colors.neutral[100]}
            strokeWidth={STROKE}
          />
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            fill="none"
            r={radius}
            stroke={done ? colors.success : colors.xpGold}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - fraction)}
            strokeLinecap="round"
            strokeWidth={STROKE}
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </Svg>
        <View pointerEvents="none" style={styles.center}>
          <Text style={styles.current}>{formatNumber(current)}</Text>
          <Text style={styles.target}>{t('dailyGoal.target', { target: formatNumber(target) })}</Text>
        </View>
      </View>

      <View style={styles.side}>
        <Mascot size={92} state={dailyGoalMascotState(fraction)} />
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.l,
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
  },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  current: {
    ...typography.display,
    color: colors.neutral[900],
  },
  target: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  side: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.s,
  },
  subtitle: {
    ...typography.small,
    color: colors.neutral[700],
    textAlign: 'center',
  },
});

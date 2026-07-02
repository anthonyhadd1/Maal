import { CheckCircle2 } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import type { QuestItem } from '@/api/types';
import { ClayCard } from '@/components/clay/ClayCard';
import { ProgressBar } from '@/components/game/ProgressBar';
import { questFraction, questIconName } from '@/features/quests/questLogic';
import { formatNumber } from '@/lib/format';
import { getLucideIcon } from '@/lib/lucide';
import { useReducedMotionPref } from '@/lib/motion';
import { colors, radii, spacing, typography } from '@/theme/tokens';

interface QuestCardProps {
  quest: QuestItem;
}

/**
 * One of the 3 static daily quests: icon, title, progress bar,
 * checkmark + subtle celebrate pulse when it flips to done.
 */
export function QuestCard({ quest }: QuestCardProps) {
  const { t } = useTranslation('quests');
  const reduceMotion = useReducedMotionPref();
  const Icon = getLucideIcon(questIconName(quest.code));
  const fraction = questFraction(quest.current, quest.target);

  // Celebrate pulse when `done` transitions false → true (skip at reduced motion).
  const scale = useSharedValue(1);
  const prevDone = useRef(quest.done);
  useEffect(() => {
    if (!prevDone.current && quest.done && !reduceMotion) {
      scale.value = withSequence(
        withSpring(1.04, { damping: 9, stiffness: 320 }),
        withSpring(1, { damping: 14, stiffness: 260 }),
      );
    }
    prevDone.current = quest.done;
  }, [quest.done, reduceMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <ClayCard style={styles.card} testID={`quest-${quest.code}`}>
        <View style={[styles.iconBubble, quest.done && styles.iconBubbleDone]}>
          <Icon
            color={quest.done ? colors.neutral[0] : colors.primary[600]}
            size={22}
            strokeWidth={2.2}
          />
        </View>
        <View style={styles.body}>
          <Text numberOfLines={2} style={styles.title}>
            {quest.title}
          </Text>
          <ProgressBar
            accent={quest.done ? colors.success : colors.primary[500]}
            height={8}
            progress={fraction}
          />
          <Text style={[styles.progressLabel, quest.done && styles.progressLabelDone]}>
            {quest.done
              ? t('quests.done')
              : t('quests.progress', {
                  current: formatNumber(quest.current),
                  target: formatNumber(quest.target),
                })}
          </Text>
        </View>
        {quest.done ? (
          <CheckCircle2
            color={colors.neutral[0]}
            fill={colors.xpGold}
            size={28}
            testID={`quest-${quest.code}-done`}
          />
        ) : null}
      </ClayCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
  },
  iconBubble: {
    width: 46,
    height: 46,
    borderRadius: radii.s,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBubbleDone: {
    backgroundColor: colors.success,
  },
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.bodyMedium,
    fontFamily: typography.bodyBold.fontFamily,
    color: colors.neutral[900],
  },
  progressLabel: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  progressLabelDone: {
    color: colors.successDeep,
    fontFamily: typography.bodyBold.fontFamily,
  },
});

import { useRouter } from 'expo-router';
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
import { PressableScale } from '@/components/layout/PressableScale';
import { ProgressBar } from '@/components/game/ProgressBar';
import {
  isReviewQuest,
  questFraction,
  questIconName,
  questTitleKey,
} from '@/features/quests/questLogic';
import { shade } from '@/lib/color';
import { formatNumber } from '@/lib/format';
import { getLucideIcon } from '@/lib/lucide';
import { useReducedMotionPref } from '@/lib/motion';
import { colors, radii, spacing, typography } from '@/theme/tokens';

interface QuestCardProps {
  quest: QuestItem;
}

/**
 * One of the 3 static daily quests: icon, title, progress bar,
 * checkmark + subtle celebrate pulse when it flips to done. The « fais une
 * révision » quest is the one actionable quest — tapping it jumps straight
 * into /practice, the others have no single screen to act on.
 */
export function QuestCard({ quest }: QuestCardProps) {
  const { t } = useTranslation('quests');
  const router = useRouter();
  const reduceMotion = useReducedMotionPref();
  const Icon = getLucideIcon(questIconName(quest.code));
  const fraction = questFraction(quest.current, quest.target);
  const actionable = isReviewQuest(quest.code) && !quest.done;
  const titleKey = questTitleKey(quest.code);
  const title = titleKey ? t(titleKey, { target: quest.target }) : quest.title;

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

  const card = (
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
          {title}
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
  );

  // Two issues in one: `quest.title` is the raw (unlocalized) server field —
  // the visible text uses the computed, localized `title` above instead. And
  // an explicit accessibilityLabel on this wrapper absorbs the whole card
  // (including the progress line below) into one accessible node, so without
  // folding progress in too, a screen reader never hears "2/5" or "Done".
  const progressText = quest.done
    ? t('quests.done')
    : t('quests.progress', {
        current: formatNumber(quest.current),
        target: formatNumber(quest.target),
      });

  return (
    <Animated.View style={animatedStyle}>
      {actionable ? (
        <PressableScale
          accessibilityLabel={`${title}, ${progressText}`}
          clay={false}
          onPress={() => router.push('/practice')}
        >
          {card}
        </PressableScale>
      ) : (
        card
      )}
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
    borderBottomWidth: 3,
    borderBottomColor: shade(colors.primary[100], -0.15),
  },
  iconBubbleDone: {
    backgroundColor: colors.success,
    borderBottomColor: shade(colors.success, -0.22),
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
    // successEdge (5.0:1 on white), not successDeep (3.3:1 — fails AA at this
    // caption size).
    color: colors.successEdge,
    fontFamily: typography.bodyBold.fontFamily,
  },
});

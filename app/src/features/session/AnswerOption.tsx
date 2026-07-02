import { Check, Square, SquareCheckBig, X } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { MathText } from '@/components/content/MathText';
import { PressableScale } from '@/components/layout/PressableScale';
import { shade, withAlpha } from '@/lib/color';
import { useReducedMotionPref } from '@/lib/motion';
import { selection } from '@/lib/haptics';
import { colors, radii, spacing, typography } from '@/theme/tokens';
import type { RevealState } from '@/features/session/QuestionRenderer/types';

export interface AnswerOptionProps {
  text: string;
  imageUrl?: string | null;
  state: RevealState;
  accent: string;
  /** Leading letter badge (A/B/C/D) — pass the choice index. */
  index?: number;
  /** Checkbox affordance for multi-choice questions. */
  multi?: boolean;
  /** Big centered variant (Vrai/Faux side-by-side buttons). */
  center?: boolean;
  disabled?: boolean;
  onPress: () => void;
  testID?: string;
}

interface Appearance {
  backgroundColor: string;
  borderColor: string;
  /** Darker bottom lip — the clay depth of the card. */
  edgeColor: string;
  textColor: string;
  opacity: number;
  badgeBg: string;
  badgeText: string;
}

function appearance(state: RevealState, accent: string): Appearance {
  const accentDark = shade(accent, -0.35);
  switch (state) {
    case 'selected':
      return {
        backgroundColor: withAlpha(accent, 0.08),
        borderColor: accent,
        edgeColor: shade(accent, -0.15),
        textColor: colors.neutral[900],
        opacity: 1,
        badgeBg: accent,
        badgeText: colors.neutral[0],
      };
    case 'correct':
      return {
        backgroundColor: colors.success,
        borderColor: colors.successDeep,
        edgeColor: colors.successEdge,
        textColor: colors.neutral[0],
        opacity: 1,
        badgeBg: 'rgba(255, 255, 255, 0.28)',
        badgeText: colors.neutral[0],
      };
    case 'wrong':
      return {
        backgroundColor: colors.heartsRed,
        borderColor: colors.dangerDeep,
        edgeColor: colors.dangerEdge,
        textColor: colors.neutral[0],
        opacity: 1,
        badgeBg: 'rgba(255, 255, 255, 0.28)',
        badgeText: colors.neutral[0],
      };
    case 'revealCorrect':
      return {
        backgroundColor: colors.neutral[0],
        borderColor: colors.success,
        edgeColor: colors.successDeep,
        textColor: colors.successDeep,
        opacity: 1,
        badgeBg: withAlpha(colors.success, 0.16),
        badgeText: colors.successEdge,
      };
    case 'dimmed':
      return {
        backgroundColor: colors.neutral[0],
        borderColor: colors.neutral[200],
        edgeColor: colors.neutral[300],
        textColor: colors.neutral[500],
        opacity: 0.55,
        badgeBg: colors.neutral[100],
        badgeText: colors.neutral[500],
      };
    case 'idle':
    default:
      return {
        backgroundColor: colors.neutral[0],
        borderColor: colors.neutral[200],
        edgeColor: colors.neutral[300],
        textColor: colors.neutral[900],
        opacity: 1,
        badgeBg: withAlpha(accent, 0.12),
        badgeText: accentDark,
      };
  }
}

const LETTERS = 'ABCDEFGH';

/**
 * One clay answer card: letter badge (A/B/C/D), idle → selected (accent
 * border + lift) → reveal (correct pop / wrong shake / true-answer
 * highlight), design_mobile.md §4b.
 */
export function AnswerOption({
  text,
  imageUrl,
  state,
  accent,
  index,
  multi = false,
  center = false,
  disabled = false,
  onPress,
  testID,
}: AnswerOptionProps) {
  const reduceMotion = useReducedMotionPref();
  const shakeX = useSharedValue(0);
  const popScale = useSharedValue(1);
  const lift = useSharedValue(0);
  const prevState = useRef<RevealState>(state);

  useEffect(() => {
    if (prevState.current === state) return;
    if (!reduceMotion) {
      if (state === 'wrong') {
        shakeX.value = withSequence(
          withTiming(-8, { duration: 50 }),
          withTiming(8, { duration: 50 }),
          withTiming(-5, { duration: 50 }),
          withTiming(5, { duration: 50 }),
          withTiming(0, { duration: 50 }),
        );
      } else if (state === 'correct') {
        popScale.value = withSequence(
          withSpring(1.05, { damping: 9, stiffness: 380 }),
          withSpring(1, { damping: 14, stiffness: 300 }),
        );
      }
      lift.value = withSpring(state === 'selected' ? -3 : 0, { damping: 15, stiffness: 320 });
    }
    prevState.current = state;
  }, [state, reduceMotion, shakeX, popScale, lift]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shakeX.value },
      { translateY: lift.value },
      { scale: popScale.value },
    ],
  }));

  const a = appearance(state, accent);
  const revealed = state !== 'idle' && state !== 'selected';
  const showCheck = state === 'correct' || state === 'revealCorrect';
  const showCross = state === 'wrong';
  const iconOnDark = state === 'correct' || state === 'wrong';
  const letter = !multi && !center && index != null ? LETTERS[index] : null;

  return (
    <Animated.View style={animatedStyle}>
      <PressableScale
        accessibilityState={{ disabled: disabled || revealed, selected: state === 'selected' }}
        disabled={disabled || revealed}
        haptic={false}
        onPress={() => {
          selection();
          onPress();
        }}
        pressedTranslateY={2}
        style={[
          styles.card,
          center && styles.center,
          {
            backgroundColor: a.backgroundColor,
            borderColor: a.borderColor,
            borderBottomColor: a.edgeColor,
            opacity: a.opacity,
          },
        ]}
        testID={testID}
      >
        {letter != null ? (
          <View style={[styles.letterBadge, { backgroundColor: a.badgeBg }]}>
            <Text style={[styles.letterText, { color: a.badgeText }]}>{letter}</Text>
          </View>
        ) : null}

        {multi ? (
          <View testID={`${testID ?? 'option'}-checkbox`}>
            {state === 'selected' || state === 'correct' ? (
              <SquareCheckBig
                color={iconOnDark ? colors.neutral[0] : accent}
                size={22}
                strokeWidth={2.4}
              />
            ) : (
              <Square
                color={iconOnDark ? colors.neutral[0] : colors.neutral[500]}
                size={22}
                strokeWidth={2}
              />
            )}
          </View>
        ) : null}

        {imageUrl ? (
          <Image resizeMode="cover" source={{ uri: imageUrl }} style={styles.choiceImage} />
        ) : null}

        <View style={[styles.textWrap, center && styles.textCenter]}>
          <MathText
            color={a.textColor}
            fontSize={center ? 18 : 16}
            text={text}
            textStyle={center ? styles.centerText : undefined}
          />
        </View>

        {showCheck ? (
          <View testID="answer-icon-check">
            <Check
              color={iconOnDark ? colors.neutral[0] : colors.success}
              size={22}
              strokeWidth={3}
            />
          </View>
        ) : null}
        {showCross ? (
          <View testID="answer-icon-cross">
            <X color={colors.neutral[0]} size={22} strokeWidth={3} />
          </View>
        ) : null}
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderRadius: radii.m,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    minHeight: 60,
  },
  center: {
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  letterBadge: {
    width: 34,
    height: 34,
    borderRadius: radii.s,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterText: {
    ...typography.smallMedium,
    fontFamily: typography.h2.fontFamily,
    fontSize: 15,
  },
  textWrap: {
    flex: 1,
  },
  textCenter: {
    alignItems: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
  choiceImage: {
    width: 48,
    height: 48,
    borderRadius: radii.s,
  },
});

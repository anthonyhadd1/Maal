import { Check, Square, SquareCheckBig, X } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { MathText } from '@/components/content/MathText';
import { PressableScale } from '@/components/layout/PressableScale';
import { useReducedMotionPref } from '@/lib/motion';
import { selection } from '@/lib/haptics';
import { colors, radii, spacing } from '@/theme/tokens';
import type { RevealState } from '@/features/session/QuestionRenderer/types';

export interface AnswerOptionProps {
  text: string;
  imageUrl?: string | null;
  state: RevealState;
  accent: string;
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
  textColor: string;
  opacity: number;
}

function appearance(state: RevealState, accent: string): Appearance {
  switch (state) {
    case 'selected':
      return {
        backgroundColor: colors.neutral[0],
        borderColor: accent,
        textColor: colors.neutral[900],
        opacity: 1,
      };
    case 'correct':
      return {
        backgroundColor: colors.success,
        borderColor: colors.successDeep,
        textColor: colors.neutral[0],
        opacity: 1,
      };
    case 'wrong':
      return {
        backgroundColor: colors.heartsRed,
        borderColor: colors.dangerDeep,
        textColor: colors.neutral[0],
        opacity: 1,
      };
    case 'revealCorrect':
      return {
        backgroundColor: colors.neutral[0],
        borderColor: colors.success,
        textColor: colors.successDeep,
        opacity: 1,
      };
    case 'dimmed':
      return {
        backgroundColor: colors.neutral[0],
        borderColor: colors.neutral[300],
        textColor: colors.neutral[500],
        opacity: 0.55,
      };
    case 'idle':
    default:
      return {
        backgroundColor: colors.neutral[0],
        borderColor: colors.neutral[300],
        textColor: colors.neutral[900],
        opacity: 1,
      };
  }
}

/**
 * One clay answer card: idle → selected (accent border + lift) → reveal
 * (correct pop / wrong shake / true-answer highlight), design_mobile.md §4b.
 */
export function AnswerOption({
  text,
  imageUrl,
  state,
  accent,
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
            opacity: a.opacity,
          },
        ]}
        testID={testID}
      >
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
            fontSize={center ? 18 : 15}
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
    borderRadius: radii.m,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    minHeight: 56,
  },
  center: {
    justifyContent: 'center',
    paddingVertical: spacing.xl,
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

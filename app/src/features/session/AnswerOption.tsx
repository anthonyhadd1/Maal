import { Check, Maximize2, Square, SquareCheckBig, X } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

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
  /**
   * The image IS the answer (real exam graph/diagram choices), not a thumbnail
   * beside a label: render it large, uncropped, on white. A 48px cover-cropped
   * thumbnail makes four candidate curves indistinguishable — the student
   * literally cannot answer the question.
   */
  imagePrimary?: boolean;
  /** Open the fullscreen zoom viewer for this choice's figure. */
  onZoom?: () => void;
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
        // White on colors.success measured 2.28:1. successEdge carries the
        // same "this is right" green at 5.02:1.
        backgroundColor: colors.successEdge,
        borderColor: colors.successEdge,
        edgeColor: shade(colors.successEdge, -0.25),
        textColor: colors.neutral[0],
        opacity: 1,
        badgeBg: 'rgba(255, 255, 255, 0.28)',
        badgeText: colors.neutral[0],
      };
    case 'wrong':
      return {
        // heartsRed is the hearts-economy token and measured 3.76:1 under
        // white; dangerDeep is the semantic one and clears AA at 4.83:1.
        backgroundColor: colors.dangerDeep,
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
        textColor: colors.successEdge,
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
        // Was 0.55, which multiplied down onto the text and left the label at
        // 2.36:1 — a de-emphasised option must still be readable (the student
        // is comparing it against the right answer). neutral[500] alone
        // already reads as secondary at 6.05:1.
        opacity: 1,
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
  imagePrimary = false,
  onZoom,
  disabled = false,
  onPress,
  testID,
}: AnswerOptionProps) {
  const { t } = useTranslation('session');
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

  // --- image-as-answer variant (real exam graph/diagram choices) -----------
  // The figure is the content: it sits on its own white surface at full width,
  // uncropped (`contain`), with the letter badge and verdict icon kept OUTSIDE
  // the image area so they never cover part of the curve being judged.
  if (imagePrimary && imageUrl) {
    return (
      <Animated.View style={animatedStyle}>
        {/* The zoom control is a SIBLING of the card, not a child: nesting one
            pressable inside another produces invalid nested <button>s on web
            and swallows the inner tap on some platforms. */}
        <View>
        <PressableScale
          accessibilityLabel={
            letter != null ? t('media.answerImageLettered', { letter }) : t('media.answerImage')
          }
          accessibilityState={{ disabled: disabled || revealed, selected: state === 'selected' }}
          disabled={disabled || revealed}
          haptic={false}
          onPress={() => {
            selection();
            onPress();
          }}
          pressedTranslateY={2}
          style={[
            styles.imageCard,
            {
              backgroundColor: a.backgroundColor,
              borderColor: a.borderColor,
              borderBottomColor: a.edgeColor,
              opacity: a.opacity,
            },
          ]}
          testID={testID}
        >
          <View style={styles.imageCardHeader}>
            {letter != null ? (
              <View style={[styles.letterBadge, { backgroundColor: a.badgeBg }]}>
                <Text style={[styles.letterText, { color: a.badgeText }]}>{letter}</Text>
              </View>
            ) : null}
            <View style={styles.imageCardHeaderSpacer} />
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
          </View>

          <Image
            accessibilityLabel={
              letter != null ? t('media.answerImageLettered', { letter }) : t('media.answerImage')
            }
            resizeMode="contain"
            source={{ uri: imageUrl }}
            style={styles.choiceImageLarge}
            testID={`${testID ?? 'option'}-figure`}
          />
        </PressableScale>

          {onZoom ? (
            <Pressable
              accessibilityLabel={t('imageZoom.open')}
              accessibilityRole="button"
              hitSlop={10}
              onPress={onZoom}
              style={styles.zoomButton}
              testID={`${testID ?? 'option'}-zoom`}
            >
              <Maximize2 color={colors.neutral[700]} size={15} strokeWidth={2.4} />
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
    );
  }

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
          <Image
            accessibilityLabel={t('media.answerImage')}
            resizeMode="cover"
            source={{ uri: imageUrl }}
            style={styles.choiceImage}
          />
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
  // --- image-as-answer variant -------------------------------------------
  imageCard: {
    borderWidth: 2,
    borderBottomWidth: 4,
    borderRadius: radii.m,
    padding: spacing.s,
    gap: spacing.xs,
  },
  imageCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
  },
  imageCardHeaderSpacer: {
    flex: 1,
  },
  zoomButton: {
    position: 'absolute',
    top: spacing.s,
    right: spacing.s,
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[100],
  },
  /**
   * Exam figures are black line-art on white: they need a real white plate
   * (never the tinted card fill) and `contain` so no part of the curve is
   * cropped away. 4/3 suits the source crops without letterboxing much.
   */
  choiceImageLarge: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radii.s,
    backgroundColor: colors.neutral[0],
  },
});

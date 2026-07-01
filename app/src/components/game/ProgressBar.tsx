import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useReducedMotionPref } from '@/lib/motion';
import { colors, radii, spacing } from '@/theme/tokens';

interface ContinuousProps {
  variant?: 'continuous';
  /** 0..1 */
  progress: number;
  segments?: never;
  filled?: never;
  pulseIndex?: never;
}

interface SegmentedProps {
  variant: 'segmented';
  segments: number;
  /** Number of filled segments. */
  filled: number;
  /** Segment that pulses (the question currently on screen). */
  pulseIndex?: number;
  progress?: never;
}

type ProgressBarProps = (ContinuousProps | SegmentedProps) & {
  accent?: string;
  height?: number;
};

/**
 * Clay progress bar. Continuous (spring-filled) for goals/completion,
 * segmented for the question session (one segment per question).
 */
export function ProgressBar(props: ProgressBarProps) {
  const { t } = useTranslation('common');
  const accent = props.accent ?? colors.primary[500];
  const height = props.height ?? 12;

  if (props.variant === 'segmented') {
    const { segments, filled, pulseIndex } = props;
    return (
      <View
        accessibilityLabel={t('a11y.progress', {
          pct: segments > 0 ? Math.round((filled / segments) * 100) : 0,
        })}
        accessibilityRole="progressbar"
        style={[styles.segmentRow, { height }]}
      >
        {Array.from({ length: segments }, (_, i) => (
          <Segment
            accent={accent}
            filled={i < filled}
            height={height}
            key={i}
            pulsing={i === pulseIndex && i >= filled}
          />
        ))}
      </View>
    );
  }

  return <ContinuousBar accent={accent} height={height} progress={props.progress} />;
}

/** One session segment; the current question's segment breathes in accent. */
function Segment({
  filled,
  pulsing,
  accent,
  height,
}: {
  filled: boolean;
  pulsing: boolean;
  accent: string;
  height: number;
}) {
  const reduceMotion = useReducedMotionPref();
  const pulse = useSharedValue(0.35);

  useEffect(() => {
    if (!pulsing || reduceMotion) {
      pulse.value = 0.35;
      return;
    }
    pulse.value = withRepeat(withTiming(0.75, { duration: 650 }), -1, true);
    return () => cancelAnimation(pulse);
  }, [pulsing, reduceMotion, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: pulsing ? pulse.value : 1,
  }));

  return (
    <Animated.View
      style={[
        styles.segment,
        { backgroundColor: filled || pulsing ? accent : colors.neutral[100], height },
        animatedStyle,
      ]}
    />
  );
}

function ContinuousBar({
  progress,
  accent,
  height,
}: {
  progress: number;
  accent: string;
  height: number;
}) {
  const { t } = useTranslation('common');
  const clamped = Math.max(0, Math.min(progress, 1));
  const width = useSharedValue(clamped);

  useEffect(() => {
    width.value = withSpring(clamped, { damping: 18, stiffness: 180 });
  }, [clamped, width]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
  }));

  return (
    <View
      accessibilityLabel={t('a11y.progress', { pct: Math.round(clamped * 100) })}
      accessibilityRole="progressbar"
      style={[styles.track, { height }]}
    >
      <Animated.View style={[styles.fill, { backgroundColor: accent }, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexGrow: 1,
    backgroundColor: colors.neutral[100],
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  segmentRow: {
    flexGrow: 1,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    borderRadius: radii.pill,
  },
});

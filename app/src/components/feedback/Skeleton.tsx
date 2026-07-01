import { useEffect } from 'react';
import { type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotionPref } from '@/lib/motion';
import { colors, radii } from '@/theme/tokens';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Shimmering placeholder block (static at reduced motion). */
export function Skeleton({ width = '100%', height = 16, radius = radii.s, style }: SkeletonProps) {
  const reduceMotion = useReducedMotionPref();
  const pulse = useSharedValue(0.55);

  useEffect(() => {
    if (reduceMotion) {
      pulse.value = 0.55;
      return;
    }
    pulse.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.neutral[100] },
        animatedStyle,
        style,
      ]}
    />
  );
}

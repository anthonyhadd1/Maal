import { useState, type PropsWithChildren } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { impactLight } from '@/lib/haptics';
import { shadows } from '@/theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SPRING = { damping: 15, stiffness: 400 } as const;

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Apply the clay raised/pressed shadow swap (default true). */
  clay?: boolean;
  /** Fire a light haptic impact on press-in (default true, honors settings). */
  haptic?: boolean;
  /** Vertical push while pressed, in px (default 4). */
  pressedTranslateY?: number;
}

/**
 * Base press interaction for every tappable clay element:
 * spring scale to 0.95 (damping 15 / stiffness 400), shadow swap
 * raised -> pressed, slight translateY push, light haptic on press-in.
 */
export function PressableScale({
  children,
  style,
  clay = true,
  haptic = true,
  pressedTranslateY = 4,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: PropsWithChildren<PressableScaleProps>) {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);
  const [pressed, setPressed] = useState(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={(event) => {
        scale.value = withSpring(0.95, SPRING);
        translateY.value = withSpring(pressedTranslateY, SPRING);
        setPressed(true);
        if (haptic) impactLight();
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withSpring(1, SPRING);
        translateY.value = withSpring(0, SPRING);
        setPressed(false);
        onPressOut?.(event);
      }}
      style={[
        clay ? (pressed ? shadows.clayPressed : shadows.clayRaised) : undefined,
        style,
        animatedStyle,
      ]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}

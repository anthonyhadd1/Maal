import { useState, type PropsWithChildren } from 'react';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { impactLight } from '@/lib/haptics';
import { colors, shadows } from '@/theme/tokens';

// Keyboard-focus ring, web only. Uses `outline*` (not `boxShadow`, which the
// clay raised/pressed shadows already occupy — layering another boxShadow
// value in the style array would just overwrite theirs) so it composes with
// every variant's shadow instead of fighting it.
const WEB_FOCUS_RING =
  Platform.OS === 'web'
    ? ({
        outlineWidth: 3,
        outlineColor: colors.primary[500],
        outlineStyle: 'solid',
        outlineOffset: 2,
      } as unknown as ViewStyle)
    : null;

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
  onFocus,
  onBlur,
  ...rest
}: PropsWithChildren<PressableScaleProps>) {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);

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
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[
        clay ? (pressed ? shadows.clayPressed : shadows.clayRaised) : undefined,
        style,
        focused && !disabled ? WEB_FOCUS_RING : undefined,
        animatedStyle,
      ]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}

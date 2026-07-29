import type { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';

import { PressableScale, type PressableScaleProps } from '@/components/layout/PressableScale';
import { colors, radii } from '@/theme/tokens';

export interface ClayIconButtonProps extends PressableScaleProps {
  /** Square hit size (default 44 — minimum touch target). */
  size?: number;
  backgroundColor?: string;
  accessibilityLabel: string;
}

/** Small square clay button hosting a single icon. */
export function ClayIconButton({
  children,
  size = 44,
  backgroundColor = colors.neutral[0],
  accessibilityLabel,
  disabled,
  style,
  ...rest
}: PropsWithChildren<ClayIconButtonProps>) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={[
        styles.base,
        { width: size, height: size, borderRadius: Math.min(radii.m, size / 2.5), backgroundColor },
        disabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});

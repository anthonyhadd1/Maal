import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, gradients, radii, shadows, type RadiusToken } from '@/theme/tokens';

export interface ClaySurfaceProps extends ViewProps {
  radius?: RadiusToken;
  shadow?: 'raised' | 'pressed' | 'floating' | 'none';
  backgroundColor?: string;
  /**
   * Soft top-light sheen (default true) — a white fade instead of the old
   * hairline, so the "clay" reads as moulded volume, never as a line.
   */
  highlight?: boolean;
}

const SHADOW_MAP = {
  raised: shadows.clayRaised,
  pressed: shadows.clayPressed,
  floating: shadows.clayFloating,
  none: undefined,
} as const;

/**
 * Base clay layer: rounded surface + layered outer shadow + top-light sheen
 * + faint contour border. Everything "clay" composes this.
 */
export function ClaySurface({
  children,
  radius = 'm',
  shadow = 'raised',
  backgroundColor = colors.neutral[0],
  highlight = true,
  style,
  ...rest
}: PropsWithChildren<ClaySurfaceProps>) {
  const r = radii[radius];

  return (
    <View
      style={[styles.base, { backgroundColor, borderRadius: r }, SHADOW_MAP[shadow], style]}
      {...rest}
    >
      {highlight ? (
        <LinearGradient
          colors={gradients.sheen}
          pointerEvents="none"
          style={[
            styles.sheen,
            { borderTopLeftRadius: r, borderTopRightRadius: r },
          ]}
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderColor: 'rgba(36, 31, 62, 0.05)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(36, 31, 62, 0.09)',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 18,
    opacity: 0.5,
  },
});

import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { clayHighlight, colors, radii, shadows, type RadiusToken } from '@/theme/tokens';

export interface ClaySurfaceProps extends ViewProps {
  radius?: RadiusToken;
  shadow?: 'raised' | 'pressed' | 'floating' | 'none';
  backgroundColor?: string;
  /** Inner top highlight hairline (default true) — the "clay" sheen. */
  highlight?: boolean;
}

const SHADOW_MAP = {
  raised: shadows.clayRaised,
  pressed: shadows.clayPressed,
  floating: shadows.clayFloating,
  none: undefined,
} as const;

/**
 * Base clay layer: rounded surface + outer shadow + inner top highlight.
 * Everything "clay" in the app composes this (cards, buttons, toasts…).
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
  return (
    <View
      style={[{ backgroundColor, borderRadius: radii[radius] }, SHADOW_MAP[shadow], style]}
      {...rest}
    >
      {highlight && <View pointerEvents="none" style={styles.highlight} />}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  highlight: {
    position: 'absolute',
    top: 2,
    left: 14,
    right: 14,
    height: 2,
    borderRadius: 2,
    backgroundColor: clayHighlight,
  },
});

import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { useMemo } from 'react';

import { shade, withAlpha } from '@/lib/color';
import { colors } from '@/theme/tokens';

/**
 * PodiumDisc — a small clay podium the mascot stands on: perspective
 * ellipse top (lit top-left), a thicker rim edge for clay depth, and a
 * soft contact shadow underneath. Static — depth comes from shading.
 * Decorative only.
 */

export interface PodiumDiscProps {
  /** Disc width in px (height follows a 100:34 perspective ratio). */
  width: number;
  /** Base clay color; top/rim/sheen are derived at runtime. */
  color?: string;
  /** Unique gradient id (only matters with 2+ podiums mounted). */
  idPrefix?: string;
  style?: StyleProp<ViewStyle>;
}

export function PodiumDisc({
  width,
  color = colors.primary[200],
  idPrefix = 'acePodium',
  style,
}: PodiumDiscProps) {
  const height = width * 0.34;
  const palette = useMemo(
    () => ({
      top: color,
      topLight: shade(color, 0.35),
      rim: shade(color, -0.22),
      shadow: withAlpha(colors.neutral[900], 0.16),
    }),
    [color],
  );
  const id = `${idPrefix}Contact`;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[{ width, height }, style]}
    >
      <Svg height={height} viewBox="0 0 100 34" width={width}>
        <Defs>
          <RadialGradient cx="0.5" cy="0.5" id={id} rx="0.5" ry="0.5">
            <Stop offset="0" stopColor={palette.shadow} />
            <Stop offset="1" stopColor={palette.shadow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {/* Contact shadow spilling past the disc. */}
        <Ellipse cx={50} cy={26} fill={`url(#${id})`} rx={48} ry={8} />
        {/* Clay rim (thickness) then top face. */}
        <Ellipse cx={50} cy={18} fill={palette.rim} rx={40} ry={12.5} />
        <Ellipse cx={50} cy={14.5} fill={palette.top} rx={40} ry={12.5} />
        {/* Top-left light. */}
        <Ellipse cx={38} cy={11} fill={palette.topLight} opacity={0.55} rx={19} ry={5.5} />
      </Svg>
    </View>
  );
}

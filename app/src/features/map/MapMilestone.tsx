import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import { shade } from '@/lib/color';
import { colors, contactShadow } from '@/theme/tokens';
import { ROW_HEIGHT } from '@/features/map/useMapLayout';

/**
 * Checkpoint monument at each unit's LAST node row (design_mobile.md §4a bis):
 * a clay flag planted on a soft mound beside the path. Boss rows get a
 * grander stepped pedestal; fully-completed units fly a GOLD pennant.
 * Decorative but announced to screen readers (French-first labels).
 */

interface MapMilestoneProps {
  accent: string;
  /** Node center x — the monument stands on the empty side of the curve. */
  nodeX: number;
  rowWidth: number;
  isBoss: boolean;
  unitCompleted: boolean;
}

const SIZE = 86;

export function MapMilestone({ accent, nodeX, rowWidth, isBoss, unitCompleted }: MapMilestoneProps) {
  const { t } = useTranslation('map');
  const sideLeft = nodeX >= rowWidth / 2;
  // Stand just clear of the node sphere (radius ~45 incl. ring).
  const left = sideLeft
    ? Math.max(6, nodeX - 45 - SIZE - 6)
    : Math.min(rowWidth - SIZE - 6, nodeX + 45 + 6);
  const top = ROW_HEIGHT - SIZE - 8;

  const flag = unitCompleted ? colors.xpGold : accent;
  const flagDeep = unitCompleted ? colors.goldDeep : shade(accent, -0.28);
  const gid = `${Math.round(nodeX)}-${isBoss ? 'b' : 'm'}-${unitCompleted ? 'g' : 'a'}`;

  return (
    <View
      accessibilityLabel={t(
        unitCompleted ? 'milestone.completed' : isBoss ? 'milestone.boss' : 'milestone.checkpoint',
      )}
      accessibilityRole="image"
      pointerEvents="none"
      style={[styles.wrap, { left, top }]}
    >
      <Svg height={SIZE} viewBox="0 0 64 64" width={SIZE}>
        <Defs>
          <SvgLinearGradient id={`ms-mound-${gid}`} x1="0" x2="1" y1="0" y2="1">
            <Stop offset="0" stopColor={shade(accent, 0.55)} />
            <Stop offset="1" stopColor={shade(accent, 0.18)} />
          </SvgLinearGradient>
          <SvgLinearGradient id={`ms-flag-${gid}`} x1="0" x2="1" y1="0" y2="1">
            <Stop offset="0" stopColor={shade(flag, 0.25)} />
            <Stop offset="1" stopColor={flag} />
          </SvgLinearGradient>
          <SvgLinearGradient id={`ms-stone-${gid}`} x1="0" x2="1" y1="0" y2="1">
            <Stop offset="0" stopColor={colors.neutral[100]} />
            <Stop offset="1" stopColor={colors.neutral[300]} />
          </SvgLinearGradient>
        </Defs>

        {/* Ground contact. */}
        <Ellipse cx={32} cy={58.5} fill={contactShadow} rx={19} ry={4} />

        {isBoss ? (
          <>
            {/* Stepped stone pedestal — the boss checkpoint is grander. */}
            <Rect fill={`url(#ms-stone-${gid})`} height={9} rx={3} width={36} x={14} y={49} />
            <Rect fill={colors.neutral[300]} height={3} rx={1.5} width={36} x={14} y={55} />
            <Rect fill={`url(#ms-stone-${gid})`} height={9} rx={3} width={26} x={19} y={41} />
            <Rect fill={`url(#ms-stone-${gid})`} height={8} rx={2.5} width={16} x={24} y={34} />
          </>
        ) : (
          <>
            {/* Soft clay mound. */}
            <Ellipse cx={32} cy={50} fill={`url(#ms-mound-${gid})`} rx={17} ry={9.5} />
            <Ellipse cx={26} cy={46.5} fill={colors.neutral[0]} opacity={0.4} rx={5.5} ry={2.4} />
            {/* Pebbles. */}
            <Circle cx={43} cy={53} fill={shade(accent, 0.3)} r={2.2} />
            <Circle cx={19} cy={53.5} fill={shade(accent, 0.4)} r={1.7} />
          </>
        )}

        {/* Pole (light left edge = top-left key light). */}
        <Rect fill={colors.neutral[500]} height={isBoss ? 27 : 33} rx={1.6} width={3.2} x={30.4} y={isBoss ? 9 : 14} />
        <Rect fill={colors.neutral[300]} height={isBoss ? 27 : 33} rx={0.8} width={1.2} x={30.4} y={isBoss ? 9 : 14} />
        <Circle cx={32} cy={isBoss ? 8 : 13} fill={flagDeep} r={2.6} />

        {/* Pennant with a soft waving bottom edge — always waves TOWARD the
            path (mirrored when the monument stands right of the node). */}
        <Path
          d={
            isBoss
              ? sideLeft
                ? 'M33.5 10.5 L55 15.5 Q 50 18.5 55 21.5 L33.5 26.5 z'
                : 'M30.5 10.5 L9 15.5 Q 14 18.5 9 21.5 L30.5 26.5 z'
              : sideLeft
                ? 'M33.5 15.5 L52 20 Q 48 22.5 52 25 L33.5 29.5 z'
                : 'M30.5 15.5 L12 20 Q 16 22.5 12 25 L30.5 29.5 z'
          }
          fill={`url(#ms-flag-${gid})`}
          stroke={flagDeep}
          strokeWidth={1.4}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    zIndex: 1,
  },
});

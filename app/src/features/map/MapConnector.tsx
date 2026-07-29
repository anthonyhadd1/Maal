import { StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { MapLevel } from '@/api/types';
import { colors } from '@/theme/tokens';
import { ROW_HEIGHT } from '@/features/map/useMapLayout';

/**
 * Per-node-row path segment (design_mobile.md §4a): one SVG quadratic bezier
 * from the PREVIOUS node's center to this node's center. Previous position is
 * derived from indices — zero measurement.
 *
 * The map renders bottom-to-top (level 1 at the bottom, climbing upward), so
 * the previous node sits in the row BELOW this one. Geometry: node centers
 * sit ROW_HEIGHT apart, so the segment lives in a ROW_HEIGHT-tall SVG anchored
 * half a row below this row (top: ROW_HEIGHT/2). The stroke is trimmed to run
 * sphere-edge to sphere-edge, so it never paints over the previous row's node
 * (only its empty top strip).
 */

interface MapConnectorProps {
  fromX: number;
  toX: number;
  rowWidth: number;
  /** Previous node — a completed origin paints the segment in accent. */
  prevLevel: MapLevel;
  /** Target node — locked/premium targets render dashed. */
  level: MapLevel;
  accent: string;
}

const STROKE = 8;
/**
 * Wide soft "road" under the connector stroke — reads as a ribbon path
 * through the world (accent at ~10% alpha, always present, even dashed).
 */
const RIBBON_STROKE = 14;
const RIBBON_OPACITY = 0.1;
/** Stroke endpoints tucked just at the sphere edges (radius 39 of 78px node). */
const EDGE_GAP = 46;

export function MapConnector({
  fromX,
  toX,
  rowWidth,
  prevLevel,
  level,
  accent,
}: MapConnectorProps) {
  const walked = prevLevel.status === 'completed';
  const lockedTarget = level.status === 'locked' || !level.is_free_for_me;
  const color = walked ? accent : colors.neutral[300];

  // Previous node (fromX) renders BELOW this row now, so the path starts
  // near this row's own node (top of the SVG) and ends near the previous
  // node (bottom of the SVG) — the mirror of the pre-flip top-to-bottom path.
  const midX = (fromX + toX) / 2;
  const d = `M ${toX} ${EDGE_GAP} Q ${midX} ${ROW_HEIGHT / 2} ${fromX} ${ROW_HEIGHT - EDGE_GAP}`;

  return (
    <Svg
      height={ROW_HEIGHT}
      aria-hidden
      pointerEvents="none"
      style={styles.svg}
      width={rowWidth}
    >
      <Path
        d={d}
        fill="none"
        stroke={accent}
        strokeLinecap="round"
        strokeOpacity={RIBBON_OPACITY}
        strokeWidth={RIBBON_STROKE}
      />
      <Path
        d={d}
        fill="none"
        stroke={color}
        strokeDasharray={lockedTarget ? [1, 16] : undefined}
        strokeLinecap="round"
        strokeOpacity={walked ? 0.9 : 1}
        strokeWidth={STROKE}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  svg: {
    position: 'absolute',
    top: ROW_HEIGHT / 2,
    left: 0,
  },
});

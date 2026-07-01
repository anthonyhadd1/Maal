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
 * Geometry: node centers sit ROW_HEIGHT apart, so the segment lives in a
 * ROW_HEIGHT-tall SVG anchored half a row above this row (top: -ROW_HEIGHT/2).
 * The stroke is trimmed to run sphere-edge to sphere-edge, so it never paints
 * over the previous row's node (only its empty bottom strip).
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

const STROKE = 7;
/** Stroke endpoints tucked just at the sphere edges (radius 38 of 76px node). */
const EDGE_GAP = 40;

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

  const midX = (fromX + toX) / 2;
  const d = `M ${fromX} ${EDGE_GAP} Q ${midX} ${ROW_HEIGHT / 2} ${toX} ${ROW_HEIGHT - EDGE_GAP}`;

  return (
    <Svg
      height={ROW_HEIGHT}
      pointerEvents="none"
      style={styles.svg}
      width={rowWidth}
    >
      <Path
        d={d}
        fill="none"
        stroke={color}
        strokeDasharray={lockedTarget ? [1, 14] : undefined}
        strokeLinecap="round"
        strokeWidth={STROKE}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  svg: {
    position: 'absolute',
    top: -ROW_HEIGHT / 2,
    left: 0,
  },
});

import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotionPref } from '@/lib/motion';
import { ROW_HEIGHT } from '@/features/map/useMapLayout';
import { propSetFor } from '@/features/map/sceneryProps';

/**
 * Deterministic scenery layer of the map world (design_mobile.md §4a bis).
 *
 * Each node row computes — from its GLOBAL INDEX only, zero randomness at
 * render — whether it hosts scenery, which subject prop it shows, and where
 * the prop sits in the EMPTY side of the sine curve (opposite the node).
 * Two depth tiers sell the 3D:
 *   FAR  — bigger, washed-out, low-contrast (reads as "behind" the path)
 *   NEAR — small, crisp, high-opacity (reads as "beside" the path)
 * Props drift slowly (9–14s loops, ±5–10px), phase-offset per row; rows are
 * virtualized so only visible props animate. Reduced motion → fully static.
 */

/** Deterministic 0..1 hash of (globalIndex, salt) — no Math.random ever. */
export function seeded(globalIndex: number, salt: number): number {
  let h = (Math.imul(globalIndex + 1, 374761393) + Math.imul(salt + 1, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export interface SceneryPlacement {
  /** Index into the subject prop set. */
  propIndex: number;
  tier: 'far' | 'near';
  /** Prop square size in px. */
  size: number;
  /** Absolute left within the row. */
  left: number;
  /** Absolute top within the row. */
  top: number;
  opacity: number;
  /** Ambient drift loop. */
  driftAmp: number;
  driftDurationMs: number;
  /** Starting phase 0..1 (desyncs neighbouring rows). */
  driftPhase: number;
}

/** Density gate: roughly a fifth of rows stay empty — placed, not confetti. */
const EMPTY_GATE = 0.2;
const FAR_OPACITY = 0.35;
const NEAR_OPACITY = 0.9;

/**
 * Pure placement: prop spec(s) for a node row, or [] when the row breathes.
 * The empty side = the side of the row the sine curve leaves free.
 */
export function sceneryFor(
  globalIndex: number,
  setLength: number,
  nodeX: number,
  rowWidth: number,
): SceneryPlacement[] {
  if (setLength === 0) return [];
  const gate = seeded(globalIndex, 1);
  if (gate < EMPTY_GATE) return [];

  const sideLeft = nodeX >= rowWidth / 2;
  const placements: SceneryPlacement[] = [];
  // How far the node clears the empty side: keep props out of the node's lane.
  const nodeEdge = sideLeft ? nodeX - 45 : nodeX + 45;

  const pick = seeded(globalIndex, 2);
  const wantsFar = pick >= 0.38;
  const wantsNear = pick < 0.38 || pick >= 0.74;

  if (wantsFar) {
    const size = 62 + Math.round(seeded(globalIndex, 3) * 22); // 62..84
    const jitter = seeded(globalIndex, 4);
    const left = sideLeft
      ? Math.max(4, Math.min(10 + jitter * 30, nodeEdge - size - 10))
      : Math.min(rowWidth - size - 4, Math.max(rowWidth - size - 10 - jitter * 30, nodeEdge + 10));
    placements.push({
      propIndex: Math.floor(seeded(globalIndex, 5) * setLength) % setLength,
      tier: 'far',
      size,
      left,
      top: 2 + seeded(globalIndex, 6) * 26,
      opacity: FAR_OPACITY,
      driftAmp: 4 + seeded(globalIndex, 7) * 3,
      driftDurationMs: 11000 + Math.round(seeded(globalIndex, 8) * 3000),
      driftPhase: seeded(globalIndex, 9),
    });
  }
  if (wantsNear) {
    const size = 40 + Math.round(seeded(globalIndex, 10) * 12); // 40..52
    const jitter = seeded(globalIndex, 11);
    // When paired with a FAR prop, slide inward so the pair reads as a
    // DIAGONAL depth composition instead of a vertical totem.
    const inward = wantsFar ? 26 : 0;
    const left = sideLeft
      ? Math.max(8, Math.min(26 + inward + jitter * 34, nodeEdge - size - 14))
      : Math.min(rowWidth - size - 8, Math.max(rowWidth - size - 26 - inward - jitter * 34, nodeEdge + 14));
    placements.push({
      propIndex: Math.floor(seeded(globalIndex, 12) * setLength) % setLength,
      tier: 'near',
      size,
      left,
      top: ROW_HEIGHT - size - 14 - seeded(globalIndex, 13) * 18,
      opacity: NEAR_OPACITY,
      driftAmp: 5 + seeded(globalIndex, 14) * 5,
      driftDurationMs: 9000 + Math.round(seeded(globalIndex, 15) * 4000),
      driftPhase: seeded(globalIndex, 16),
    });
  }
  return placements;
}

interface RowSceneryProps {
  globalIndex: number;
  slug: string;
  accent: string;
  /** Node center x (from useMapLayout.xFor). */
  nodeX: number;
  rowWidth: number;
}

/** Scenery for one node row — decorative only, never intercepts touches. */
export const RowScenery = memo(function RowScenery({
  globalIndex,
  slug,
  accent,
  nodeX,
  rowWidth,
}: RowSceneryProps) {
  const set = propSetFor(slug);
  const placements = sceneryFor(globalIndex, set.length, nodeX, rowWidth);
  if (placements.length === 0) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {placements.map((placement) => {
        const Prop = set[placement.propIndex];
        return (
          <DriftingProp key={placement.tier} placement={placement}>
            <Prop
              accent={accent}
              gid={`${slug || 'x'}-${globalIndex}-${placement.tier}`}
              muted={placement.tier === 'far'}
              size={placement.size}
            />
          </DriftingProp>
        );
      })}
    </View>
  );
});

/** Slow vertical ambient drift — transform-only, static under reduced motion. */
function DriftingProp({
  placement,
  children,
}: {
  placement: SceneryPlacement;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotionPref();
  const drift = useSharedValue(placement.driftPhase);

  useEffect(() => {
    if (reduceMotion) {
      drift.value = 0.5;
      return;
    }
    const half = placement.driftDurationMs / 2;
    const easing = Easing.inOut(Easing.sin);
    // Start mid-phase (seeded) so neighbouring props never move in lockstep:
    // the loop is [→0, →1] so every restart continues seamlessly from 1.
    drift.value = placement.driftPhase;
    drift.value = withRepeat(
      withSequence(
        withTiming(0, { duration: half, easing }),
        withTiming(1, { duration: half, easing }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(drift);
  }, [drift, reduceMotion, placement.driftDurationMs, placement.driftPhase]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: (drift.value - 0.5) * 2 * placement.driftAmp }],
  }));

  return (
    <Animated.View
      style={[
        styles.prop,
        {
          left: placement.left,
          top: placement.top,
          width: placement.size,
          height: placement.size,
          opacity: placement.opacity,
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  prop: {
    position: 'absolute',
  },
});

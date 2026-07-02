import { useMemo } from 'react';

import type { MapLevel, MapUnit } from '@/api/types';

/**
 * Deterministic map layout (design_mobile.md §4a).
 *
 * The map is a virtualized FlatList of fixed-height rows; node x-offsets
 * follow a sine curve of the node's GLOBAL index, so every position — and
 * every connector between two nodes — is computable from indices alone.
 * No measurement, exact `getItemLayout`, instant `scrollToIndex`.
 */

export const ROW_HEIGHT = 120;
export const UNIT_HEADER_HEIGHT = 96;
/** Node x-offset wave: centerX + amplitude * sin(globalIndex * WAVE_STEP). */
export const WAVE_STEP = 0.9;
/** Amplitude as a fraction of the usable width. */
export const AMPLITUDE_RATIO = 0.34;
/** Horizontal padding reserved on each side of the wave. */
export const EDGE_PADDING = 56;

export interface UnitHeaderRow {
  type: 'unitHeader';
  key: string;
  unit: MapUnit;
  /** Completed levels in this unit. */
  done: number;
  total: number;
}

export interface NodeRow {
  type: 'node';
  key: string;
  level: MapLevel;
  unit: MapUnit;
  /** Index across ALL nodes of the subject (drives the sine offset). */
  globalIndex: number;
  /** Previous node's global index, or null when this node starts a unit. */
  prevGlobalIndex: number | null;
  /** Status of the previous node (styles the connector segment). */
  prevLevel: MapLevel | null;
}

export type MapRow = UnitHeaderRow | NodeRow;

/** Flatten units -> [unitHeader, node, node, …] with global node indices. */
export function buildMapRows(units: MapUnit[]): MapRow[] {
  const rows: MapRow[] = [];
  let globalIndex = 0;
  for (const unit of units) {
    rows.push({
      type: 'unitHeader',
      key: `unit-${unit.id}`,
      unit,
      done: unit.levels.filter((l) => l.status === 'completed').length,
      total: unit.levels.length,
    });
    let prevInUnit: { globalIndex: number; level: MapLevel } | null = null;
    for (const level of unit.levels) {
      rows.push({
        type: 'node',
        key: `level-${level.id}`,
        level,
        unit,
        globalIndex,
        prevGlobalIndex: prevInUnit?.globalIndex ?? null,
        prevLevel: prevInUnit?.level ?? null,
      });
      prevInUnit = { globalIndex, level };
      globalIndex += 1;
    }
  }
  return rows;
}

/** Node center x for a global index — pure sine wave, clamped to padding. */
export function nodeCenterX(globalIndex: number, screenWidth: number): number {
  const centerX = screenWidth / 2;
  const usable = Math.max(screenWidth - EDGE_PADDING * 2, 0);
  const amplitude = usable * AMPLITUDE_RATIO;
  const raw = centerX + amplitude * Math.sin(globalIndex * WAVE_STEP);
  return Math.min(Math.max(raw, EDGE_PADDING), screenWidth - EDGE_PADDING);
}

export function rowHeight(row: MapRow): number {
  return row.type === 'unitHeader' ? UNIT_HEADER_HEIGHT : ROW_HEIGHT;
}

/** Prefix-sum offsets -> exact getItemLayout (no estimation, no measurement). */
export function buildRowOffsets(rows: MapRow[]): number[] {
  const offsets: number[] = new Array(rows.length);
  let acc = 0;
  for (let i = 0; i < rows.length; i += 1) {
    offsets[i] = acc;
    acc += rowHeight(rows[i]);
  }
  return offsets;
}

/**
 * Current node = first unlocked-but-not-completed node.
 * Fallback: LAST completed node. Returns a ROW index (for scrollToIndex),
 * or -1 when the map has no candidate.
 */
export function findCurrentRowIndex(rows: MapRow[]): number {
  let lastCompleted = -1;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (row.type !== 'node') continue;
    if (row.level.status === 'unlocked') return i;
    if (row.level.status === 'completed') lastCompleted = i;
  }
  return lastCompleted;
}

export interface MapLayout {
  rows: MapRow[];
  /** Row index of the current node (COMMENCE tooltip + initial scroll). -1 = none. */
  currentRowIndex: number;
  getItemLayout: (
    data: ArrayLike<MapRow> | null | undefined,
    index: number,
  ) => { length: number; offset: number; index: number };
  /** Node center x for a global node index. */
  xFor: (globalIndex: number) => number;
}

export function useMapLayout(units: MapUnit[] | undefined, screenWidth: number): MapLayout {
  return useMemo(() => {
    const rows = buildMapRows(units ?? []);
    const offsets = buildRowOffsets(rows);
    return {
      rows,
      currentRowIndex: findCurrentRowIndex(rows),
      getItemLayout: (_data, index) => ({
        length: rows[index] ? rowHeight(rows[index]) : ROW_HEIGHT,
        offset: offsets[index] ?? 0,
        index,
      }),
      xFor: (globalIndex: number) => nodeCenterX(globalIndex, screenWidth),
    };
  }, [units, screenWidth]);
}

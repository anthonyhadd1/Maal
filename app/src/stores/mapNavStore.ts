import { create } from 'zustand';

/**
 * Ephemeral, DELIBERATELY unpersisted: "the user picked a chapter, scroll the
 * map there". Navigation intent is valid for exactly one hop — persisting it
 * (as settingsStore would) would silently re-scroll the map days later on a
 * cold start, which reads as the app losing the user's place.
 */
interface MapNavState {
  /** Unit id the map should scroll to on its next render, or null. */
  pendingUnitId: number | null;
  requestJumpToUnit: (unitId: number) => void;
  /** Read-and-clear: the map consumes the intent so it fires only once. */
  consumePendingUnit: () => number | null;
}

export const useMapNavStore = create<MapNavState>()((set, get) => ({
  pendingUnitId: null,
  requestJumpToUnit: (unitId) => set({ pendingUnitId: unitId }),
  consumePendingUnit: () => {
    const { pendingUnitId } = get();
    if (pendingUnitId != null) set({ pendingUnitId: null });
    return pendingUnitId;
  },
}));

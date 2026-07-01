import { create } from 'zustand';

/** Ephemeral UI state — never persisted. */
interface UiState {
  isSubjectSwitcherOpen: boolean;
  openSubjectSwitcher: () => void;
  closeSubjectSwitcher: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  isSubjectSwitcherOpen: false,
  openSubjectSwitcher: () => set({ isSubjectSwitcherOpen: true }),
  closeSubjectSwitcher: () => set({ isSubjectSwitcherOpen: false }),
}));

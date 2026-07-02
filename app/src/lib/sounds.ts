/* eslint-disable @typescript-eslint/no-require-imports */
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

import { useSettingsStore } from '@/stores/settingsStore';

/**
 * Game SFX (Phase 8). Small pre-created player pool keyed by sound name —
 * expo-audio players do NOT auto-rewind, so every play() is preceded by a
 * seekTo(0). All calls honor settingsStore.soundEnabled and are hard-guarded:
 * a broken audio stack must never break gameplay (or the jest env).
 */

export type SoundName =
  | 'correct'
  | 'wrong'
  | 'combo'
  | 'xp_tick'
  | 'level_complete'
  | 'streak'
  | 'legendary';

const SOURCES: Record<SoundName, number> = {
  correct: require('../../assets/sounds/correct.wav'),
  wrong: require('../../assets/sounds/wrong.wav'),
  combo: require('../../assets/sounds/combo.wav'),
  xp_tick: require('../../assets/sounds/xp-tick.wav'),
  level_complete: require('../../assets/sounds/level-complete.wav'),
  streak: require('../../assets/sounds/streak.wav'),
  legendary: require('../../assets/sounds/legendary.wav'),
};

/** Soft-pedal the count-up ticks; everything else plays at full volume. */
const VOLUMES: Partial<Record<SoundName, number>> = {
  xp_tick: 0.45,
};

const pool = new Map<SoundName, AudioPlayer>();

function playerFor(name: SoundName): AudioPlayer {
  let player = pool.get(name);
  if (!player) {
    player = createAudioPlayer(SOURCES[name]);
    player.volume = VOLUMES[name] ?? 1;
    pool.set(name, player);
  }
  return player;
}

/** Fire-and-forget SFX. No-op when sounds are disabled in settings. */
export function play(name: SoundName): void {
  if (!useSettingsStore.getState().soundEnabled) return;
  try {
    const player = playerFor(name);
    // expo-audio does NOT rewind on completion — seek back before replaying.
    void player.seekTo(0).catch(() => {});
    player.play();
  } catch {
    // SFX are decorative — swallow any native audio failure.
  }
}

/** Releases every pooled native player (tests / teardown). */
export function releaseSounds(): void {
  pool.forEach((player) => {
    try {
      player.remove();
    } catch {
      // Already released.
    }
  });
  pool.clear();
}

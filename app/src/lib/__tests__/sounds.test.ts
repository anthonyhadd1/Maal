import { createAudioPlayer } from 'expo-audio';

import { play, releaseSounds } from '@/lib/sounds';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * expo-audio is mocked globally (src/test/setup.ts): createAudioPlayer
 * returns a fresh {play, seekTo, remove} spy object per call, which lets us
 * assert the pooling + rewind-before-replay contract.
 */

const createMock = createAudioPlayer as jest.Mock;

interface MockPlayer {
  play: jest.Mock;
  seekTo: jest.Mock;
  remove: jest.Mock;
  volume: number;
}

function playerAt(index: number): MockPlayer {
  return createMock.mock.results[index].value as MockPlayer;
}

describe('sounds', () => {
  beforeEach(() => {
    releaseSounds(); // empty the module-level pool between tests
    createMock.mockClear();
    useSettingsStore.setState({ soundEnabled: true });
  });

  test('play() lazily creates ONE pooled player per sound name', () => {
    play('correct');
    play('correct');
    play('correct');

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(playerAt(0).play).toHaveBeenCalledTimes(3);
  });

  test('replay rewinds first: seekTo(0) called before every play()', () => {
    play('wrong');
    play('wrong');

    const player = playerAt(0);
    expect(player.seekTo).toHaveBeenCalledTimes(2);
    expect(player.seekTo).toHaveBeenNthCalledWith(1, 0);
    expect(player.seekTo).toHaveBeenNthCalledWith(2, 0);

    // Strict ordering per trigger: seek #1 < play #1 < seek #2 < play #2.
    const seeks = player.seekTo.mock.invocationCallOrder;
    const plays = player.play.mock.invocationCallOrder;
    expect(seeks[0]).toBeLessThan(plays[0]);
    expect(plays[0]).toBeLessThan(seeks[1]);
    expect(seeks[1]).toBeLessThan(plays[1]);
  });

  test('distinct sound names get distinct pooled players', () => {
    play('correct');
    play('wrong');
    play('legendary');

    expect(createMock).toHaveBeenCalledTimes(3);
  });

  test('respects settingsStore.soundEnabled (no player, no playback)', () => {
    useSettingsStore.setState({ soundEnabled: false });
    play('level_complete');
    play('streak');

    expect(createMock).not.toHaveBeenCalled();

    // Re-enabling restores playback without any re-init step.
    useSettingsStore.setState({ soundEnabled: true });
    play('level_complete');
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(playerAt(0).play).toHaveBeenCalledTimes(1);
  });

  test('releaseSounds() removes native players and empties the pool', () => {
    play('combo');
    const first = playerAt(0);

    releaseSounds();
    expect(first.remove).toHaveBeenCalledTimes(1);

    play('combo'); // recreated after release
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  test('xp_tick is soft-pedaled (reduced volume) for the count-up loop', () => {
    play('xp_tick');
    expect(playerAt(0).volume).toBeLessThan(1);

    releaseSounds();
    createMock.mockClear();
    play('correct');
    expect(playerAt(0).volume).toBe(1);
  });
});

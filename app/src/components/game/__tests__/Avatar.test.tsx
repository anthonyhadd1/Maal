import { render } from '@testing-library/react-native';

import {
  Avatar,
  AVATAR_PRESET_IDS,
  avatarPaletteIndex,
  initialsFor,
} from '@/components/game/Avatar';
import { avatarPalette } from '@/theme/tokens';

describe('avatarPaletteIndex (deterministic pastel)', () => {
  test('same avatar_id always hashes to the same palette entry', () => {
    expect(avatarPaletteIndex('ace-3')).toBe(avatarPaletteIndex('ace-3'));
    expect(avatarPaletteIndex('rita-avatar')).toBe(avatarPaletteIndex('rita-avatar'));
  });

  test('index is always within palette bounds', () => {
    for (const id of [...AVATAR_PRESET_IDS, '', 'x', 'a-very-long-avatar-identifier']) {
      const index = avatarPaletteIndex(id, 'seed');
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(avatarPalette.length);
    }
  });

  test('missing id falls back to the seed (name) deterministically', () => {
    expect(avatarPaletteIndex(null, 'Nabil')).toBe(avatarPaletteIndex('', 'Nabil'));
  });

  test('the 8 presets do not all collide on one color', () => {
    const distinct = new Set(AVATAR_PRESET_IDS.map((id) => avatarPaletteIndex(id)));
    expect(distinct.size).toBeGreaterThan(1);
  });
});

describe('initialsFor', () => {
  test('first + last word initials, uppercased', () => {
    expect(initialsFor('Nabil Jaber')).toBe('NJ');
    expect(initialsFor('rita')).toBe('R');
    expect(initialsFor('  léa  el khoury ')).toBe('LK');
  });

  test('empty name → placeholder', () => {
    expect(initialsFor('')).toBe('?');
    expect(initialsFor('   ')).toBe('?');
  });
});

describe('<Avatar />', () => {
  test('renders the initials on the deterministic background', async () => {
    const { getByText, getByTestId } = await render(
      <Avatar avatarId="ace-3" name="Nabil Jaber" />,
    );
    // The avatar is decorative (a11y-hidden): opt hidden elements into the query.
    expect(getByText('NJ', { includeHiddenElements: true })).toBeTruthy();

    const expected = avatarPalette[avatarPaletteIndex('ace-3', 'Nabil Jaber')];
    const style = StyleSheetFlatten(
      getByTestId('avatar', { includeHiddenElements: true }).props.style,
    );
    expect(style.backgroundColor).toBe(expected.bg);
  });
});

/** Minimal style flatten (avoid importing StyleSheet internals). */
function StyleSheetFlatten(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.map((s) => StyleSheetFlatten(s)));
  }
  return (style ?? {}) as Record<string, unknown>;
}

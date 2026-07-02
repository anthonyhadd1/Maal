import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { avatarPalette, fonts } from '@/theme/tokens';

/**
 * Preset avatar circle: avatar_id → deterministic pastel background,
 * initials from the display name. No photo upload in v1 (moderation-free).
 */

/** The 8 preset avatar ids offered by the settings picker.
 * MUST match the backend's ids (Profile.avatar_id default + seed users): avatar-01…avatar-08. */
export const AVATAR_PRESET_IDS = [
  'avatar-01',
  'avatar-02',
  'avatar-03',
  'avatar-04',
  'avatar-05',
  'avatar-06',
  'avatar-07',
  'avatar-08',
] as const;

/** Deterministic palette index for an avatar id (same hash style as hashToHue). */
export function avatarPaletteIndex(avatarId: string | null | undefined, seed = ''): number {
  const id = avatarId || seed || 'ace';
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash % avatarPalette.length;
}

/** "Nabil Jaber" → "NJ", "rita" → "R". Falls back to "?" for empty names. */
export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0].charAt(0);
  const second = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + second).toUpperCase();
}

export interface AvatarProps {
  avatarId: string | null | undefined;
  /** Display name (or username fallback) the initials come from. */
  name: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function Avatar({ avatarId, name, size = 44, style }: AvatarProps) {
  const palette = avatarPalette[avatarPaletteIndex(avatarId, name)];

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: palette.bg,
        },
        style,
      ]}
      testID="avatar"
    >
      <Text
        allowFontScaling={false}
        style={[styles.initials, { color: palette.fg, fontSize: size * 0.38 }]}
      >
        {initialsFor(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: fonts.heading,
  },
});

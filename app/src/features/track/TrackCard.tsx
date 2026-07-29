import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { ClaySurface } from '@/components/clay/ClaySurface';
import { PressableScale } from '@/components/layout/PressableScale';
import type { Track } from '@/api/types';
import { shade, withAlpha } from '@/lib/color';
import { getLucideIcon } from '@/lib/lucide';
import { colors, radii, spacing, typography } from '@/theme/tokens';

interface TrackCardProps {
  track: Track;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}

/**
 * Large tinted clay card for a Track (« Concours d'entrée » /
 * « Examens de Spécialité »…) — used in the track switcher AND the
 * onboarding first step (shared, per contract). Each track feels like its
 * own "world": a soft gradient wash of the track's own color_hex behind an
 * accent icon bubble, name, description, and a selected-state check badge.
 */
export function TrackCard({ track, selected, onPress, testID }: TrackCardProps) {
  const accent = track.color_hex;
  const Icon = getLucideIcon(track.icon);
  // The description below is visible, informative text (what this track
  // actually is) — an explicit accessibilityLabel on this wrapper would
  // otherwise silently drop it for screen reader users.
  const a11yLabel = track.description ? `${track.name}, ${track.description}` : track.name;

  return (
    <PressableScale
      accessibilityLabel={a11yLabel}
      accessibilityState={{ selected }}
      clay={false}
      onPress={onPress}
      style={styles.wrap}
      testID={testID}
    >
      <ClaySurface
        backgroundColor={colors.neutral[0]}
        radius="xl"
        shadow={selected ? 'floating' : 'raised'}
        style={[
          styles.card,
          { borderColor: withAlpha(accent, selected ? 0.55 : 0.16) },
          selected && { borderColor: accent, borderWidth: 2.5 },
        ]}
      >
        <LinearGradient
          colors={[withAlpha(accent, 0.16), withAlpha(accent, 0.02)]}
          end={{ x: 1, y: 1 }}
          pointerEvents="none"
          start={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFill}
        />

        {selected ? (
          <View style={[styles.checkBadge, { backgroundColor: accent }]} testID={`${testID}-check`}>
            <Check color={colors.neutral[0]} size={16} strokeWidth={3.5} />
          </View>
        ) : null}

        <View
          style={[
            styles.iconBubble,
            { backgroundColor: accent, borderBottomColor: shade(accent, -0.28) },
          ]}
        >
          <Icon color={colors.neutral[0]} size={30} strokeWidth={2.2} />
        </View>

        <Text style={styles.name}>{track.name}</Text>
        {track.description ? <Text style={styles.description}>{track.description}</Text> : null}
      </ClaySurface>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
  },
  card: {
    alignItems: 'center',
    gap: spacing.s,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.l,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  checkBadge: {
    position: 'absolute',
    top: spacing.m,
    right: spacing.m,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  iconBubble: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 4,
  },
  name: {
    ...typography.h2,
    fontFamily: typography.h1.fontFamily,
    color: colors.neutral[900],
    textAlign: 'center',
  },
  description: {
    ...typography.small,
    color: colors.neutral[500],
    textAlign: 'center',
  },
});

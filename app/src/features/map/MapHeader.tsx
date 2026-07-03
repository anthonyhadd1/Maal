import { ChevronDown, LayoutGrid } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { MeGame } from '@/api/types';
import { ClaySurface } from '@/components/clay/ClaySurface';
import { HeartCounter } from '@/components/game/HeartCounter';
import { StreakFlame } from '@/components/game/StreakFlame';
import { XPBadge } from '@/components/game/XPBadge';
import { PressableScale } from '@/components/layout/PressableScale';
import { shade } from '@/lib/color';
import { getLucideIcon } from '@/lib/lucide';
import { colors, radii, spacing, typography } from '@/theme/tokens';

interface MapHeaderProps {
  subjectName: string;
  accent: string;
  game: MeGame | undefined;
  onSwitchSubject: () => void;
  /** Track icon prefix + tap target — opens the track switcher (§4a bis). */
  trackIcon?: string;
  onSwitchTrack?: () => void;
}

/**
 * Floating clay card above the map list: a two-level breadcrumb chip
 * (track icon prefix -> track switcher, subject name -> subject switcher),
 * hearts (live), streak flame and XP — evenly spaced on one row.
 */
export function MapHeader({
  subjectName,
  accent,
  game,
  onSwitchSubject,
  trackIcon,
  onSwitchTrack,
}: MapHeaderProps) {
  const { t } = useTranslation('map');
  const TrackIcon = getLucideIcon(trackIcon, LayoutGrid);

  return (
    <View style={styles.wrap}>
      <ClaySurface radius="l" shadow="floating" style={styles.card}>
        <View
          style={[
            styles.subjectPill,
            { backgroundColor: accent, borderBottomColor: shade(accent, -0.28) },
          ]}
        >
          {onSwitchTrack ? (
            <PressableScale
              accessibilityLabel={t('trackSwitcher.title')}
              clay={false}
              hitSlop={8}
              onPress={onSwitchTrack}
              pressedTranslateY={1}
              style={styles.trackTap}
              testID="map-track-switcher"
            >
              <TrackIcon color={colors.neutral[0]} size={15} strokeWidth={2.4} />
            </PressableScale>
          ) : null}
          <PressableScale
            accessibilityLabel={t('switcher.title')}
            clay={false}
            onPress={onSwitchSubject}
            pressedTranslateY={2}
            style={styles.subjectTap}
            testID="map-subject-switcher"
          >
            <Text numberOfLines={1} style={styles.subjectName}>
              {subjectName}
            </Text>
            <ChevronDown color={colors.neutral[0]} size={16} strokeWidth={3} />
          </PressableScale>
        </View>

        <View style={styles.stats}>
          <HeartCounter
            compact
            count={game?.hearts ?? 0}
            size={20}
            unlimited={game?.hearts_unlimited ?? false}
          />
          <View style={styles.divider} />
          <StreakFlame days={game?.streak_current ?? 0} size={20} />
          <View style={styles.divider} />
          <XPBadge xp={game?.xp_total ?? 0} />
        </View>
      </ClaySurface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.m,
    paddingTop: spacing.xs,
    paddingBottom: spacing.s,
    zIndex: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.m,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
  },
  subjectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.pill,
    paddingLeft: spacing.m,
    paddingRight: spacing.l,
    minHeight: 44,
    maxWidth: 176,
    borderBottomWidth: 3,
  },
  trackTap: {
    paddingVertical: spacing.s,
    paddingRight: spacing.xs,
    marginRight: 2,
  },
  subjectTap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
    paddingVertical: spacing.s,
  },
  subjectName: {
    ...typography.smallMedium,
    fontFamily: typography.h2.fontFamily,
    color: colors.neutral[0],
    flexShrink: 1,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    flexShrink: 0,
  },
  divider: {
    width: 1,
    height: 18,
    backgroundColor: colors.neutral[200],
  },
});

import { ChevronDown } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { MeGame } from '@/api/types';
import { ClaySurface } from '@/components/clay/ClaySurface';
import { HeartCounter } from '@/components/game/HeartCounter';
import { StreakFlame } from '@/components/game/StreakFlame';
import { XPBadge } from '@/components/game/XPBadge';
import { PressableScale } from '@/components/layout/PressableScale';
import { shade } from '@/lib/color';
import { colors, radii, spacing, typography } from '@/theme/tokens';

interface MapHeaderProps {
  subjectName: string;
  accent: string;
  game: MeGame | undefined;
  onSwitchSubject: () => void;
}

/**
 * Floating clay card above the map list: subject switcher chip (accent),
 * hearts (live), streak flame and XP — evenly spaced on one row.
 */
export function MapHeader({ subjectName, accent, game, onSwitchSubject }: MapHeaderProps) {
  const { t } = useTranslation('map');

  return (
    <View style={styles.wrap}>
      <ClaySurface radius="l" shadow="floating" style={styles.card}>
        <PressableScale
          accessibilityLabel={t('switcher.title')}
          clay={false}
          onPress={onSwitchSubject}
          pressedTranslateY={2}
          style={[
            styles.subjectPill,
            { backgroundColor: accent, borderBottomColor: shade(accent, -0.28) },
          ]}
          testID="map-subject-switcher"
        >
          <Text numberOfLines={1} style={styles.subjectName}>
            {subjectName}
          </Text>
          <ChevronDown color={colors.neutral[0]} size={16} strokeWidth={3} />
        </PressableScale>

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
    gap: spacing.xs,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.l,
    minHeight: 44,
    maxWidth: 168,
    borderBottomWidth: 3,
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

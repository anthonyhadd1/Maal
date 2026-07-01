import { ChevronDown } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { MeGame } from '@/api/types';
import { HeartCounter } from '@/components/game/HeartCounter';
import { StreakFlame } from '@/components/game/StreakFlame';
import { XPBadge } from '@/components/game/XPBadge';
import { PressableScale } from '@/components/layout/PressableScale';
import { colors, radii, spacing, typography } from '@/theme/tokens';

interface MapHeaderProps {
  subjectName: string;
  accent: string;
  game: MeGame | undefined;
  onSwitchSubject: () => void;
}

/**
 * Sticky compact header above the map list:
 * subject switcher pill · hearts (live) · streak flame · XP.
 */
export function MapHeader({ subjectName, accent, game, onSwitchSubject }: MapHeaderProps) {
  const { t } = useTranslation('map');

  return (
    <View style={styles.bar}>
      <PressableScale
        accessibilityLabel={t('switcher.title')}
        clay={false}
        onPress={onSwitchSubject}
        pressedTranslateY={2}
        style={[styles.subjectPill, { backgroundColor: accent }]}
        testID="map-subject-switcher"
      >
        <Text numberOfLines={1} style={styles.subjectName}>
          {subjectName}
        </Text>
        <ChevronDown color={colors.neutral[0]} size={18} strokeWidth={2.6} />
      </PressableScale>

      <View style={styles.stats}>
        <HeartCounter
          compact
          count={game?.hearts ?? 0}
          size={20}
          unlimited={game?.hearts_unlimited ?? false}
        />
        <StreakFlame days={game?.streak_current ?? 0} size={20} />
        <XPBadge xp={game?.xp_total ?? 0} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.m,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.s,
    backgroundColor: colors.neutral[50],
  },
  subjectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.s,
    maxWidth: 180,
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
    gap: spacing.m,
  },
});

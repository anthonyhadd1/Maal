import { ChevronDown } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { MeGame } from '@/api/types';
import { ClaySurface } from '@/components/clay/ClaySurface';
import { HeartCounter } from '@/components/game/HeartCounter';
import { StreakFlame } from '@/components/game/StreakFlame';
import { XPBadge } from '@/components/game/XPBadge';
import { PressableScale } from '@/components/layout/PressableScale';
import { accentFill, shade } from '@/lib/color';
import { colors, radii, spacing, typography } from '@/theme/tokens';

interface MapHeaderProps {
  subjectName: string;
  accent: string;
  game: MeGame | undefined;
  onSwitchSubject: () => void;
}

/**
 * Single-row chrome above the map: subject pill + hearts / streak / XP.
 *
 * Deliberately ONE row. It used to stack a "Chapitre 1/10" chip under the
 * subject pill, which cost a whole row and — once the pinned chapter bar
 * landed below it — meant the screen carried TWO different "Chapitre …"
 * readouts saying different numbers (the chip counts the chapter you have
 * REACHED, the bar names the one you are LOOKING at). Confusing, and on a
 * small phone the two of them plus the chapter banner left barely two level
 * nodes visible. The bar won: it answers the more useful question and doubles
 * as the entry point to the full programme.
 */
export function MapHeader({ subjectName, accent, game, onSwitchSubject }: MapHeaderProps) {
  const { t } = useTranslation('map');

  return (
    <View style={styles.wrap}>
      <ClaySurface radius="l" shadow="floating" style={styles.card}>
        {/* The pill IS the button — a decorative wrapper with a smaller
            Pressable inside left its padded edges dead. */}
        <PressableScale
          accessibilityLabel={t('switcher.title')}
          clay={false}
          onPress={onSwitchSubject}
          pressedTranslateY={2}
          style={[
            styles.subjectPill,
            { backgroundColor: accentFill(accent), borderBottomColor: shade(accent, -0.6) },
          ]}
          testID="map-subject-switcher"
        >
          <Text numberOfLines={1} style={styles.subjectName}>
            {subjectName}
          </Text>
          <ChevronDown color={colors.neutral[0]} size={15} strokeWidth={3} />
        </PressableScale>

        <View style={styles.stats}>
          <HeartCounter
            compact
            count={game?.hearts ?? 0}
            size={19}
            unlimited={game?.hearts_unlimited ?? false}
          />
          <View style={styles.divider} />
          <StreakFlame days={game?.streak_current ?? 0} size={19} />
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
    paddingBottom: spacing.xs,
    zIndex: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.s,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
  },
  subjectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    // 40 rather than 44: the pill sits inside a card with its own padding, so
    // the effective touch target is comfortably past the 44pt minimum while
    // the chrome gives ~30pt of map back on a small screen.
    minHeight: 40,
    maxWidth: 168,
    borderBottomWidth: 3,
    // Never let the subject name — the most identifying label here — collapse
    // before the fixed-width XP badge does.
    flexShrink: 1,
    minWidth: 108,
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
    gap: spacing.xs,
    flexShrink: 1,
    minWidth: 0,
  },
  divider: {
    width: 1,
    height: 16,
    backgroundColor: colors.neutral[200],
  },
});

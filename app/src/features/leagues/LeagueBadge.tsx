import { LinearGradient } from 'expo-linear-gradient';
import { ChevronsDown, ChevronsUp, Clock } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { LeagueTierInfo } from '@/api/types';
import { msToParts } from '@/lib/format';
import { getLucideIcon } from '@/lib/lucide';
import { colors, fonts, radii, shadows, spacing, typography } from '@/theme/tokens';
import { darken, lighten, tint } from '@/features/leagues/tierColor';
import { tierNameKey } from '@/features/leagues/tierName';

const MEDALLION_SIZE = 104;
const MEDALLION_EDGE = 6;
const TICK_MS = 60_000;

interface LeagueBadgeProps {
  tier: LeagueTierInfo;
  promoteCount: number;
  demoteCount: number;
  weekEndsAt: string;
}

/**
 * Ligue hero: soft tier-tinted gradient band hosting a big clay medallion
 * (tier color, moulded edge + top light), the tier name in Nunito 900,
 * promote/demote captions and a live week-countdown chip.
 */
export function LeagueBadge({ tier, promoteCount, demoteCount, weekEndsAt }: LeagueBadgeProps) {
  const { t } = useTranslation('leagues');
  const Icon = getLucideIcon(tier.icon);
  const countdown = useWeekCountdown(weekEndsAt);
  const nameKey = tierNameKey(tier.order);
  const name = nameKey ? t(`tierNames.${nameKey}`) : tier.name;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[tint(tier.color_hex, 0.28), tint(tier.color_hex, 0.05)]}
        end={{ x: 0.5, y: 1 }}
        start={{ x: 0.5, y: 0 }}
        style={styles.band}
      >
        <View
          style={[
            styles.medallion,
            {
              backgroundColor: tier.color_hex,
              borderBottomColor: darken(tier.color_hex, 0.32),
            },
          ]}
          testID="league-medallion"
        >
          <LinearGradient
            colors={[lighten(tier.color_hex, 0.4), tint(tier.color_hex, 0)]}
            pointerEvents="none"
            style={styles.medallionSheen}
          />
          <Icon color={colors.neutral[0]} size={46} strokeWidth={2.2} />
        </View>

        <Text accessibilityRole="header" style={styles.name}>
          {name}
        </Text>

        <View style={styles.zoneCaptions}>
          <View style={styles.zoneCaption}>
            {/* successEdge, not successDeep — successDeep only holds 3.3:1
                against the pill's white backing, below the 4.5:1 minimum. */}
            <ChevronsUp color={colors.successEdge} size={14} strokeWidth={2.8} />
            <Text style={[styles.zoneCaptionText, { color: colors.successEdge }]}>
              {t('hero.promote', { count: promoteCount })}
            </Text>
          </View>
          <View style={styles.zoneDot} />
          <View style={styles.zoneCaption}>
            <ChevronsDown color={colors.dangerDeep} size={14} strokeWidth={2.8} />
            <Text style={[styles.zoneCaptionText, { color: colors.dangerDeep }]}>
              {t('hero.demote', { count: demoteCount })}
            </Text>
          </View>
        </View>

        <View style={styles.countdownChip}>
          <Clock color={colors.neutral[700]} size={14} strokeWidth={2.4} />
          <Text style={styles.countdown} testID="league-countdown">
            {t('countdown.endsIn', { time: countdown })}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

/** "2 j 4 h" → "3 h 24 min" → "12 min", re-rendered every minute. */
function useWeekCountdown(weekEndsAt: string): string {
  const { t } = useTranslation('leagues');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const ms = Math.max(0, Date.parse(weekEndsAt) - now);
  const { days, hours, minutes } = msToParts(ms);
  if (days > 0) {
    return hours > 0 ? t('countdown.daysHours', { days, hours }) : t('countdown.days', { days });
  }
  if (hours > 0) return t('countdown.hoursMinutes', { hours, minutes });
  return t('countdown.minutes', { minutes });
}

const styles = StyleSheet.create({
  root: {
    marginBottom: spacing.m,
  },
  band: {
    alignItems: 'center',
    gap: spacing.s,
    borderRadius: radii.xl,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.l,
  },
  medallion: {
    width: MEDALLION_SIZE,
    height: MEDALLION_SIZE + MEDALLION_EDGE,
    borderRadius: MEDALLION_SIZE / 2,
    borderBottomWidth: MEDALLION_EDGE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: spacing.xs,
    ...shadows.clayRaised,
  },
  medallionSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '48%',
    borderTopLeftRadius: MEDALLION_SIZE / 2,
    borderTopRightRadius: MEDALLION_SIZE / 2,
    opacity: 0.55,
  },
  name: {
    fontFamily: fonts.headingBlack,
    fontSize: 26,
    lineHeight: 32,
    color: colors.neutral[900],
  },
  zoneCaptions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
  },
  // Own opaque backing (not just the translucent band behind it, matching
  // countdownChip below) — successDeep/dangerDeep text measured as low as
  // 2.22:1 directly on the band's alpha-tinted gradient, below the 4.5:1
  // minimum.
  zoneCaption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.neutral[0],
    borderRadius: radii.pill,
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xs,
  },
  zoneCaptionText: {
    ...typography.caption,
    fontFamily: fonts.bodyBold,
  },
  zoneDot: {
    width: 3,
    height: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.neutral[500],
  },
  countdownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.neutral[0],
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
    ...shadows.clayPressed,
  },
  countdown: {
    ...typography.caption,
    fontFamily: fonts.bodyBold,
    color: colors.neutral[700],
  },
});

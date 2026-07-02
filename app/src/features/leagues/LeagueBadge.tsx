import { Clock } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { LeagueTierInfo } from '@/api/types';
import { ClaySurface } from '@/components/clay/ClaySurface';
import { msToParts } from '@/lib/format';
import { getLucideIcon } from '@/lib/lucide';
import { colors, spacing, typography } from '@/theme/tokens';

const MEDALLION_SIZE = 88;
const TICK_MS = 60_000;

interface LeagueBadgeProps {
  tier: LeagueTierInfo;
  promoteCount: number;
  demoteCount: number;
  weekEndsAt: string;
}

/**
 * Tier badge header: clay medallion in the tier color + lucide icon,
 * tier name, promotion/demotion caption, live week countdown.
 */
export function LeagueBadge({ tier, promoteCount, demoteCount, weekEndsAt }: LeagueBadgeProps) {
  const { t } = useTranslation('leagues');
  const Icon = getLucideIcon(tier.icon);
  const countdown = useWeekCountdown(weekEndsAt);

  return (
    <View style={styles.root}>
      <ClaySurface
        backgroundColor={tier.color_hex}
        radius="pill"
        style={styles.medallion}
        testID="league-medallion"
      >
        <Icon color={colors.neutral[0]} size={40} strokeWidth={2.2} />
      </ClaySurface>
      <Text accessibilityRole="header" style={styles.name}>
        {tier.name}
      </Text>
      <Text style={styles.caption}>
        {t('caption', { promote: promoteCount, demote: demoteCount })}
      </Text>
      <View style={styles.countdownRow}>
        <Clock color={colors.neutral[500]} size={14} />
        <Text style={styles.countdown} testID="league-countdown">
          {t('countdown.endsIn', { time: countdown })}
        </Text>
      </View>
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
  if (days > 0) return t('countdown.daysHours', { days, hours });
  if (hours > 0) return t('countdown.hoursMinutes', { hours, minutes });
  return t('countdown.minutes', { minutes });
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.s,
  },
  medallion: {
    width: MEDALLION_SIZE,
    height: MEDALLION_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.s,
  },
  name: {
    ...typography.h1,
    color: colors.neutral[900],
  },
  caption: {
    ...typography.small,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  countdown: {
    ...typography.caption,
    color: colors.neutral[500],
  },
});

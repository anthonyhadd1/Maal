import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ClayDialog } from '@/components/feedback/ClayDialog';
import { colors, typography } from '@/theme/tokens';

interface HeartsModalProps {
  visible: boolean;
  /** ISO timestamp of the next heart regen tick (null = unknown). */
  nextHeartAt: string | null;
  onClose: () => void;
  onGoReview: () => void;
  onGoPremium: () => void;
}

/**
 * Blocking out-of-hearts modal (map, level start): sad mascot, live refill
 * countdown from `next_heart_at`, Révision earn-back, premium pitch.
 */
export function HeartsModal({
  visible,
  nextHeartAt,
  onClose,
  onGoReview,
  onGoPremium,
}: HeartsModalProps) {
  const { t } = useTranslation('session');
  const { t: tCommon } = useTranslation('common');
  const countdown = useCountdown(nextHeartAt, visible);

  return (
    <ClayDialog
      actions={[
        { label: t('hearts.empty.review'), onPress: onGoReview, variant: 'primary' },
        { label: t('hearts.empty.premium'), onPress: onGoPremium, variant: 'gold' },
        { label: tCommon('cta.close'), onPress: onClose, variant: 'secondary' },
      ]}
      mascotState="sad"
      message={t('hearts.empty.body', { time: countdown ?? '—' })}
      onRequestClose={onClose}
      title={t('hearts.empty.title')}
      visible={visible}
    >
      {countdown ? (
        <Text style={styles.countdown} testID="hearts-countdown">
          {t('hearts.refillIn', { time: countdown })}
        </Text>
      ) : null}
    </ClayDialog>
  );
}

/**
 * Ticks once per second while visible; null when no target. Builds the
 * string through i18n (matching LeagueBadge's useWeekCountdown) rather than
 * the old `formatDurationMs` util, which hardcoded French "h"/"min"/"s"
 * regardless of the active locale — an English-locale player would have
 * seen "3 h 24 min" in this exact countdown.
 */
function useCountdown(targetIso: string | null, active: boolean): string | null {
  const { t } = useTranslation('session');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active || !targetIso) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetIso, active]);

  if (!targetIso) return null;
  const remaining = new Date(targetIso).getTime() - now;
  if (!Number.isFinite(remaining)) return null;

  const totalSeconds = Math.max(0, Math.ceil(remaining / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return t('hearts.countdown.hoursMinutes', { hours, minutes: String(minutes).padStart(2, '0') });
  }
  if (minutes > 0) return t('hearts.countdown.minutes', { minutes });
  return t('hearts.countdown.seconds', { seconds: totalSeconds });
}

const styles = StyleSheet.create({
  countdown: {
    ...typography.bodyBold,
    color: colors.heartsRed,
    textAlign: 'center',
  },
});

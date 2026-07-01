import { X } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { HeartCounter } from '@/components/game/HeartCounter';
import { ProgressBar } from '@/components/game/ProgressBar';
import { ClayIconButton } from '@/components/clay/ClayIconButton';
import { ComboBadge } from '@/features/session/ComboBadge';
import { colors, spacing } from '@/theme/tokens';

interface SessionHeaderProps {
  answeredCount: number;
  total: number;
  currentIndex: number;
  hearts: number | null;
  heartsUnlimited: boolean;
  combo: number;
  accent: string;
  onQuit: () => void;
}

/**
 * Session chrome: X (quit-confirm) · segmented progress (current segment
 * pulsing) · live hearts (loss animation inside HeartCounter). The combo
 * flame pill floats under the bar from 3 consecutive correct answers.
 */
export function SessionHeader({
  answeredCount,
  total,
  currentIndex,
  hearts,
  heartsUnlimited,
  combo,
  accent,
  onQuit,
}: SessionHeaderProps) {
  const { t } = useTranslation('session');

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <ClayIconButton
          accessibilityLabel={t('a11y.quit')}
          backgroundColor={colors.neutral[100]}
          onPress={onQuit}
          size={40}
          testID="session-quit"
        >
          <X color={colors.neutral[500]} size={22} strokeWidth={2.6} />
        </ClayIconButton>

        <View style={styles.bar}>
          <ProgressBar
            accent={accent}
            filled={answeredCount}
            height={14}
            pulseIndex={currentIndex}
            segments={Math.max(total, 1)}
            variant="segmented"
          />
        </View>

        <HeartCounter
          count={hearts ?? 5}
          size={17}
          unlimited={heartsUnlimited}
        />
      </View>

      <View style={styles.comboRow}>
        <ComboBadge combo={combo} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
  },
  bar: {
    flex: 1,
  },
  comboRow: {
    minHeight: 30,
    alignItems: 'center',
  },
});

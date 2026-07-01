import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ClayButton } from '@/components/clay/ClayButton';
import { Mascot } from '@/components/mascot/Mascot';
import { colors, spacing, typography } from '@/theme/tokens';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Screen-root query error: sad mascot + « Réessayer ». */
export function ErrorState({ title, message, onRetry, retrying = false, style }: ErrorStateProps) {
  const { t } = useTranslation('errors');

  return (
    <View style={[styles.root, style]}>
      <Mascot size={140} state="sad" />
      <Text style={styles.title}>{title ?? t('generic')}</Text>
      <Text style={styles.message}>{message ?? t('network')}</Text>
      {onRetry ? (
        <ClayButton
          loading={retrying}
          onPress={onRetry}
          style={styles.cta}
          title={t('retry')}
          variant="primary"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.m,
  },
  title: {
    ...typography.h2,
    color: colors.neutral[900],
    textAlign: 'center',
    marginTop: spacing.s,
  },
  message: {
    ...typography.body,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  cta: {
    marginTop: spacing.m,
  },
});

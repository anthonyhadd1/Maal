import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ClayButton } from '@/components/clay/ClayButton';
import { ClayCard } from '@/components/clay/ClayCard';
import { AuthSheet } from '@/features/auth/AuthSheet';
import { colors, spacing, typography } from '@/theme/tokens';

/** Static v1 screen — no SMTP yet, recovery goes through support. */
export function ForgotPasswordScreen() {
  const { t } = useTranslation('auth');
  const router = useRouter();

  return (
    <AuthSheet mascotState="thinking" subtitle={t('forgot.body')} title={t('forgot.title')}>
      <ClayCard style={styles.card}>
        <Text style={styles.detail}>{t('forgot.detail')}</Text>
      </ClayCard>
      <View style={styles.actions}>
        <ClayButton
          fullWidth
          onPress={() => router.back()}
          size="l"
          title={t('forgot.back')}
          variant="primary"
        />
      </View>
    </AuthSheet>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    gap: spacing.s,
  },
  detail: {
    ...typography.small,
    color: colors.neutral[700],
    textAlign: 'center',
  },
  actions: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    marginTop: spacing.xl,
  },
});

import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ClayButton } from '@/components/clay/ClayButton';
import { ClayCard } from '@/components/clay/ClayCard';
import { Screen } from '@/components/layout/Screen';
import { Mascot } from '@/components/mascot/Mascot';
import { colors, spacing, typography } from '@/theme/tokens';

/** Static v1 screen — no SMTP yet, recovery goes through support. */
export function ForgotPasswordScreen() {
  const { t } = useTranslation('auth');
  const router = useRouter();

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.body}>
        <Mascot size={140} state="thinking" />
        <Text accessibilityRole="header" style={styles.title}>
          {t('forgot.title')}
        </Text>
        <ClayCard style={styles.card}>
          <Text style={styles.message}>{t('forgot.body')}</Text>
          <Text style={styles.detail}>{t('forgot.detail')}</Text>
        </ClayCard>
      </View>
      <View style={styles.actions}>
        <ClayButton
          fullWidth
          onPress={() => router.back()}
          size="l"
          title={t('forgot.back')}
          variant="primary"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.l,
  },
  title: {
    ...typography.h1,
    color: colors.neutral[900],
    textAlign: 'center',
  },
  card: {
    alignSelf: 'stretch',
    gap: spacing.s,
  },
  message: {
    ...typography.bodyBold,
    color: colors.neutral[900],
    textAlign: 'center',
  },
  detail: {
    ...typography.small,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  actions: {
    paddingBottom: spacing.l,
  },
});

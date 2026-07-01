import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ClayButton } from '@/components/clay/ClayButton';
import { Screen } from '@/components/layout/Screen';
import { Mascot } from '@/components/mascot/Mascot';
import { colors, spacing, typography } from '@/theme/tokens';

export function WelcomeScreen() {
  const { t } = useTranslation('auth');
  const router = useRouter();

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.hero}>
        <Mascot size={180} state="idle" />
        <Text accessibilityRole="header" style={styles.wordmark}>
          {t('welcome.title')}
        </Text>
        <Text style={styles.tagline}>{t('welcome.tagline')}</Text>
        <Text style={styles.pitch}>{t('welcome.pitch')}</Text>
      </View>
      <View style={styles.actions}>
        <ClayButton
          fullWidth
          onPress={() => router.push('/register')}
          size="l"
          title={t('welcome.start')}
          variant="primary"
        />
        <ClayButton
          fullWidth
          onPress={() => router.push('/login')}
          size="l"
          title={t('welcome.haveAccount')}
          variant="secondary"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s,
  },
  wordmark: {
    ...typography.display,
    fontSize: 56,
    lineHeight: 64,
    color: colors.primary[600],
    letterSpacing: 4,
  },
  tagline: {
    ...typography.h2,
    color: colors.neutral[900],
    textAlign: 'center',
  },
  pitch: {
    ...typography.body,
    color: colors.neutral[500],
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.l,
  },
  actions: {
    gap: spacing.m,
    paddingBottom: spacing.l,
  },
});

import { isAxiosError } from 'axios';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLogin } from '@/api/queries/auth';
import { ClayButton } from '@/components/clay/ClayButton';
import { ClayInput } from '@/components/clay/ClayInput';
import { useToast } from '@/components/feedback/Toast';
import { AuthSheet } from '@/features/auth/AuthSheet';
import { withAlpha } from '@/lib/color';
import { colors, spacing, typography } from '@/theme/tokens';

export function LoginScreen() {
  const { t } = useTranslation('auth');
  const { t: tErrors } = useTranslation('errors');
  const router = useRouter();
  const toast = useToast();
  const login = useLogin();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const submit = () => {
    if (!username.trim() || !password || login.isPending) return;
    setFormError(null);
    login.mutate(
      { username: username.trim(), password },
      {
        onError: (error) => {
          if (isAxiosError(error) && error.response?.status === 401) {
            setFormError(t('login.failed'));
            return;
          }
          toast.show({ type: 'error', message: tErrors('server') });
        },
      },
    );
  };

  return (
    <AuthSheet subtitle={t('login.subtitle')} title={t('login.title')}>
      <View style={styles.form}>
        <ClayInput
          autoCapitalize="none"
          autoComplete="username"
          autoCorrect={false}
          dark
          label={t('login.username')}
          onChangeText={setUsername}
          placeholder={t('login.usernamePlaceholder')}
          testID="login-username"
          value={username}
        />
        <ClayInput
          autoCapitalize="none"
          autoComplete="current-password"
          dark
          error={formError}
          label={t('login.password')}
          onChangeText={setPassword}
          onSubmitEditing={submit}
          placeholder={t('login.passwordPlaceholder')}
          returnKeyType="go"
          secureTextEntry
          testID="login-password"
          value={password}
        />
      </View>

      <View style={styles.actions}>
        <ClayButton
          disabled={!username.trim() || !password}
          fullWidth
          loading={login.isPending}
          onPress={submit}
          size="l"
          testID="login-submit"
          title={t('login.submit')}
          variant="inverted"
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/forgot-password')}
          style={styles.linkRow}
          testID="login-forgot"
        >
          <Text style={styles.link}>{t('login.forgot')}</Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/register')}
          style={styles.footerRow}
          testID="login-no-account"
        >
          <Text style={styles.footerMuted}>{t('login.noAccountQ')} </Text>
          <Text style={styles.footerLink}>{t('login.noAccount')}</Text>
        </Pressable>
      </View>
    </AuthSheet>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.l,
  },
  actions: {
    gap: spacing.m,
    marginTop: spacing.xl,
  },
  linkRow: {
    alignSelf: 'center',
    // Visible >=44pt tap target without relying on hitSlop (unreliable on
    // react-native-web).
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.m,
  },
  link: {
    ...typography.smallMedium,
    color: colors.primary[300],
  },
  footer: {
    marginTop: spacing.xxl,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.m,
  },
  footerMuted: {
    ...typography.small,
    color: withAlpha(colors.neutral[0], 0.62),
  },
  footerLink: {
    ...typography.small,
    fontFamily: typography.smallMedium.fontFamily,
    color: colors.primary[300],
  },
});

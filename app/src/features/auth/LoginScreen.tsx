import { isAxiosError } from 'axios';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLogin } from '@/api/queries/auth';
import { ClayButton } from '@/components/clay/ClayButton';
import { ClayInput } from '@/components/clay/ClayInput';
import { useToast } from '@/components/feedback/Toast';
import { AuthSheet } from '@/features/auth/AuthSheet';
import { spacing } from '@/theme/tokens';

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
    <AuthSheet mascotState="idle" subtitle={t('login.subtitle')} title={t('login.title')}>
      <View style={styles.form}>
        <ClayInput
          autoCapitalize="none"
          autoComplete="username"
          autoCorrect={false}
          label={t('login.username')}
          onChangeText={setUsername}
          placeholder={t('login.usernamePlaceholder')}
          testID="login-username"
          value={username}
        />
        <ClayInput
          autoCapitalize="none"
          autoComplete="current-password"
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
          variant="primary"
        />
        <ClayButton
          fullWidth
          onPress={() => router.push('/forgot-password')}
          title={t('login.forgot')}
          variant="secondary"
        />
        <ClayButton
          fullWidth
          haptic={false}
          onPress={() => router.replace('/register')}
          title={t('login.noAccount')}
          variant="secondary"
        />
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
});

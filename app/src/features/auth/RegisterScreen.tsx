import { isAxiosError } from 'axios';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useRegister } from '@/api/queries/auth';
import { ClayButton } from '@/components/clay/ClayButton';
import { ClayInput } from '@/components/clay/ClayInput';
import { useToast } from '@/components/feedback/Toast';
import { Screen } from '@/components/layout/Screen';
import { Mascot } from '@/components/mascot/Mascot';
import {
  extractFieldErrors,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validateUsername,
} from '@/features/auth/validation';
import { colors, spacing, typography } from '@/theme/tokens';

type Field = 'username' | 'display_name' | 'email' | 'password';
type Errors = Partial<Record<Field, string | null>>;

export function RegisterScreen() {
  const { t } = useTranslation('auth');
  const { t: tErrors } = useTranslation('errors');
  const router = useRouter();
  const toast = useToast();
  const register = useRegister();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  const setFieldError = (field: Field, error: string | null) =>
    setErrors((prev) => ({ ...prev, [field]: error }));

  const validateAll = (): boolean => {
    const next: Errors = {
      username: validateUsername(username),
      display_name: validateDisplayName(displayName),
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setErrors(next);
    return !Object.values(next).some(Boolean);
  };

  const submit = () => {
    if (!validateAll() || register.isPending) return;
    register.mutate(
      {
        username: username.trim(),
        password,
        display_name: displayName.trim(),
        email: email.trim() || undefined,
      },
      {
        onError: (error) => {
          if (isAxiosError(error) && error.response?.status === 400) {
            const fieldErrors = extractFieldErrors(error.response.data);
            let matched = false;
            (['username', 'display_name', 'email', 'password'] as const).forEach((field) => {
              if (fieldErrors[field]) {
                setFieldError(field, fieldErrors[field]);
                matched = true;
              }
            });
            if (!matched) {
              toast.show({ type: 'error', message: tErrors('validation') });
            }
            return;
          }
          toast.show({ type: 'error', message: tErrors('server') });
        },
        // Success: tokens stored + authStore flips to 'authed'
        // -> the (auth) layout redirects into the tabs.
      },
    );
  };

  return (
    <Screen scroll>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.grow}
      >
        <View style={styles.header}>
          <Mascot size={96} state="celebrate" />
          <Text accessibilityRole="header" style={styles.title}>
            {t('register.title')}
          </Text>
          <Text style={styles.subtitle}>{t('register.subtitle')}</Text>
        </View>

        <View style={styles.form}>
          <ClayInput
            autoCapitalize="none"
            autoComplete="username-new"
            autoCorrect={false}
            error={errors.username}
            label={t('register.username')}
            onBlur={() => setFieldError('username', validateUsername(username))}
            onChangeText={setUsername}
            placeholder={t('register.usernamePlaceholder')}
            testID="register-username"
            value={username}
          />
          <ClayInput
            autoComplete="name"
            error={errors.display_name}
            label={t('register.displayName')}
            onBlur={() => setFieldError('display_name', validateDisplayName(displayName))}
            onChangeText={setDisplayName}
            placeholder={t('register.displayNamePlaceholder')}
            testID="register-display-name"
            value={displayName}
          />
          <ClayInput
            autoCapitalize="none"
            autoComplete="email"
            error={errors.email}
            hint={t('register.emailHint')}
            keyboardType="email-address"
            label={t('register.email')}
            onBlur={() => setFieldError('email', validateEmail(email))}
            onChangeText={setEmail}
            placeholder={t('register.emailPlaceholder')}
            testID="register-email"
            value={email}
          />
          <ClayInput
            autoCapitalize="none"
            autoComplete="password-new"
            error={errors.password}
            label={t('register.password')}
            onBlur={() => setFieldError('password', validatePassword(password))}
            onChangeText={setPassword}
            placeholder={t('register.passwordPlaceholder')}
            secureTextEntry
            testID="register-password"
            value={password}
          />
        </View>

        <View style={styles.actions}>
          <ClayButton
            fullWidth
            loading={register.isPending}
            onPress={submit}
            size="l"
            testID="register-submit"
            title={t('register.submit')}
            variant="primary"
          />
          <ClayButton
            fullWidth
            onPress={() => router.replace('/login')}
            title={t('register.haveAccount')}
            variant="secondary"
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grow: {
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.neutral[900],
    marginTop: spacing.s,
  },
  subtitle: {
    ...typography.body,
    color: colors.neutral[500],
  },
  form: {
    gap: spacing.l,
  },
  actions: {
    gap: spacing.m,
    marginTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
});

import { isAxiosError } from 'axios';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useRegister } from '@/api/queries/auth';
import { ClayButton } from '@/components/clay/ClayButton';
import { ClayInput } from '@/components/clay/ClayInput';
import { useToast } from '@/components/feedback/Toast';
import { AuthSheet } from '@/features/auth/AuthSheet';
import {
  extractFieldErrors,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validateUsername,
} from '@/features/auth/validation';
import { withAlpha } from '@/lib/color';
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
        email: email.trim(),
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
    <AuthSheet subtitle={t('register.subtitle')} title={t('register.title')}>
      <View style={styles.form}>
        <ClayInput
          autoCapitalize="none"
          autoComplete="username-new"
          autoCorrect={false}
          dark
          error={errors.username}
          hint={t('register.usernameHint')}
          label={t('register.username')}
          onBlur={() => setFieldError('username', validateUsername(username))}
          onChangeText={setUsername}
          placeholder={t('register.usernamePlaceholder')}
          testID="register-username"
          value={username}
        />
        <ClayInput
          autoComplete="name"
          dark
          error={errors.display_name}
          hint={t('register.displayNameHint')}
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
          dark
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
          dark
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
          variant="inverted"
        />
      </View>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/login')}
          style={styles.footerRow}
          testID="register-have-account"
        >
          <Text style={styles.footerMuted}>{t('register.haveAccountQ')} </Text>
          <Text style={styles.footerLink}>{t('register.haveAccount')}</Text>
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

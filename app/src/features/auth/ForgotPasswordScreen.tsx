import { isAxiosError } from 'axios';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useConfirmPasswordReset, useRequestPasswordReset } from '@/api/queries/auth';
import { ClayButton } from '@/components/clay/ClayButton';
import { ClayInput } from '@/components/clay/ClayInput';
import { useToast } from '@/components/feedback/Toast';
import { AuthSheet } from '@/features/auth/AuthSheet';
import { validateEmail, validatePassword, validateResetCode } from '@/features/auth/validation';
import { withAlpha } from '@/lib/color';
import { colors, radii, spacing, typography } from '@/theme/tokens';

type Step = 'email' | 'code';

/**
 * Two-step password recovery:
 *  1. enter the account email  -> backend emails a 6-digit code
 *  2. enter code + new password -> backend verifies and rotates the password
 *
 * The request endpoint always returns 200 (it never reveals whether an address
 * is registered), so step 1 always advances to step 2 with a neutral banner.
 */
export function ForgotPasswordScreen() {
  const { t } = useTranslation('auth');
  const { t: tErrors } = useTranslation('errors');
  const router = useRouter();
  const toast = useToast();
  const requestReset = useRequestPasswordReset();
  const confirmReset = useConfirmPasswordReset();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const trimmedEmail = email.trim().toLowerCase();

  const sendCode = () => {
    const err = validateEmail(email);
    setEmailError(err);
    if (err || requestReset.isPending) return;
    requestReset.mutate(
      { email: trimmedEmail },
      {
        onSuccess: () => setStep('code'),
        onError: () => toast.show({ type: 'error', message: tErrors('server') }),
      },
    );
  };

  const resend = () => {
    if (requestReset.isPending) return;
    requestReset.mutate(
      { email: trimmedEmail },
      {
        onSuccess: () => toast.show({ type: 'success', message: t('forgot.resent') }),
        onError: () => toast.show({ type: 'error', message: tErrors('server') }),
      },
    );
  };

  const submitNewPassword = () => {
    const cErr = validateResetCode(code);
    const pErr = validatePassword(newPassword);
    setCodeError(cErr);
    setPasswordError(pErr);
    if (cErr || pErr || confirmReset.isPending) return;
    confirmReset.mutate(
      { email: trimmedEmail, code: code.trim(), new_password: newPassword },
      {
        onSuccess: () => {
          toast.show({ type: 'success', message: t('forgot.success') });
          router.replace('/login');
        },
        onError: (error) => {
          if (isAxiosError(error) && error.response?.status === 400) {
            const detail = (error.response.data as { detail?: string } | undefined)?.detail;
            setCodeError(detail ?? t('forgot.invalidCode'));
            return;
          }
          toast.show({ type: 'error', message: tErrors('server') });
        },
      },
    );
  };

  const subtitle = step === 'email' ? t('forgot.subtitleEmail') : t('forgot.subtitleCode');

  return (
    <AuthSheet subtitle={subtitle} title={t('forgot.title')}>
      {step === 'email' ? (
        <>
          <View style={styles.form}>
            <ClayInput
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              dark
              error={emailError}
              keyboardType="email-address"
              label={t('forgot.emailLabel')}
              onBlur={() => setEmailError(validateEmail(email))}
              onChangeText={(v) => {
                setEmail(v);
                if (emailError) setEmailError(null);
              }}
              onSubmitEditing={sendCode}
              placeholder={t('forgot.emailPlaceholder')}
              returnKeyType="send"
              testID="forgot-email"
              value={email}
            />
          </View>
          <View style={styles.actions}>
            <ClayButton
              fullWidth
              loading={requestReset.isPending}
              onPress={sendCode}
              size="l"
              testID="forgot-send-code"
              title={t('forgot.sendCode')}
              variant="inverted"
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={styles.linkRow}
              testID="forgot-back"
            >
              <Text style={styles.link}>{t('forgot.back')}</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <View
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={styles.banner}
            testID="forgot-sent-banner"
          >
            <Text style={styles.bannerText}>{t('forgot.sentBanner', { email: trimmedEmail })}</Text>
          </View>

          <View style={styles.form}>
            <ClayInput
              autoComplete="one-time-code"
              dark
              error={codeError}
              inputMode="numeric"
              keyboardType="number-pad"
              label={t('forgot.codeLabel')}
              maxLength={6}
              onBlur={() => setCodeError(validateResetCode(code))}
              onChangeText={(v) => {
                setCode(v.replace(/\D/g, ''));
                if (codeError) setCodeError(null);
              }}
              placeholder={t('forgot.codePlaceholder')}
              testID="forgot-code"
              value={code}
            />
            <ClayInput
              autoCapitalize="none"
              autoComplete="password-new"
              dark
              error={passwordError}
              label={t('forgot.newPasswordLabel')}
              onBlur={() => setPasswordError(validatePassword(newPassword))}
              onChangeText={(v) => {
                setNewPassword(v);
                if (passwordError) setPasswordError(null);
              }}
              onSubmitEditing={submitNewPassword}
              placeholder={t('forgot.newPasswordPlaceholder')}
              returnKeyType="go"
              secureTextEntry
              testID="forgot-new-password"
              value={newPassword}
            />
          </View>

          <View style={styles.actions}>
            <ClayButton
              fullWidth
              loading={confirmReset.isPending}
              onPress={submitNewPassword}
              size="l"
              testID="forgot-submit"
              title={t('forgot.submit')}
              variant="inverted"
            />
            <View style={styles.linkPairRow}>
              <Pressable
                accessibilityRole="button"
                disabled={requestReset.isPending}
                onPress={resend}
                style={styles.linkRow}
                testID="forgot-resend"
              >
                <Text style={styles.link}>{t('forgot.resend')}</Text>
              </Pressable>
              <View style={styles.linkDot} />
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setStep('email');
                  setCode('');
                  setCodeError(null);
                  setPasswordError(null);
                }}
                style={styles.linkRow}
                testID="forgot-change-email"
              >
                <Text style={styles.link}>{t('forgot.changeEmail')}</Text>
              </Pressable>
            </View>
          </View>
        </>
      )}
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
  banner: {
    backgroundColor: withAlpha(colors.primary[400], 0.12),
    borderWidth: 1,
    borderColor: withAlpha(colors.primary[400], 0.22),
    borderRadius: radii.m,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    marginBottom: spacing.l,
  },
  bannerText: {
    ...typography.small,
    color: colors.neutral[0],
  },
  linkRow: {
    alignSelf: 'center',
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.m,
  },
  link: {
    ...typography.smallMedium,
    color: colors.primary[300],
  },
  linkPairRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: spacing.s,
  },
  linkDot: {
    width: 3,
    height: 3,
    borderRadius: radii.pill,
    backgroundColor: withAlpha(colors.neutral[0], 0.3),
  },
});

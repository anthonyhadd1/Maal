import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ClayButton } from '@/components/clay/ClayButton';
import { PressableScale } from '@/components/layout/PressableScale';
import { Screen } from '@/components/layout/Screen';
import { colors, radii, spacing, typography } from '@/theme/tokens';

export const ONBOARDING_STEPS = 3;

interface OnboardingStepProps {
  /** 0-based step index (progress dots). */
  step: number;
  title: string;
  subtitle?: string;
  /** Continue button. */
  cta: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
  };
  /** « Plus tard » — omitted on non-skippable steps (rhythm). */
  onSkip?: () => void;
  skipLabel?: string;
}

/** Shared onboarding shell: progress dots, title, content, CTA (+ skip). */
export function OnboardingStep({
  step,
  title,
  subtitle,
  cta,
  onSkip,
  skipLabel,
  children,
}: PropsWithChildren<OnboardingStepProps>) {
  const { t } = useTranslation('onboarding');

  return (
    <Screen scroll>
      <View style={styles.dots} testID="onboarding-dots">
        {Array.from({ length: ONBOARDING_STEPS }, (_, i) => (
          <View
            key={i}
            style={[styles.dot, i === step && styles.dotActive]}
            testID={i === step ? 'dot-active' : `dot-${i}`}
          />
        ))}
      </View>

      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      <View style={styles.content}>{children}</View>

      <View style={styles.actions}>
        <ClayButton
          disabled={cta.disabled}
          fullWidth
          loading={cta.loading}
          onPress={cta.onPress}
          size="l"
          testID="onboarding-continue"
          title={cta.label}
          variant="primary"
        />
        {onSkip ? (
          <PressableScale
            accessibilityRole="button"
            clay={false}
            onPress={onSkip}
            pressedTranslateY={2}
            style={styles.skip}
            testID="onboarding-skip"
          >
            <Text style={styles.skipText}>{skipLabel ?? t('skip')}</Text>
          </PressableScale>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.s,
    marginTop: spacing.s,
    marginBottom: spacing.xl,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.neutral[300],
  },
  dotActive: {
    backgroundColor: colors.primary[500],
    width: 24,
  },
  title: {
    ...typography.h1,
    color: colors.neutral[900],
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.neutral[500],
    textAlign: 'center',
    marginTop: spacing.s,
  },
  content: {
    flexGrow: 1,
    marginTop: spacing.xl,
  },
  actions: {
    gap: spacing.m,
    paddingTop: spacing.xl,
    paddingBottom: spacing.l,
    alignItems: 'center',
  },
  skip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.m,
  },
  skipText: {
    ...typography.smallMedium,
    color: colors.neutral[500],
  },
});

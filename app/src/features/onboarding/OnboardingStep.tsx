import { ChevronLeft } from 'lucide-react-native';
import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ClayButton } from '@/components/clay/ClayButton';
import { InkBackdrop } from '@/components/layout/InkBackdrop';
import { Mascot } from '@/components/mascot/Mascot';
import type { MascotState } from '@/components/mascot/mascotStates';
import { PressableScale } from '@/components/layout/PressableScale';
import { withAlpha } from '@/lib/color';
import { colors, radii, spacing, typography } from '@/theme/tokens';

export const ONBOARDING_STEPS = 4;

interface OnboardingStepProps {
  /** 0-based step index (progress dots). */
  step: number;
  /**
   * How many dots to render. Defaults to the full concours flow; the
   * spécialité path skips the faculty-goal step, so it passes a smaller count
   * to avoid a phantom dot that never lights.
   */
  totalSteps?: number;
  title: string;
  subtitle?: string;
  /** Small mascot above the question (omit when the content hosts its own). */
  mascot?: MascotState;
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
  /**
   * Go back one step. Omitted on the first step only. Onboarding commits each
   * answer with a PATCH and navigates with `replace`, so without this there was
   * no way to revisit a mis-tapped choice — the flow was one-way (HIG:
   * multi-step flows must offer an escape route).
   */
  onBack?: () => void;
}

/**
 * Shared onboarding shell — the same near-black/violet "getting set up"
 * language as the welcome/auth screens (the last chapter before the user
 * reaches the light study app): dark ink backdrop, progress dots, mascot,
 * question, CTA (+ skip). The step CONTENT (track/goal/rhythm cards) stays as
 * self-contained white clay cards, which read as crisp panels on the dark
 * field — no per-card dark variant needed.
 */
export function OnboardingStep({
  step,
  totalSteps = ONBOARDING_STEPS,
  title,
  subtitle,
  mascot,
  cta,
  onSkip,
  skipLabel,
  onBack,
  children,
}: PropsWithChildren<OnboardingStepProps>) {
  const { t } = useTranslation('onboarding');
  const { t: tCommon } = useTranslation('common');

  return (
    <View style={styles.root}>
      <InkBackdrop glowOpacity={0.2} glowSize={440} glowTop="-2%" />

      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.progressRow}>
            {onBack ? (
              // Absolutely positioned so the dots stay optically centred on
              // the screen whether or not this step has a back target.
              <PressableScale
                accessibilityLabel={tCommon('cta.back')}
                accessibilityRole="button"
                clay={false}
                onPress={onBack}
                pressedTranslateY={2}
                style={styles.back}
                testID="onboarding-back"
              >
                <ChevronLeft color={withAlpha(colors.neutral[0], 0.82)} size={22} strokeWidth={2.6} />
              </PressableScale>
            ) : null}
            <View style={styles.dots} testID="onboarding-dots">
              {Array.from({ length: totalSteps }, (_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === step && styles.dotActive]}
                  testID={i === step ? 'dot-active' : `dot-${i}`}
                />
              ))}
            </View>
          </View>

          {mascot ? (
            <View style={styles.mascotWrap}>
              <Mascot size={88} state={mascot} />
            </View>
          ) : null}

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
              variant="inverted"
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
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.inkBottom,
  },
  safe: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.l,
    paddingTop: spacing.l,
    paddingBottom: spacing.xl,
  },
  progressRow: {
    justifyContent: 'center',
    marginTop: spacing.s,
    marginBottom: spacing.xl,
    minHeight: 44,
  },
  back: {
    position: 'absolute',
    left: -spacing.s,
    top: 0,
    bottom: 0,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.s,
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radii.pill,
    backgroundColor: withAlpha(colors.neutral[0], 0.22),
  },
  dotActive: {
    backgroundColor: colors.primary[400],
    width: 24,
  },
  mascotWrap: {
    alignItems: 'center',
    marginBottom: spacing.m,
  },
  title: {
    ...typography.h1,
    color: colors.neutral[0],
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: withAlpha(colors.neutral[0], 0.68),
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
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.m,
  },
  skipText: {
    ...typography.smallMedium,
    color: withAlpha(colors.neutral[0], 0.62),
  },
});

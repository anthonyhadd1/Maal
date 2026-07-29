import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  BarChart3,
  Brain,
  Check,
  Crown,
  Heart,
  Layers,
  Snowflake,
  Trophy,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useEntitlement } from '@/api/queries/entitlement';
import { ClayButton } from '@/components/clay/ClayButton';
import { ClayCard } from '@/components/clay/ClayCard';
import { ClayIconButton } from '@/components/clay/ClayIconButton';
import { ClayDialog } from '@/components/feedback/ClayDialog';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Mascot } from '@/components/mascot/Mascot';
import { PressableScale } from '@/components/layout/PressableScale';
import { Screen } from '@/components/layout/Screen';
import {
  DEFAULT_PLAN,
  PLANS,
  paywallCta,
  purchase,
  resolvePaywallMode,
  restore,
  type PlanId,
} from '@/features/paywall/entitlements';
import { FloatingIsland, type IslandPalette } from '@/features/scenes';
import { shade } from '@/lib/color';
import { PRIVACY_URL, TERMS_URL, hasLegalLinks, openLegal } from '@/lib/legal';
import { formatDate } from '@/lib/format';
import { colors, fonts, gradients, radii, shadows, spacing, typography } from '@/theme/tokens';
import { tints } from '@/theme/tints';

/** Gold-tinted mini island for the premium pitch (violet crystals stay). */
const GOLD_ISLAND: Partial<IslandPalette> = {
  topLight: shade(colors.xpGold, 0.45),
  top: colors.xpGold,
  rim: colors.goldDeep,
};

const BENEFITS: { key: string; Icon: LucideIcon }[] = [
  { key: 'allUnits', Icon: Layers },
  { key: 'unlimitedHearts', Icon: Heart },
  { key: 'smartReview', Icon: Brain },
  { key: 'detailedStats', Icon: BarChart3 },
  { key: 'exclusiveTrophies', Icon: Trophy },
  { key: 'streakFreezes', Icon: Snowflake },
];

/**
 * MODAL /paywall (design_gameplay.md §7): $4.99/mo vs $34.99/yr anchors,
 * annual preselected with «Économise 42%» + 7-day trial. Purchases are
 * stubbed behind features/paywall/entitlements — CTA shows « Bientôt
 * disponible » until RevenueCat lands. Premium users see a status view.
 */
export function PaywallScreen() {
  const { t } = useTranslation('paywall');
  const { t: tCommon } = useTranslation('common');
  const { t: tProfile } = useTranslation('profile');
  const router = useRouter();
  const entitlement = useEntitlement();

  const [plan, setPlan] = useState<PlanId>(DEFAULT_PLAN);
  const [comingSoon, setComingSoon] = useState(false);
  const [busy, setBusy] = useState(false);
  const ctaCopy = paywallCta(PLANS[plan]);

  const runPurchaseFlow = async (action: () => Promise<{ status: string }>) => {
    if (busy) return;
    setBusy(true);
    try {
      const outcome = await action();
      if (outcome.status === 'unavailable') setComingSoon(true);
    } finally {
      setBusy(false);
    }
  };

  const close = (
    <View style={styles.closeRow}>
      <ClayIconButton
        accessibilityLabel={tCommon('cta.close')}
        onPress={() => router.back()}
        testID="paywall-close"
      >
        <X color={colors.neutral[700]} size={22} />
      </ClayIconButton>
    </View>
  );

  if (entitlement.isPending) {
    return (
      <Screen edges={['top', 'left', 'right', 'bottom']}>
        {close}
        <View style={styles.skeleton} testID="paywall-skeleton">
          <Skeleton height={140} radius={radii.pill} width={140} />
          <Skeleton height={28} width="60%" />
          <Skeleton height={120} radius={radii.l} width="100%" />
          <Skeleton height={120} radius={radii.l} width="100%" />
        </View>
      </Screen>
    );
  }

  // Already premium → status view instead of the pitch.
  if (resolvePaywallMode(entitlement.data) === 'premium' && entitlement.data) {
    return (
      <Screen contentStyle={styles.premiumContent} edges={['top', 'left', 'right', 'bottom']} scroll>
        {close}
        {/* Centered as one block (not pinned top with the CTA pushed to the
            bottom edge via marginTop:'auto') — three short elements on a
            tall screen otherwise leave a bare gap that reads as unfinished,
            the same issue fixed on the welcome/login screens. */}
        <View style={styles.premiumGroup}>
          <View style={styles.hero} testID="paywall-premium">
            <Mascot size={140} state="celebrate" />
            <View style={styles.crownRow}>
              <Crown color={colors.xpGold} fill={colors.xpGold} size={26} />
              <Text accessibilityRole="header" style={styles.titleDark}>
                {t('premium.title')}
              </Text>
            </View>
            <Text style={styles.pitchDark}>{t('premium.body')}</Text>
          </View>
          <ClayCard style={styles.statusCard}>
            <Text style={styles.statusLine}>
              {entitlement.data.premium_until
                ? t('premium.until', { date: formatDate(entitlement.data.premium_until) })
                : t('premium.lifetime')}
            </Text>
            <Text style={styles.statusSource}>
              {t('premium.source', { source: entitlement.data.source })}
            </Text>
          </ClayCard>
          <View style={styles.premiumActions}>
            <ClayButton
              fullWidth
              onPress={() => router.back()}
              size="l"
              title={tCommon('cta.continue')}
              variant="primary"
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    // 'top' included like the loading and premium states — without it the
    // pitch's close button slid under the notch, and the button jumped
    // position the moment the entitlement query resolved.
    <Screen edges={['top', 'left', 'right', 'bottom']} padded={false} scroll>
      {/* Hero — brand gradient band that sells */}
      <LinearGradient
        colors={gradients.brandDeep}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.heroBand}
      >
        <View style={styles.closeRow}>
          <ClayIconButton
            accessibilityLabel={tCommon('cta.close')}
            onPress={() => router.back()}
            testID="paywall-close"
          >
            <X color={colors.neutral[700]} size={22} />
          </ClayIconButton>
        </View>
        <View style={styles.hero}>
          {/* Crowned mascot on a mini gold island — the premium worldlet. */}
          <FloatingIsland
            bobAmplitude={6}
            bobDurationMs={11000}
            idPrefix="paywallIsland"
            palette={GOLD_ISLAND}
            size={188}
          >
            <View>
              <Mascot size={112} state="celebrate" />
              <View style={styles.heroCrown}>
                <Crown color={colors.xpGold} fill={colors.xpGold} size={34} />
              </View>
            </View>
          </FloatingIsland>
          <Text accessibilityRole="header" style={styles.title}>
            {t('title')}
          </Text>
          <Text style={styles.pitch}>{t('pitch')}</Text>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {/* Benefits */}
        <View style={styles.benefits}>
          {BENEFITS.map(({ key, Icon }) => (
            <View key={key} style={styles.benefitRow}>
              <View style={styles.benefitIcon}>
                <Icon color={tints.goldText} size={18} strokeWidth={2.2} />
              </View>
              <Text style={styles.benefitText}>{t(`features.${key}`)}</Text>
            </View>
          ))}
        </View>

        {/* Plan selector */}
        <View style={styles.plans}>
          <PlanCard
            onPress={() => setPlan('monthly')}
            plan={PLANS.monthly}
            selected={plan === 'monthly'}
          />
          <PlanCard
            onPress={() => setPlan('annual')}
            plan={PLANS.annual}
            selected={plan === 'annual'}
          />
        </View>

        {/* CTA + restore + legal */}
        <View style={styles.actions}>
        {/* The label and the note both follow the SELECTED plan. The button
            used to read « Essayer 7 jours gratuits » even with the monthly
            plan active — which has no trial — so the paywall promised
            something the purchase would not deliver. */}
        <ClayButton
          fullWidth
          loading={busy}
          onPress={() => void runPurchaseFlow(() => purchase(plan))}
          size="l"
          testID="paywall-cta"
          title={t(ctaCopy.titleKey, ctaCopy.params)}
          variant="gold"
        />
        <Text style={styles.ctaNote} testID="paywall-cta-note">
          {t(ctaCopy.noteKey, ctaCopy.params)}
        </Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          clay={false}
          disabled={busy}
          onPress={() => void runPurchaseFlow(restore)}
          pressedTranslateY={2}
          style={[styles.restore, busy && styles.restoreDisabled]}
          testID="paywall-restore"
        >
          <Text style={styles.restoreText}>{t('restore')}</Text>
        </PressableScale>
          <Text style={styles.legal}>{t('legal')}</Text>
          {/* Guideline 3.1.2: an auto-renewable subscription must carry
              FUNCTIONAL links to the terms of use and the privacy policy at
              the point of purchase — inert legal prose is one of the most
              reliably enforced auto-rejections. Hidden when the URLs are not
              configured for this build rather than shipped dead. */}
          {hasLegalLinks() ? (
            <View style={styles.legalLinks}>
              <PressableScale
                accessibilityLabel={tProfile('settings.terms')}
                accessibilityRole="link"
                clay={false}
                onPress={() => void openLegal(TERMS_URL)}
                style={styles.legalLink}
                testID="paywall-terms"
              >
                <Text style={styles.legalLinkText}>{tProfile('settings.terms')}</Text>
              </PressableScale>
              <Text style={styles.legalDot}>·</Text>
              <PressableScale
                accessibilityLabel={tProfile('settings.privacy')}
                accessibilityRole="link"
                clay={false}
                onPress={() => void openLegal(PRIVACY_URL)}
                style={styles.legalLink}
                testID="paywall-privacy"
              >
                <Text style={styles.legalLinkText}>{tProfile('settings.privacy')}</Text>
              </PressableScale>
            </View>
          ) : null}
        </View>
      </View>

      {/* Purchases not wired yet (RevenueCat = later phase). */}
      <ClayDialog
        actions={[
          {
            label: tCommon('cta.close'),
            onPress: () => setComingSoon(false),
            variant: 'primary',
            testID: 'coming-soon-close',
          },
        ]}
        mascotState="thinking"
        message={t('comingSoon.body')}
        onRequestClose={() => setComingSoon(false)}
        title={t('comingSoon.title')}
        visible={comingSoon}
      />
    </Screen>
  );
}

function PlanCard({
  plan,
  selected,
  onPress,
}: {
  plan: (typeof PLANS)[PlanId];
  selected: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation('paywall');
  const monthly = plan.id === 'monthly';

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      // clay={false}: the wrapper is a plain rectangle, so its clay shadow
      // drew a square halo behind the rounded card. The inner planCard already
      // carries the raised/pressed elevation (same as GoalScreen/TrackCard).
      clay={false}
      onPress={onPress}
      style={styles.planCell}
      testID={`plan-${plan.id}`}
    >
      <View style={[styles.planCard, selected && styles.planCardSelected]}>
        {plan.savingsPct ? (
          <View style={styles.ribbon} testID="plan-ribbon">
            <Text style={styles.ribbonText}>{t('plans.save', { pct: plan.savingsPct })}</Text>
          </View>
        ) : null}
        <View style={[styles.planCheck, selected && styles.planCheckSelected]}>
          {selected ? <Check color={colors.neutral[0]} size={13} strokeWidth={3.5} /> : null}
        </View>
        <Text style={styles.planName}>{t(monthly ? 'plans.monthly' : 'plans.annual')}</Text>
        <Text style={styles.planPrice}>{plan.price}</Text>
        <Text style={styles.planPeriod}>{t(monthly ? 'plans.perMonth' : 'plans.perYear')}</Text>
        {plan.trialDays ? (
          <View style={styles.trialPill} testID="plan-trial">
            <Text style={styles.trialText}>{t('plans.trial', { days: plan.trialDays })}</Text>
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  closeRow: {
    alignItems: 'flex-end',
  },
  heroBand: {
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
    // The safe-area inset now supplies the top breathing room (see edges).
    paddingTop: spacing.s,
    paddingHorizontal: spacing.l,
    paddingBottom: spacing.xl,
  },
  body: {
    paddingHorizontal: spacing.l,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.s,
  },
  heroCrown: {
    position: 'absolute',
    top: -8,
    right: 2,
    transform: [{ rotate: '18deg' }],
  },
  crownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
  },
  title: {
    fontFamily: fonts.headingBlack,
    fontSize: 28,
    lineHeight: 34,
    color: colors.neutral[0],
    textAlign: 'center',
  },
  titleDark: {
    ...typography.h1,
    color: colors.neutral[900],
    textAlign: 'center',
  },
  pitchDark: {
    ...typography.body,
    color: colors.neutral[700],
    textAlign: 'center',
    paddingHorizontal: spacing.l,
  },
  pitch: {
    ...typography.body,
    fontFamily: fonts.bodyMedium,
    color: colors.primary[100],
    textAlign: 'center',
    paddingHorizontal: spacing.l,
  },
  benefits: {
    gap: spacing.m,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.s,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
  },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.s,
    backgroundColor: tints.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2.5,
    borderBottomColor: shade(tints.gold, -0.15),
  },
  benefitText: {
    ...typography.bodyMedium,
    color: colors.neutral[900],
    flexShrink: 1,
  },
  plans: {
    flexDirection: 'row',
    gap: spacing.m,
    marginTop: spacing.xl,
  },
  planCell: {
    flex: 1,
  },
  planCard: {
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.neutral[0],
    borderRadius: radii.l,
    borderWidth: 2.5,
    borderColor: colors.neutral[200],
    paddingVertical: spacing.l,
    paddingHorizontal: spacing.m,
    minHeight: 148,
    ...shadows.clayPressed,
  },
  planCardSelected: {
    borderColor: colors.xpGold,
    borderBottomWidth: 4,
    borderBottomColor: colors.goldDeep,
    backgroundColor: tints.gold,
    ...shadows.clayRaised,
  },
  planCheck: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    backgroundColor: colors.neutral[0],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  planCheckSelected: {
    borderColor: colors.goldDeep,
    backgroundColor: colors.xpGold,
  },
  ribbon: {
    position: 'absolute',
    top: -12,
    // successEdge, not successDeep: white on #16A34A is 3.3:1, and the ribbon
    // carries the single number that justifies the annual plan.
    backgroundColor: colors.successEdge,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
    ...shadows.clayPressed,
  },
  ribbonText: {
    ...typography.caption,
    fontFamily: fonts.bodyBold,
    color: colors.neutral[0],
  },
  planName: {
    ...typography.smallMedium,
    fontFamily: fonts.bodyBold,
    color: colors.neutral[700],
  },
  planPrice: {
    fontFamily: fonts.headingBlack,
    fontSize: 26,
    lineHeight: 32,
    color: colors.neutral[900],
    fontVariant: ['tabular-nums'],
  },
  planPeriod: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  trialPill: {
    backgroundColor: colors.neutral[0],
    borderWidth: 1.5,
    borderColor: colors.goldDeep,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
  },
  trialText: {
    ...typography.caption,
    fontFamily: fonts.bodyBold,
    color: tints.goldText,
  },
  premiumContent: {
    justifyContent: 'center',
  },
  premiumGroup: {
    gap: spacing.xl,
  },
  premiumActions: {
    marginTop: spacing.m,
  },
  statusCard: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusLine: {
    ...typography.bodyBold,
    color: colors.neutral[900],
  },
  statusSource: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  actions: {
    gap: spacing.m,
    marginTop: spacing.xl,
    paddingBottom: spacing.l,
  },
  restore: {
    alignSelf: 'center',
    // 12 + 12 + 20pt line box = 44pt, matching LoginScreen's linkRow. It was
    // spacing.xs, giving a 28pt target.
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.m,
  },
  restoreDisabled: {
    opacity: 0.5,
  },
  restoreText: {
    ...typography.smallMedium,
    color: colors.primary[600],
    textDecorationLine: 'underline',
  },
  ctaNote: {
    ...typography.caption,
    color: colors.neutral[700],
    textAlign: 'center',
    marginTop: -spacing.xs,
  },
  legal: {
    ...typography.caption,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  legalLink: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  legalLinkText: {
    ...typography.caption,
    color: colors.primary[600],
    textDecorationLine: 'underline',
  },
  legalDot: {
    ...typography.caption,
    color: colors.neutral[300],
  },
  skeleton: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.l,
    paddingTop: spacing.l,
  },
});

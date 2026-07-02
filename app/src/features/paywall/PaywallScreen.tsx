import { useRouter } from 'expo-router';
import {
  BarChart3,
  Brain,
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
  purchase,
  resolvePaywallMode,
  restore,
  type PlanId,
} from '@/features/paywall/entitlements';
import { formatDate } from '@/lib/format';
import { colors, radii, spacing, typography } from '@/theme/tokens';

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
  const router = useRouter();
  const entitlement = useEntitlement();

  const [plan, setPlan] = useState<PlanId>(DEFAULT_PLAN);
  const [comingSoon, setComingSoon] = useState(false);
  const [busy, setBusy] = useState(false);

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
        size={40}
        testID="paywall-close"
      >
        <X color={colors.neutral[700]} size={20} />
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
      <Screen edges={['top', 'left', 'right', 'bottom']} scroll>
        {close}
        <View style={styles.hero} testID="paywall-premium">
          <Mascot size={140} state="celebrate" />
          <View style={styles.crownRow}>
            <Crown color={colors.xpGold} fill={colors.xpGold} size={26} />
            <Text accessibilityRole="header" style={styles.title}>
              {t('premium.title')}
            </Text>
          </View>
          <Text style={styles.pitch}>{t('premium.body')}</Text>
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
        <View style={styles.actions}>
          <ClayButton
            fullWidth
            onPress={() => router.back()}
            size="l"
            title={tCommon('cta.continue')}
            variant="primary"
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} scroll>
      {close}

      {/* Hero */}
      <View style={styles.hero}>
        <View>
          <Mascot size={132} state="celebrate" />
          <View style={styles.heroCrown}>
            <Crown color={colors.xpGold} fill={colors.xpGold} size={30} />
          </View>
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          {t('title')}
        </Text>
        <Text style={styles.pitch}>{t('pitch')}</Text>
      </View>

      {/* Benefits */}
      <View style={styles.benefits}>
        {BENEFITS.map(({ key, Icon }) => (
          <View key={key} style={styles.benefitRow}>
            <View style={styles.benefitIcon}>
              <Icon color={colors.primary[600]} size={18} strokeWidth={2.2} />
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
        <ClayButton
          fullWidth
          loading={busy}
          onPress={() => void runPurchaseFlow(() => purchase(plan))}
          size="l"
          testID="paywall-cta"
          title={t('cta')}
          variant="gold"
        />
        <PressableScale
          accessibilityRole="button"
          clay={false}
          onPress={() => void runPurchaseFlow(restore)}
          pressedTranslateY={2}
          style={styles.restore}
          testID="paywall-restore"
        >
          <Text style={styles.restoreText}>{t('restore')}</Text>
        </PressableScale>
        <Text style={styles.legal}>{t('legal')}</Text>
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
  hero: {
    alignItems: 'center',
    gap: spacing.s,
    marginTop: spacing.s,
  },
  heroCrown: {
    position: 'absolute',
    top: -6,
    right: -10,
    transform: [{ rotate: '18deg' }],
  },
  crownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
  },
  title: {
    ...typography.h1,
    color: colors.neutral[900],
    textAlign: 'center',
  },
  pitch: {
    ...typography.body,
    color: colors.neutral[700],
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
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: 2,
    backgroundColor: colors.neutral[0],
    borderRadius: radii.l,
    borderWidth: 2.5,
    borderColor: colors.neutral[100],
    paddingVertical: spacing.l,
    paddingHorizontal: spacing.m,
    minHeight: 132,
  },
  planCardSelected: {
    borderColor: colors.xpGold,
    backgroundColor: colors.neutral[50],
  },
  ribbon: {
    position: 'absolute',
    top: -12,
    backgroundColor: colors.success,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    paddingVertical: 2,
  },
  ribbonText: {
    ...typography.caption,
    color: colors.neutral[0],
  },
  planName: {
    ...typography.smallMedium,
    color: colors.neutral[700],
    marginTop: spacing.xs,
  },
  planPrice: {
    ...typography.h1,
    color: colors.neutral[900],
  },
  planPeriod: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  trialPill: {
    backgroundColor: colors.primary[100],
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    paddingVertical: 2,
    marginTop: spacing.xs,
  },
  trialText: {
    ...typography.caption,
    color: colors.primary[700],
  },
  statusCard: {
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xl,
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
    marginTop: 'auto',
    gap: spacing.m,
    paddingTop: spacing.xl,
    paddingBottom: spacing.l,
  },
  restore: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.m,
  },
  restoreText: {
    ...typography.smallMedium,
    color: colors.primary[600],
  },
  legal: {
    ...typography.caption,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  skeleton: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.l,
    paddingTop: spacing.l,
  },
});

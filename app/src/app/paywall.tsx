import { useRouter } from 'expo-router';
import { Check, Crown, X } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ClayButton } from '@/components/clay/ClayButton';
import { ClayIconButton } from '@/components/clay/ClayIconButton';
import { Mascot } from '@/components/mascot/Mascot';
import { Screen } from '@/components/layout/Screen';
import { colors, spacing, typography } from '@/theme/tokens';

/**
 * Placeholder paywall (Phase 7 fills in entitlements/purchases).
 * Reached from premium-locked nodes, the hearts modal and 402 responses.
 */
export default function PaywallRoute() {
  const { t } = useTranslation('paywall');
  const { t: tCommon } = useTranslation('common');
  const router = useRouter();

  const features = [
    t('features.allUnits'),
    t('features.unlimitedHearts'),
    t('features.smartReview'),
    t('features.detailedStats'),
  ];

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} scroll>
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

      <View style={styles.hero}>
        <Mascot size={140} state="celebrate" />
        <View style={styles.crownRow}>
          <Crown color={colors.xpGold} fill={colors.xpGold} size={26} />
          <Text accessibilityRole="header" style={styles.title}>
            {t('title')}
          </Text>
        </View>
        <Text style={styles.pitch}>{t('pitch')}</Text>
      </View>

      <View style={styles.features}>
        {features.map((feature) => (
          <View key={feature} style={styles.featureRow}>
            <Check color={colors.success} size={20} strokeWidth={3} />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <ClayButton
          disabled
          fullWidth
          size="l"
          title={tCommon('cta.comingSoon')}
          variant="gold"
        />
        <Text style={styles.priceNote}>{t('priceNote')}</Text>
      </View>
    </Screen>
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
  features: {
    gap: spacing.m,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.s,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
  },
  featureText: {
    ...typography.bodyMedium,
    color: colors.neutral[900],
    flexShrink: 1,
  },
  actions: {
    marginTop: 'auto',
    gap: spacing.m,
    paddingTop: spacing.xl,
    paddingBottom: spacing.l,
  },
  priceNote: {
    ...typography.small,
    color: colors.neutral[500],
    textAlign: 'center',
  },
});

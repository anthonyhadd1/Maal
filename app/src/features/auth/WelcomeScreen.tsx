import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Flame, Map, Trophy, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ClayButton } from '@/components/clay/ClayButton';
import { Mascot } from '@/components/mascot/Mascot';
import { colors, gradients, overlayLight, radii, spacing, typography } from '@/theme/tokens';

export function WelcomeScreen() {
  const { t } = useTranslation('auth');
  const router = useRouter();

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={gradients.brand}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Soft floating blobs */}
      <View pointerEvents="none" style={[styles.blob, styles.blobA]} />
      <View pointerEvents="none" style={[styles.blob, styles.blobB]} />
      <View pointerEvents="none" style={[styles.blob, styles.blobC]} />

      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safe}>
        <View style={styles.hero}>
          <Mascot size={190} state="idle" />
          <Text accessibilityRole="header" style={styles.wordmark}>
            {t('welcome.title')}
          </Text>
          <Text style={styles.tagline}>{t('welcome.tagline')}</Text>

          <View style={styles.chips}>
            <FeatureChip Icon={Map} label={t('welcome.featureLevels')} />
            <FeatureChip Icon={Flame} label={t('welcome.featureStreaks')} />
            <FeatureChip Icon={Trophy} label={t('welcome.featureLeagues')} />
          </View>
        </View>

        <View style={styles.actions}>
          <ClayButton
            fullWidth
            onPress={() => router.push('/register')}
            size="l"
            title={t('welcome.start')}
            variant="inverted"
          />
          <ClayButton
            fullWidth
            onPress={() => router.push('/login')}
            size="l"
            title={t('welcome.haveAccount')}
            variant="ghost"
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

function FeatureChip({ Icon, label }: { Icon: LucideIcon; label: string }) {
  return (
    <View style={styles.chip}>
      <Icon color={colors.neutral[0]} size={16} strokeWidth={2.4} />
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.primary[600],
  },
  safe: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  blob: {
    position: 'absolute',
    borderRadius: radii.pill,
    backgroundColor: colors.neutral[0],
  },
  blobA: {
    width: 260,
    height: 260,
    top: -90,
    right: -80,
    opacity: 0.1,
  },
  blobB: {
    width: 180,
    height: 180,
    top: '38%',
    left: -90,
    opacity: 0.08,
  },
  blobC: {
    width: 320,
    height: 320,
    bottom: -140,
    right: -110,
    opacity: 0.07,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s,
  },
  wordmark: {
    ...typography.display,
    fontSize: 64,
    lineHeight: 72,
    color: colors.neutral[0],
    letterSpacing: -1.5,
    marginTop: spacing.s,
  },
  tagline: {
    ...typography.h2,
    color: colors.neutral[0],
    textAlign: 'center',
    opacity: 0.95,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.s,
    marginTop: spacing.l,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: overlayLight,
    borderRadius: radii.pill,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.m + 2,
  },
  chipLabel: {
    ...typography.smallMedium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.neutral[0],
  },
  actions: {
    gap: spacing.m,
    paddingBottom: spacing.l,
  },
});

import { useRouter } from 'expo-router';
import { Flame, Rocket, Sprout, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { usePatchMe } from '@/api/queries/profile';
import { ClaySurface } from '@/components/clay/ClaySurface';
import { useToast } from '@/components/feedback/Toast';
import { PressableScale } from '@/components/layout/PressableScale';
import { OnboardingStep } from '@/features/onboarding/OnboardingStep';
import {
  onboardingPrevious,
  onboardingProgress,
} from '@/features/onboarding/onboardingProgress';
import { shade } from '@/lib/color';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, radii, spacing, typography } from '@/theme/tokens';

interface RhythmOption {
  key: 'casual' | 'serious' | 'intense';
  xp: number;
  Icon: LucideIcon;
}

const OPTIONS: RhythmOption[] = [
  { key: 'casual', xp: 20, Icon: Sprout },
  { key: 'serious', xp: 40, Icon: Flame },
  { key: 'intense', xp: 60, Icon: Rocket },
];

export const DEFAULT_DAILY_GOAL_XP = 40;

/**
 * Onboarding 2/3 « Rythme quotidien » — Tranquille 20 / Sérieux·se 40 /
 * Intensif 60 (default 40) → PATCH daily_goal_xp. NOT skippable (§10).
 */
export function RhythmScreen() {
  const { t } = useTranslation('onboarding');
  const { t: tErrors } = useTranslation('errors');
  const router = useRouter();
  const toast = useToast();
  const patchMe = usePatchMe();
  const activeTrackSlug = useSettingsStore((s) => s.activeTrackSlug);
  const { step, totalSteps } = onboardingProgress('rhythm');
  const previous = onboardingPrevious('rhythm');

  const [goalXp, setGoalXp] = useState(DEFAULT_DAILY_GOAL_XP);

  const submit = () => {
    if (patchMe.isPending) return;
    patchMe.mutate(
      { profile: { daily_goal_xp: goalXp } },
      {
        // replace (not push): see TrackScreen's onSuccess comment.
        onSuccess: () => router.replace('/onboarding/notifications'),
        onError: () => toast.show({ type: 'error', message: tErrors('server') }),
      },
    );
  };

  return (
    <OnboardingStep
      cta={{ label: t('continue'), onPress: submit, loading: patchMe.isPending }}
      onBack={previous ? () => router.replace(`/onboarding/${previous}`) : undefined}
      mascot="thinking"
      step={step}
      subtitle={t('rhythm.subtitle')}
      title={t('rhythm.title')}
      totalSteps={totalSteps}
    >
      <View style={styles.list}>
        {OPTIONS.map(({ key, xp, Icon }) => {
          const selected = goalXp === xp;
          return (
            <PressableScale
              accessibilityRole="button"
              accessibilityState={{ selected }}
              clay={false}
              key={key}
              onPress={() => setGoalXp(xp)}
              style={styles.cardWrap}
              testID={`rhythm-${key}`}
            >
              <ClaySurface
                radius="l"
                shadow={selected ? 'raised' : 'pressed'}
                style={[styles.card, selected && styles.cardSelected]}
              >
                <View style={[styles.cardIcon, selected && styles.cardIconSelected]}>
                  <Icon
                    color={selected ? colors.neutral[0] : colors.primary[600]}
                    size={22}
                    strokeWidth={2.2}
                  />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardLabel}>{t(`rhythm.${key}`)}</Text>
                  <Text style={styles.cardDesc}>{t(`rhythm.${key}Desc`)}</Text>
                </View>
                <Text style={[styles.cardXp, selected && styles.cardXpSelected]}>
                  {t('rhythm.xpPerDay', { xp })}
                </Text>
              </ClaySurface>
            </PressableScale>
          );
        })}
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.m,
  },
  cardWrap: {
    alignSelf: 'stretch',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.l,
  },
  cardSelected: {
    borderColor: colors.primary[500],
    borderBottomColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconSelected: {
    backgroundColor: colors.primary[500],
    borderBottomWidth: 3,
    borderBottomColor: shade(colors.primary[500], -0.28),
  },
  cardBody: {
    flex: 1,
    gap: spacing.xs,
  },
  cardLabel: {
    ...typography.bodyMedium,
    color: colors.neutral[900],
  },
  cardDesc: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  cardXp: {
    ...typography.smallMedium,
    color: colors.neutral[500],
    fontVariant: ['tabular-nums'],
  },
  cardXpSelected: {
    color: colors.primary[600],
    fontFamily: typography.bodyBold.fontFamily,
  },
});

import { useRouter } from 'expo-router';
import { Flame, Rocket, Sprout, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { usePatchMe } from '@/api/queries/profile';
import { useToast } from '@/components/feedback/Toast';
import { PressableScale } from '@/components/layout/PressableScale';
import { OnboardingStep } from '@/features/onboarding/OnboardingStep';
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

  const [goalXp, setGoalXp] = useState(DEFAULT_DAILY_GOAL_XP);

  const submit = () => {
    if (patchMe.isPending) return;
    patchMe.mutate(
      { profile: { daily_goal_xp: goalXp } },
      {
        onSuccess: () => router.push('/onboarding/notifications'),
        onError: () => toast.show({ type: 'error', message: tErrors('server') }),
      },
    );
  };

  return (
    <OnboardingStep
      cta={{ label: t('continue'), onPress: submit, loading: patchMe.isPending }}
      step={1}
      subtitle={t('rhythm.subtitle')}
      title={t('rhythm.title')}
    >
      <View style={styles.list}>
        {OPTIONS.map(({ key, xp, Icon }) => {
          const selected = goalXp === xp;
          return (
            <PressableScale
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={key}
              onPress={() => setGoalXp(xp)}
              style={styles.cardWrap}
              testID={`rhythm-${key}`}
            >
              <View style={[styles.card, selected && styles.cardSelected]}>
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
              </View>
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
    backgroundColor: colors.neutral[0],
    borderRadius: radii.l,
    borderWidth: 2.5,
    borderColor: 'transparent',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.l,
  },
  cardSelected: {
    borderColor: colors.primary[500],
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
  },
  cardBody: {
    flex: 1,
    gap: 1,
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
  },
  cardXpSelected: {
    color: colors.primary[600],
  },
});

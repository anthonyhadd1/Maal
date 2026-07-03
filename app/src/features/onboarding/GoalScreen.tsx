import { useRouter } from 'expo-router';
import { Check, GraduationCap, HelpCircle } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useFaculties, usePatchMe } from '@/api/queries/profile';
import { ClaySurface } from '@/components/clay/ClaySurface';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { useToast } from '@/components/feedback/Toast';
import { PressableScale } from '@/components/layout/PressableScale';
import { OnboardingStep } from '@/features/onboarding/OnboardingStep';
import { shade } from '@/lib/color';
import { colors, radii, spacing, typography } from '@/theme/tokens';

/** null = « Je ne sais pas encore » (explicit choice) — undefined = untouched. */
type Selection = number | null | undefined;

/** Onboarding 1/3 « Tu vises quoi ? » — faculty cards → PATCH target_faculty. */
export function GoalScreen() {
  const { t } = useTranslation('onboarding');
  const { t: tErrors } = useTranslation('errors');
  const router = useRouter();
  const toast = useToast();
  const faculties = useFaculties();
  const patchMe = usePatchMe();

  const [selection, setSelection] = useState<Selection>(undefined);

  // replace (not push): see TrackScreen's onSuccess comment — onboarding is
  // linear/one-way, and pushing leaves this screen mounted under the next
  // one, where its content can still intercept taps on web.
  const next = () => router.replace('/onboarding/rhythm');

  const submit = () => {
    if (selection === undefined || patchMe.isPending) return;
    patchMe.mutate(
      { profile: { target_faculty: selection } },
      {
        onSuccess: next,
        onError: () => toast.show({ type: 'error', message: tErrors('server') }),
      },
    );
  };

  return (
    <OnboardingStep
      cta={{
        label: t('continue'),
        onPress: submit,
        disabled: selection === undefined,
        loading: patchMe.isPending,
      }}
      mascot="idle"
      onSkip={next}
      step={1}
      subtitle={t('goal.subtitle')}
      title={t('goal.title')}
    >
      {faculties.isPending ? (
        <View style={styles.list} testID="faculties-skeleton">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton height={64} key={i} radius={radii.l} width="100%" />
          ))}
        </View>
      ) : faculties.isError ? (
        <ErrorState onRetry={() => void faculties.refetch()} retrying={faculties.isRefetching} />
      ) : (
        <View style={styles.list}>
          {faculties.data.map((faculty) => (
            <GoalCard
              icon={<GraduationCap color={colors.primary[600]} size={22} strokeWidth={2.2} />}
              key={faculty.id}
              label={faculty.name}
              onPress={() => setSelection(faculty.id)}
              selected={selection === faculty.id}
              testID={`faculty-${faculty.slug}`}
            />
          ))}
          <GoalCard
            icon={<HelpCircle color={colors.neutral[500]} size={22} strokeWidth={2.2} />}
            label={t('goal.unknown')}
            onPress={() => setSelection(null)}
            selected={selection === null}
            testID="faculty-unknown"
          />
        </View>
      )}
    </OnboardingStep>
  );
}

function GoalCard({
  label,
  icon,
  selected,
  onPress,
  testID,
}: {
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      clay={false}
      onPress={onPress}
      style={styles.cardWrap}
      testID={testID}
    >
      <ClaySurface
        radius="l"
        shadow={selected ? 'raised' : 'pressed'}
        style={[styles.card, selected && styles.cardSelected]}
      >
        <View style={[styles.cardIcon, selected && styles.cardIconSelected]}>{icon}</View>
        <Text style={[styles.cardLabel, selected && styles.cardLabelSelected]}>{label}</Text>
        <View style={[styles.check, selected && styles.checkSelected]}>
          {selected ? <Check color={colors.neutral[0]} size={14} strokeWidth={3.5} /> : null}
        </View>
      </ClaySurface>
    </PressableScale>
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
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconSelected: {
    backgroundColor: colors.primary[100],
    borderBottomWidth: 3,
    borderBottomColor: shade(colors.primary[100], -0.15),
  },
  cardLabel: {
    ...typography.bodyMedium,
    color: colors.neutral[900],
    flex: 1,
  },
  cardLabelSelected: {
    fontFamily: typography.bodyBold.fontFamily,
    color: colors.primary[700],
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    backgroundColor: colors.neutral[0],
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkSelected: {
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[500],
  },
});

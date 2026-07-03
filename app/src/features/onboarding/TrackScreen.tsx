import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { usePatchMe } from '@/api/queries/profile';
import { useTracks } from '@/api/queries/tracks';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { useToast } from '@/components/feedback/Toast';
import { OnboardingStep } from '@/features/onboarding/OnboardingStep';
import { TrackCard } from '@/features/track/TrackCard';
import { useSettingsStore } from '@/stores/settingsStore';
import { radii, spacing } from '@/theme/tokens';

/**
 * Onboarding 1/4 « Que prépares-tu ? » — track cards (shared TrackCard) →
 * PATCH active_track, then routes to `goal` (concours — faculty question
 * still applies) or SKIPS straight to `rhythm` (specialite — already in med
 * school, target_faculty doesn't apply).
 */
export function TrackScreen() {
  const { t } = useTranslation('onboarding');
  const { t: tErrors } = useTranslation('errors');
  const router = useRouter();
  const toast = useToast();
  const tracks = useTracks();
  const patchMe = usePatchMe();
  const setActiveTrackSlug = useSettingsStore((s) => s.setActiveTrackSlug);

  const [selectedSlug, setSelectedSlug] = useState<string | undefined>(undefined);

  const submit = () => {
    const track = tracks.data?.find((t) => t.slug === selectedSlug);
    if (!track || patchMe.isPending) return;
    setActiveTrackSlug(track.slug);
    patchMe.mutate(
      { profile: { active_track: track.slug } },
      {
        onSuccess: () => {
          router.push(track.slug === 'concours' ? '/onboarding/goal' : '/onboarding/rhythm');
        },
        onError: () => toast.show({ type: 'error', message: tErrors('server') }),
      },
    );
  };

  return (
    <OnboardingStep
      cta={{
        label: t('continue'),
        onPress: submit,
        disabled: selectedSlug === undefined,
        loading: patchMe.isPending,
      }}
      mascot="idle"
      step={0}
      subtitle={t('track.subtitle')}
      title={t('track.title')}
    >
      {tracks.isPending ? (
        <View style={styles.list} testID="tracks-skeleton">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton height={220} key={i} radius={radii.xl} width="100%" />
          ))}
        </View>
      ) : tracks.isError ? (
        <ErrorState onRetry={() => void tracks.refetch()} retrying={tracks.isRefetching} />
      ) : (
        <View style={styles.list}>
          {tracks.data.map((track) => (
            <TrackCard
              key={track.slug}
              onPress={() => setSelectedSlug(track.slug)}
              selected={track.slug === selectedSlug}
              testID={`onboarding-track-${track.slug}`}
              track={track}
            />
          ))}
        </View>
      )}
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.m,
  },
});

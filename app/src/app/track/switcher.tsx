import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { keys } from '@/api/queries/keys';
import { firstSubjectSlug } from '@/api/queries/subjectsHelpers';
import { useTracks } from '@/api/queries/tracks';
import { queryClient } from '@/api/queryClient';
import type { SubjectsResponse, Track } from '@/api/types';
import { ClayIconButton } from '@/components/clay/ClayIconButton';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { TrackCard } from '@/features/track/TrackCard';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, radii, spacing, typography } from '@/theme/tokens';

/**
 * formSheet modal: pick the active exam Track (« Concours d'entrée » /
 * « Examens de Spécialité ») — a flagship "different world" moment, each
 * card washed in its own track color (design_mobile.md §4a extension).
 */
export default function TrackSwitcherRoute() {
  const { t } = useTranslation('map');
  const router = useRouter();
  const tracks = useTracks();
  const activeTrackSlug = useSettingsStore((s) => s.activeTrackSlug);
  const setActiveTrackSlug = useSettingsStore((s) => s.setActiveTrackSlug);
  const setActiveSubjectSlug = useSettingsStore((s) => s.setActiveSubjectSlug);

  const select = async (track: Track) => {
    if (track.slug === activeTrackSlug) {
      router.back();
      return;
    }
    setActiveTrackSlug(track.slug);

    // Pick a sensible default subject for the newly-selected track.
    try {
      const data = await queryClient.fetchQuery({
        queryKey: keys.subjects(track.slug),
        queryFn: async () =>
          (
            await api.get<SubjectsResponse>(ENDPOINTS.subjects, {
              params: { track: track.slug },
            })
          ).data,
      });
      const slug = firstSubjectSlug(data);
      if (slug) setActiveSubjectSlug(slug);
    } catch {
      // Non-fatal — the map screen will fall back to whatever it can resolve.
    }

    // Persist the choice server-side, non-blocking (fire-and-forget).
    void api
      .patch(ENDPOINTS.me, { profile: { active_track: track.slug } })
      .then(() => queryClient.invalidateQueries({ queryKey: keys.me }))
      .catch(() => {});

    router.back();
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {t('trackSwitcher.title')}
        </Text>
        <ClayIconButton
          accessibilityLabel={t('switcher.close')}
          onPress={() => router.back()}
          size={44}
        >
          <X color={colors.neutral[700]} size={20} />
        </ClayIconButton>
      </View>

      {tracks.isPending ? (
        <View style={styles.list}>
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
              onPress={() => void select(track)}
              selected={track.slug === activeTrackSlug}
              testID={`track-card-${track.slug}`}
              track={track}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.neutral[50],
    paddingTop: spacing.l,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.l,
    marginBottom: spacing.l,
  },
  title: {
    ...typography.h1,
    fontFamily: typography.display.fontFamily,
    color: colors.neutral[900],
  },
  list: {
    gap: spacing.l,
    paddingHorizontal: spacing.l,
    paddingBottom: spacing.xxl,
  },
});

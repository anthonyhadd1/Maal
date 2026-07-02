import { useNetworkState } from 'expo-network';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { parseApiError } from '@/api/errors';
import { useMeGame } from '@/api/queries/game';
import { keys } from '@/api/queries/keys';
import { useSubjectMap } from '@/api/queries/map';
import { useAbandonAttempt, useStartAttempt } from '@/api/queries/session';
import { useSubjects } from '@/api/queries/subjects';
import { queryClient } from '@/api/queryClient';
import type { MapLevel } from '@/api/types';
import { ClayDialog } from '@/components/feedback/ClayDialog';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { useToast } from '@/components/feedback/Toast';
import { Screen } from '@/components/layout/Screen';
import { HeartsModal } from '@/features/map/HeartsModal';
import { LevelNode, NODE_SIZE } from '@/features/map/LevelNode';
import { MapConnector } from '@/features/map/MapConnector';
import { UnitHeader } from '@/features/map/UnitHeader';
import {
  ROW_HEIGHT,
  useMapLayout,
  type MapRow,
  type NodeRow,
} from '@/features/map/useMapLayout';
import { MapHeader } from '@/features/map/MapHeader';
import { isSessionResumable, useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { getSubjectAccent, spacing } from '@/theme/tokens';

/** TAB 1 « Apprendre » — the levels map (design_mobile.md §4a). */
export function LevelsMap() {
  const { t } = useTranslation('map');
  const { t: tErrors } = useTranslation('errors');
  const router = useRouter();
  const toast = useToast();
  const networkState = useNetworkState();
  const { width, height } = useWindowDimensions();

  const storedSlug = useSettingsStore((s) => s.activeSubjectSlug);
  const setActiveSubjectSlug = useSettingsStore((s) => s.setActiveSubjectSlug);

  const subjects = useSubjects();
  const activeSlug = storedSlug ?? subjects.data?.[0]?.slug ?? null;

  // Persist the defaulted subject so the switcher highlights it consistently.
  useEffect(() => {
    if (!storedSlug && activeSlug) setActiveSubjectSlug(activeSlug);
  }, [storedSlug, activeSlug, setActiveSubjectSlug]);

  const map = useSubjectMap(activeSlug);
  const game = useMeGame();
  const layout = useMapLayout(map.data?.units, width);
  const startAttempt = useStartAttempt();
  const abandonAttempt = useAbandonAttempt();

  const accent = getSubjectAccent(activeSlug ?? '', map.data?.subject.color_hex);
  const subjectName = map.data?.subject.name ?? subjects.data?.[0]?.name ?? t('title');

  const [heartsModalVisible, setHeartsModalVisible] = useState(false);
  const [resumeVisible, setResumeVisible] = useState(false);
  const [conflict, setConflict] = useState<{ level: MapLevel; attemptId: number | null } | null>(
    null,
  );

  // --- initial scroll to the current node --------------------------------
  const listRef = useRef<FlatList<MapRow>>(null);
  const scrolledForSlug = useRef<string | null>(null);
  useEffect(() => {
    if (!map.data || layout.currentRowIndex < 0 || !activeSlug) return;
    if (scrolledForSlug.current === activeSlug) return;
    scrolledForSlug.current = activeSlug;
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({
        index: layout.currentRowIndex,
        viewPosition: 0.5,
        animated: false,
      });
    });
  }, [map.data, layout.currentRowIndex, activeSlug]);

  // --- crash recovery (design_mobile.md §10) ------------------------------
  const sessionHydrated = useSessionStore((s) => s.hasHydrated);
  const recoveryChecked = useRef(false);
  useEffect(() => {
    if (!sessionHydrated || recoveryChecked.current) return;
    recoveryChecked.current = true;
    const session = useSessionStore.getState();
    if (session.status === 'completed') {
      session.reset();
      return;
    }
    if (session.status !== 'inProgress' || session.attemptId == null) return;
    if (isSessionResumable(session)) {
      setResumeVisible(true);
    } else {
      // Expired (>30 min): abandon server-side, clear silently.
      abandonAttempt.mutate(session.attemptId);
      session.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionHydrated]);

  // --- level start --------------------------------------------------------
  const launchSession = useCallback(
    (levelId: number) => {
      router.push({ pathname: '/session/[levelId]', params: { levelId: String(levelId) } });
    },
    [router],
  );

  const startLevel = useCallback(
    (level: MapLevel) => {
      if (startAttempt.isPending) return;
      // Sessions are server-graded — no offline play (design_mobile.md §5).
      if (
        networkState.isConnected === false ||
        networkState.isInternetReachable === false
      ) {
        toast.show({ type: 'info', message: t('offlinePlay') });
        return;
      }
      const g = game.data;
      if (g && !g.hearts_unlimited && g.hearts <= 0) {
        setHeartsModalVisible(true);
        return;
      }
      startAttempt.mutate(level.id, {
        onSuccess: (data) => {
          useSessionStore.getState().startSession({
            attemptId: data.attempt_id,
            levelId: level.id,
            questions: data.questions,
          });
          launchSession(level.id);
        },
        onError: (error) => {
          const info = parseApiError(error);
          if (info.code === 'premium_required' || info.status === 402) {
            router.push('/paywall');
            return;
          }
          if (info.code === 'out_of_hearts') {
            setHeartsModalVisible(true);
            return;
          }
          if (info.code === 'attempt_in_progress') {
            setConflict({ level, attemptId: info.attemptId });
            return;
          }
          toast.show({ type: 'error', message: info.detail ?? tErrors('server') });
        },
      });
    },
    [startAttempt, game.data, launchSession, router, toast, tErrors, networkState, t],
  );

  const onLockedPress = useCallback(() => {
    toast.show({ type: 'info', message: t('lockedToast') });
  }, [toast, t]);

  const onPremiumPress = useCallback(() => {
    router.push('/paywall');
  }, [router]);

  // --- resume / conflict dialog handlers ----------------------------------
  const resumeSession = () => {
    setResumeVisible(false);
    setConflict(null);
    const session = useSessionStore.getState();
    if (session.challengeId != null) {
      // Challenge attempts resume through the challenge entry route so the
      // engine matches the persisted start source (Phase 7).
      router.push({
        pathname: '/session/challenge/[challengeId]',
        params: { challengeId: String(session.challengeId) },
      });
    } else if (session.levelId != null) {
      launchSession(session.levelId);
    }
  };

  const abandonAndReset = (thenStart?: MapLevel) => {
    const session = useSessionStore.getState();
    const attemptId = conflict?.attemptId ?? session.attemptId;
    setResumeVisible(false);
    setConflict(null);
    if (attemptId != null) {
      abandonAttempt.mutate(attemptId, {
        onSettled: () => {
          if (thenStart) startLevel(thenStart);
        },
      });
    } else if (thenStart) {
      startLevel(thenStart);
    }
    session.reset();
  };

  const conflictMatchesStore =
    conflict?.attemptId != null && useSessionStore.getState().attemptId === conflict.attemptId;

  // --- render --------------------------------------------------------------
  const renderItem = useCallback(
    ({ item }: { item: MapRow }) => {
      if (item.type === 'unitHeader') {
        return <UnitHeader accent={accent} done={item.done} total={item.total} unit={item.unit} />;
      }
      const node = item as NodeRow;
      const isCurrent =
        layout.currentRowIndex >= 0 && layout.rows[layout.currentRowIndex]?.key === node.key;
      return (
        <View style={styles.nodeRow}>
          {node.prevGlobalIndex != null && node.prevLevel ? (
            <MapConnector
              accent={accent}
              fromX={layout.xFor(node.prevGlobalIndex)}
              level={node.level}
              prevLevel={node.prevLevel}
              rowWidth={width}
              toX={layout.xFor(node.globalIndex)}
            />
          ) : null}
          <LevelNode
            accent={accent}
            isCurrent={isCurrent}
            level={node.level}
            onLocked={onLockedPress}
            onPremium={onPremiumPress}
            onStart={startLevel}
            rowWidth={width}
            x={layout.xFor(node.globalIndex)}
          />
        </View>
      );
    },
    [accent, layout, width, onLockedPress, onPremiumPress, startLevel],
  );

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.map(activeSlug ?? '_none') }),
      queryClient.invalidateQueries({ queryKey: keys.game }),
    ]);
  }, [activeSlug]);

  const isLoading = subjects.isPending || (map.isPending && !!activeSlug);

  return (
    <Screen edges={['top', 'left', 'right']} padded={false}>
      <MapHeader
        accent={accent}
        game={game.data}
        onSwitchSubject={() => router.push('/subject/switcher')}
        subjectName={subjectName}
      />

      {isLoading ? (
        <MapSkeleton width={width} />
      ) : map.isError || subjects.isError ? (
        <ErrorState
          onRetry={() => {
            void subjects.refetch();
            void map.refetch();
          }}
          retrying={map.isRefetching || subjects.isRefetching}
        />
      ) : layout.rows.length === 0 ? (
        <EmptyState mascotState="idle" message={t('empty.message')} title={t('empty.title')} />
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={layout.rows}
          getItemLayout={layout.getItemLayout}
          initialNumToRender={10}
          keyExtractor={(item) => item.key}
          onScrollToIndexFailed={(info) => {
            // Offsets are exact — fall back to a direct offset scroll.
            const { offset } = layout.getItemLayout(null, info.index);
            listRef.current?.scrollToOffset({
              offset: Math.max(0, offset - height / 2 + ROW_HEIGHT / 2),
              animated: false,
            });
          }}
          ref={listRef}
          refreshControl={
            <RefreshControl
              colors={[accent]}
              onRefresh={refresh}
              refreshing={map.isRefetching}
              tintColor={accent}
            />
          }
          removeClippedSubviews={false}
          renderItem={renderItem}
          testID="levels-map-list"
        />
      )}

      <HeartsModal
        nextHeartAt={game.data?.next_heart_at ?? null}
        onClose={() => setHeartsModalVisible(false)}
        onGoPremium={() => {
          setHeartsModalVisible(false);
          router.push('/paywall');
        }}
        onGoReview={() => {
          setHeartsModalVisible(false);
          router.push('/quests');
        }}
        visible={heartsModalVisible}
      />

      {/* Crash recovery: resume the persisted in-progress attempt. */}
      <ClayDialog
        actions={[
          { label: t('resume.resume'), onPress: resumeSession, variant: 'primary' },
          {
            label: t('resume.abandon'),
            onPress: () => abandonAndReset(),
            variant: 'secondary',
          },
        ]}
        mascotState="thinking"
        message={t('resume.body')}
        title={t('resume.title')}
        visible={resumeVisible}
      />

      {/* 409 attempt_in_progress on start. */}
      <ClayDialog
        actions={
          conflictMatchesStore
            ? [
                { label: t('resume.resume'), onPress: resumeSession, variant: 'primary' },
                {
                  label: t('resume.abandonRestart'),
                  onPress: () => abandonAndReset(conflict?.level),
                  variant: 'secondary',
                },
              ]
            : [
                {
                  label: t('resume.abandonRestart'),
                  onPress: () => abandonAndReset(conflict?.level),
                  variant: 'primary',
                },
                {
                  label: t('resume.cancel'),
                  onPress: () => setConflict(null),
                  variant: 'secondary',
                },
              ]
        }
        mascotState="thinking"
        message={t('resume.conflictBody')}
        onRequestClose={() => setConflict(null)}
        title={t('resume.title')}
        visible={conflict != null}
      />
    </Screen>
  );
}

/** Loading placeholder: a column of node-sized circles on the wave. */
function MapSkeleton({ width }: { width: number }) {
  const centerX = width / 2;
  return (
    <View style={styles.skeletonWrap} testID="map-skeleton">
      <Skeleton height={52} radius={20} width="88%" />
      {Array.from({ length: 5 }, (_, i) => {
        const x = centerX + Math.sin(i * 0.9) * width * 0.22;
        return (
          <View key={i} style={{ transform: [{ translateX: x - centerX }] }}>
            <Skeleton height={NODE_SIZE} radius={NODE_SIZE / 2} width={NODE_SIZE} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nodeRow: {
    height: ROW_HEIGHT,
    overflow: 'visible',
  },
  listContent: {
    paddingVertical: spacing.xl,
  },
  skeletonWrap: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xl,
    paddingTop: spacing.xl,
  },
});

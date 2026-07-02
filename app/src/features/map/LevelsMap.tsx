import { LinearGradient } from 'expo-linear-gradient';
import { useNetworkState } from 'expo-network';
import { useRouter } from 'expo-router';
import { Crown } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
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
import { LevelNode, NODE_SIZE, offersLegendary } from '@/features/map/LevelNode';
import { MapConnector } from '@/features/map/MapConnector';
import { MapMilestone } from '@/features/map/MapMilestone';
import { RowScenery } from '@/features/map/MapScenery';
import { UnitHeader } from '@/features/map/UnitHeader';
import {
  ROW_HEIGHT,
  useMapLayout,
  type MapRow,
  type NodeRow,
} from '@/features/map/useMapLayout';
import { MapHeader } from '@/features/map/MapHeader';
import { withAlpha } from '@/lib/color';
import { useReducedMotionPref } from '@/lib/motion';
import { isSessionResumable, useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, getSubjectAccent, spacing } from '@/theme/tokens';

/**
 * Zone ambience: each unit section washes the backdrop towards the subject
 * accent at a slightly different (barely-perceptible) strength, so units
 * read as REGIONS of the world rather than segments of a list.
 */
const ZONE_TINT_ALPHAS = [0.018, 0.032, 0.045] as const;

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
  /** 3-star node pressed → offer the legendary run (PLAN decision 9). */
  const [legendaryPrompt, setLegendaryPrompt] = useState<MapLevel | null>(null);

  // --- scroll parallax (backdrop layers move slower than the rows) --------
  const scrollY = useSharedValue(0);
  const onScrollWorklet = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  // Reanimated's scroll worklet never fires on web — plain handler there.
  const onScrollJs = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.value = event.nativeEvent.contentOffset.y;
    },
    [scrollY],
  );
  const onScroll = Platform.OS === 'web' ? onScrollJs : onScrollWorklet;
  // Reanimated's Animated.FlatList breaks the web scroll container (the host
  // grows to its content instead of clipping), so web keeps the plain
  // FlatList — the JS handler above feeds the same shared value.
  const List = (Platform.OS === 'web' ? FlatList : Animated.FlatList) as typeof FlatList<MapRow>;

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
    (level: MapLevel, options: { legendary?: boolean } = {}) => {
      const legendary = options.legendary ?? false;
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
      startAttempt.mutate(legendary ? { levelId: level.id, legendary: true } : level.id, {
        onSuccess: (data) => {
          useSessionStore.getState().startSession({
            attemptId: data.attempt_id,
            levelId: level.id,
            questions: data.questions,
            legendary,
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
          if (info.code === 'legendary_locked') {
            toast.show({ type: 'error', message: t('legendaryLocked') });
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

  /** Node press: 3-star completed levels get the legendary offer first. */
  const onNodeStart = useCallback(
    (level: MapLevel) => {
      if (offersLegendary(level)) {
        setLegendaryPrompt(level);
        return;
      }
      startLevel(level);
    },
    [startLevel],
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
      const zoneTint = withAlpha(accent, ZONE_TINT_ALPHAS[item.unitIndex % ZONE_TINT_ALPHAS.length]);
      if (item.type === 'unitHeader') {
        return (
          <View style={{ backgroundColor: zoneTint }}>
            <UnitHeader accent={accent} done={item.done} total={item.total} unit={item.unit} />
          </View>
        );
      }
      const node = item as NodeRow;
      const isCurrent =
        layout.currentRowIndex >= 0 && layout.rows[layout.currentRowIndex]?.key === node.key;
      const nodeX = layout.xFor(node.globalIndex);
      return (
        <View style={[styles.nodeRow, { backgroundColor: zoneTint }]}>
          {/* World scenery in the empty side of the curve (milestone rows breathe). */}
          {node.isUnitLast ? (
            <MapMilestone
              accent={accent}
              isBoss={!!node.level.is_boss}
              nodeX={nodeX}
              rowWidth={width}
              unitCompleted={node.unitTotal > 0 && node.unitDone >= node.unitTotal}
            />
          ) : (
            <RowScenery
              accent={accent}
              globalIndex={node.globalIndex}
              nodeX={nodeX}
              rowWidth={width}
              slug={activeSlug ?? ''}
            />
          )}
          {node.prevGlobalIndex != null && node.prevLevel ? (
            <MapConnector
              accent={accent}
              fromX={layout.xFor(node.prevGlobalIndex)}
              level={node.level}
              prevLevel={node.prevLevel}
              rowWidth={width}
              toX={nodeX}
            />
          ) : null}
          <LevelNode
            accent={accent}
            isCurrent={isCurrent}
            level={node.level}
            onLocked={onLockedPress}
            onPremium={onPremiumPress}
            onStart={onNodeStart}
            rowWidth={width}
            x={nodeX}
          />
        </View>
      );
    },
    [accent, layout, width, onLockedPress, onPremiumPress, onNodeStart, activeSlug],
  );

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.map(activeSlug ?? '_none') }),
      queryClient.invalidateQueries({ queryKey: keys.game }),
    ]);
  }, [activeSlug]);

  const isLoading = subjects.isPending || (map.isPending && !!activeSlug);

  return (
    <Screen contentStyle={styles.screenContent} edges={['top', 'left', 'right']} padded={false}>
      <MapBackdrop accent={accent} scrollY={scrollY} />
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
        <List
          contentContainerStyle={styles.listContent}
          data={layout.rows}
          getItemLayout={layout.getItemLayout}
          initialNumToRender={10}
          keyExtractor={(item) => item.key}
          onScroll={onScroll}
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
          scrollEventThrottle={16}
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

      {/* Legendary offer on a 3-star node (gameplay §1.5): gold crown rules. */}
      <ClayDialog
        actions={[
          {
            label: t('legendaryDialog.start'),
            onPress: () => {
              const level = legendaryPrompt;
              setLegendaryPrompt(null);
              if (level) startLevel(level, { legendary: true });
            },
            variant: 'gold',
            testID: 'legendary-start',
          },
          {
            label: t('legendaryDialog.replayNormal'),
            onPress: () => {
              const level = legendaryPrompt;
              setLegendaryPrompt(null);
              if (level) startLevel(level);
            },
            variant: 'secondary',
            testID: 'legendary-replay-normal',
          },
          {
            label: t('legendaryDialog.cancel'),
            onPress: () => setLegendaryPrompt(null),
            variant: 'secondary',
            testID: 'legendary-cancel',
          },
        ]}
        icon={<Crown color={colors.xpGold} fill={colors.xpGold} size={56} />}
        message={t('legendaryDialog.body')}
        onRequestClose={() => setLegendaryPrompt(null)}
        title={t('legendaryDialog.title')}
        visible={legendaryPrompt != null}
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

/** Vertical tiling periods of the parallax layers (content repeats seamlessly). */
const FAR_PERIOD = 900;
const MID_PERIOD = 1100;
/** Parallax rates: far blobs barely move, mid ghosts follow a bit faster. */
const FAR_RATE = 0.15;
const MID_RATE = 0.3;

/**
 * Layered pseudo-3D backdrop behind the map (design_mobile.md §4a bis):
 * static light gradient, then two SCROLL-PARALLAX layers — far accent blobs
 * (0.15×) and mid ghost shapes (0.3×) — each a vertically-tiling pattern so
 * the drift wraps seamlessly however long the subject map is. Transform-only,
 * driven from the list's scroll offset; static under reduced motion.
 */
function MapBackdrop({ accent, scrollY }: { accent: string; scrollY: SharedValue<number> }) {
  const reduceMotion = useReducedMotionPref();

  const farStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { transform: [{ translateY: 0 }] };
    const p = ((scrollY.value * FAR_RATE) % FAR_PERIOD + FAR_PERIOD) % FAR_PERIOD;
    return { transform: [{ translateY: -p }] };
  });
  const midStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { transform: [{ translateY: 0 }] };
    const p = ((scrollY.value * MID_RATE) % MID_PERIOD + MID_PERIOD) % MID_PERIOD;
    return { transform: [{ translateY: -p }] };
  });

  const blobTint = withAlpha(accent, 0.07);
  const blobTintSoft = withAlpha(accent, 0.06);
  const ghostTint = withAlpha(accent, 0.05);
  const ghostViolet = withAlpha(colors.primary[300], 0.07);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.backdropClip]}>
      <LinearGradient
        colors={[colors.primary[50], colors.neutral[50], colors.primary[50]]}
        style={StyleSheet.absoluteFill}
      />

      {/* FAR layer — large soft blobs, 0.15× scroll. */}
      <Animated.View style={[styles.parallaxLayer, farStyle]}>
        {[0, FAR_PERIOD].map((dy) => (
          <View key={dy}>
            <View style={[styles.blob, { top: 90 + dy, right: -140, backgroundColor: blobTint }]} />
            <View style={[styles.blob, { top: 520 + dy, left: -150, backgroundColor: blobTintSoft }]} />
          </View>
        ))}
      </Animated.View>

      {/* MID layer — big ghost shapes, 0.3× scroll (between blobs and rows). */}
      <Animated.View style={[styles.parallaxLayer, midStyle]}>
        {[0, MID_PERIOD].map((dy) => (
          <View key={dy}>
            <View style={[styles.ghostSquare, { top: 160 + dy, left: -70, backgroundColor: ghostTint }]} />
            <View style={[styles.ghostRing, { top: 610 + dy, right: -80, borderColor: ghostTint }]} />
            <View style={[styles.ghostDot, { top: 930 + dy, left: 46, backgroundColor: ghostViolet }]} />
          </View>
        ))}
      </Animated.View>
    </View>
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
  /**
   * Screen's content View is flexGrow-only; without flexShrink the list is
   * never height-bounded on web, so it can't scroll (and the parallax scroll
   * events never fire). Shrink-to-fit keeps the list windowed everywhere.
   */
  screenContent: {
    flexShrink: 1,
    minHeight: 0,
  },
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
  backdropClip: {
    overflow: 'hidden',
  },
  parallaxLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  blob: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
  },
  ghostSquare: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 64,
    transform: [{ rotate: '24deg' }],
  },
  ghostRing: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: 34,
  },
  ghostDot: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
  },
});

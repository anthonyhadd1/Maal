import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ViewToken,
} from 'react-native';

import type { AttemptQuestion } from '@/api/types';
import { QuestionCard } from '@/features/session/QuestionCard';
import type { SessionAnswerRecord } from '@/stores/sessionStore';

interface SessionPagerProps {
  questions: AttemptQuestion[];
  answers: Record<number, SessionAnswerRecord>;
  accent: string;
  initialIndex: number;
  submittingId: number | null;
  onSubmit: (question: AttemptQuestion, selectedChoiceIds: number[]) => void;
  onShown: (questionId: number) => void;
  onViewedIndexChange: (index: number) => void;
}


/**
 * TikTok/Reels-style vertical pager: one full-screen QuestionCard per
 * question, free navigation (swipe up/down at any time, not gated by
 * answering the card currently in view — the backend doesn't enforce order
 * either, see useSessionEngine's header comment).
 *
 * Uses `snapToInterval` + `disableIntervalMomentum` rather than relying on
 * `pagingEnabled` alone — more consistent snap behavior across native and
 * the react-native-web demo build.
 */
export function SessionPager({
  questions,
  answers,
  accent,
  initialIndex,
  submittingId,
  onSubmit,
  onShown,
  onViewedIndexChange,
}: SessionPagerProps) {
  const [cardHeight, setCardHeight] = useState(0);
  const listRef = useRef<FlatList<AttemptQuestion>>(null);
  const rootRef = useRef<View>(null);

  // RN's onLayout — reliable on native. On web, onLayout AND ResizeObserver
  // both depend on the browser pumping animation frames, which this screen's
  // fullScreenModal presentation somehow starves (confirmed directly: a
  // manually attached ResizeObserver never fires here either, and neither
  // does a bare requestAnimationFrame loop). getBoundingClientRect() forces
  // a synchronous layout regardless of frame pumping, so measure with that
  // inside useLayoutEffect (runs synchronously right after the DOM commits,
  // no frame wait) instead of trusting either async API on web.
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    if (Platform.OS === 'web') return;
    setCardHeight(Math.round(e.nativeEvent.layout.height));
  }, []);

  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = rootRef.current as unknown as HTMLElement | null;
    if (!node) return;
    const measure = () => setCardHeight(Math.round(node.getBoundingClientRect().height));
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Mirrored locally as well as reported upward: the per-card nav buttons need
  // to know where they are to disable themselves at the two ends, and reading
  // that back through the engine would lag a render behind the snap.
  const [viewedIndex, setViewedIndex] = useState(initialIndex);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) {
      setViewedIndex(first.index);
      onViewedIndexChange(first.index);
    }
  }).current;

  /**
   * Explicit navigation, independent of the swipe gesture.
   *
   * A card whose content overflows keeps an inner ScrollView, and a nested
   * vertical scroller consumes the pan before the pager ever sees it — so on
   * long questions the swipe silently did nothing. `gesture-alternative`: a
   * critical action must never be gesture-only, so every card also carries
   * real buttons that call this.
   */
  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= questions.length) return;
      listRef.current?.scrollToIndex({ index, animated: true });
      // Optimistic: viewability fires after the scroll settles, and the
      // buttons should disable/enable the instant they are pressed.
      setViewedIndex(index);
      onViewedIndexChange(index);
    },
    [onViewedIndexChange, questions.length],
  );

  const getItemLayout = useCallback(
    (_data: ArrayLike<AttemptQuestion> | null | undefined, index: number) => ({
      length: cardHeight,
      offset: cardHeight * index,
      index,
    }),
    [cardHeight],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: AttemptQuestion; index: number }) => (
      <QuestionCard
        accent={accent}
        answer={answers[item.id] ?? null}
        canGoNext={index < questions.length - 1}
        canGoPrev={index > 0}
        height={cardHeight}
        index={index}
        isLast={index === questions.length - 1}
        onNext={() => goTo(index + 1)}
        onPrev={() => goTo(index - 1)}
        onShown={() => onShown(item.id)}
        onSubmit={(selectedChoiceIds) => onSubmit(item, selectedChoiceIds)}
        question={item}
        showSwipeHint={index === 0}
        submitting={submittingId === item.id}
        total={questions.length}
      />
    ),
    [accent, answers, cardHeight, goTo, onShown, onSubmit, questions.length, submittingId],
  );

  return (
    <View onLayout={onLayout} ref={rootRef} style={styles.root} testID="session-pager">
      {cardHeight > 0 ? (
        <FlatList
          data={questions}
          decelerationRate="fast"
          disableIntervalMomentum
          getItemLayout={getItemLayout}
          initialNumToRender={3}
          initialScrollIndex={initialIndex}
          keyExtractor={(q) => String(q.id)}
          maxToRenderPerBatch={3}
          onScrollToIndexFailed={({ index }) => {
            // Web/first-paint edge case: retry once layout has settled.
            requestAnimationFrame(() => listRef.current?.scrollToIndex({ index, animated: false }));
          }}
          onViewableItemsChanged={onViewableItemsChanged}
          ref={listRef}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          snapToInterval={cardHeight}
          testID="session-pager-list"
          viewabilityConfig={viewabilityConfig}
          windowSize={3}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

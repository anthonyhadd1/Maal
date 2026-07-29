import { Maximize2, X } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { ClayIconButton } from '@/components/clay/ClayIconButton';
import { useEffectiveScreenWidth } from '@/components/layout/WebFrame';
import type { RendererProps } from '@/features/session/QuestionRenderer/types';
import { OptionsByType } from '@/features/session/QuestionRenderer/optionsByType';
import { withAlpha } from '@/lib/color';
import { backdropDark, colors, radii, spacing } from '@/theme/tokens';

/**
 * Image question: the figure above the options, tap → fullscreen pinch-zoom
 * (gesture-handler pinch, kept deliberately simple — design_mobile.md §4b).
 */
export function ImageQuestion(props: RendererProps) {
  const { t } = useTranslation('session');
  const [zoomOpen, setZoomOpen] = useState(false);
  const imageUrl = props.question.image_url;

  return (
    <View style={styles.root}>
      {imageUrl ? (
        <Pressable
          accessibilityLabel={t('imageZoom.open')}
          accessibilityRole="imagebutton"
          onPress={() => setZoomOpen(true)}
          testID="question-image"
        >
          <Image
            accessibilityLabel={t('media.questionImage')}
            resizeMode="contain"
            source={{ uri: imageUrl }}
            style={styles.image}
            testID="question-figure"
          />
          {/* Zoom affordance — the figure is shown whole, but circuit labels
              and axis values still reward a closer look. */}
          <View pointerEvents="none" style={styles.zoomHint}>
            <Maximize2 color={colors.neutral[0]} size={14} strokeWidth={2.4} />
          </View>
        </Pressable>
      ) : null}

      <OptionsByType {...props} />

      {imageUrl ? (
        <ImageZoomModal onClose={() => setZoomOpen(false)} uri={imageUrl} visible={zoomOpen} />
      ) : null}
    </View>
  );
}

/** Fullscreen pinch-zoom viewer — shared with PassageQuestion's embedded image. */
export function ImageZoomModal({
  uri,
  visible,
  onClose,
}: {
  uri: string;
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('session');
  const { height } = useWindowDimensions();
  const width = useEffectiveScreenWidth();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.min(Math.max(savedScale.value * event.scale, 1), 5);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scale.value = withSpring(1, { damping: 16, stiffness: 220 });
      savedScale.value = 1;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.zoomBackdrop}>
        <GestureDetector gesture={Gesture.Simultaneous(pinch, doubleTap)}>
          <Animated.View style={[styles.zoomStage, animatedStyle]}>
            <Image
              accessibilityLabel={t('media.questionImage')}
              resizeMode="contain"
              source={{ uri }}
              style={{ width: width - spacing.l * 2, height: height * 0.7 }}
            />
          </Animated.View>
        </GestureDetector>
        <View style={styles.zoomClose}>
          <ClayIconButton accessibilityLabel={t('imageZoom.close')} onPress={onClose} size={44}>
            <X color={colors.neutral[700]} size={22} />
          </ClayIconButton>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.l,
  },
  /**
   * `contain` on a white plate, not a 16/10 `cover` crop: these are real exam
   * figures (circuit schematics, oscilloscope traces, labelled biology
   * diagrams) where a cropped edge can hide the very terminal or label the
   * question asks about. 4/3 fits typical exam figures with little letterbox.
   */
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radii.m,
    backgroundColor: colors.neutral[0],
  },
  zoomHint: {
    position: 'absolute',
    bottom: spacing.s,
    right: spacing.s,
    width: 26,
    height: 26,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.neutral[900], 0.55),
  },
  zoomBackdrop: {
    flex: 1,
    backgroundColor: backdropDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomStage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomClose: {
    position: 'absolute',
    top: spacing.xxl + spacing.l,
    right: spacing.l,
  },
});

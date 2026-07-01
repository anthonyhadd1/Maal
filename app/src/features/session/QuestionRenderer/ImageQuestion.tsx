import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { ClayIconButton } from '@/components/clay/ClayIconButton';
import type { RendererProps } from '@/features/session/QuestionRenderer/types';
import { OptionsByType } from '@/features/session/QuestionRenderer/optionsByType';
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
          <Image resizeMode="cover" source={{ uri: imageUrl }} style={styles.image} />
        </Pressable>
      ) : null}

      <OptionsByType {...props} />

      {imageUrl ? (
        <ImageZoomModal onClose={() => setZoomOpen(false)} uri={imageUrl} visible={zoomOpen} />
      ) : null}
    </View>
  );
}

function ImageZoomModal({
  uri,
  visible,
  onClose,
}: {
  uri: string;
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('session');
  const { width, height } = useWindowDimensions();
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
  image: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: radii.m,
    backgroundColor: colors.neutral[100],
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

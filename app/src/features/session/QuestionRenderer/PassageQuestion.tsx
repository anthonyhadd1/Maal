import { BookOpen, ChevronDown, ChevronUp, Maximize2 } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ClayCard } from '@/components/clay/ClayCard';
import { MathText } from '@/components/content/MathText';
import { PressableScale } from '@/components/layout/PressableScale';
import { ImageZoomModal } from '@/features/session/QuestionRenderer/ImageQuestion';
import type { RendererProps } from '@/features/session/QuestionRenderer/types';
import { OptionsByType } from '@/features/session/QuestionRenderer/optionsByType';
import { withAlpha } from '@/lib/color';
import { colors, radii, spacing, typography } from '@/theme/tokens';

/**
 * Passage question: a « Lire le texte » clay card above the question's own
 * options (design_mobile.md §4b). Expanded by default — a passage question
 * can't be answered without its source text, and a collapsed-by-default card
 * makes it easy to miss that the passage exists at all.
 */
export function PassageQuestion(props: RendererProps) {
  const { t } = useTranslation('session');
  const [expanded, setExpanded] = useState(true);
  const [zoomOpen, setZoomOpen] = useState(false);
  const passage = props.question.passage;

  return (
    <View style={styles.root}>
      {passage ? (
        <ClayCard radius="l" style={styles.passageCard}>
          <PressableScale
            accessibilityLabel={expanded ? t('passage.hide') : t('passage.read')}
            accessibilityState={{ expanded }}
            clay={false}
            haptic={false}
            onPress={() => setExpanded((value) => !value)}
            pressedTranslateY={1}
            style={styles.passageHeader}
            testID="passage-toggle"
          >
            <BookOpen color={colors.primary[600]} size={20} />
            <Text style={styles.passageTitle}>
              {passage.title || (expanded ? t('passage.hide') : t('passage.read'))}
            </Text>
            {expanded ? (
              <ChevronUp color={colors.neutral[500]} size={20} />
            ) : (
              <ChevronDown color={colors.neutral[500]} size={20} />
            )}
          </PressableScale>

          {expanded ? (
            <View style={styles.passageBody} testID="passage-body">
              <MathText color={colors.neutral[700]} fontSize={16} text={passage.text} />
              {passage.image_url ? (
                <Pressable
                  accessibilityLabel={t('imageZoom.open')}
                  accessibilityRole="imagebutton"
                  onPress={() => setZoomOpen(true)}
                  testID="passage-image"
                >
                  <Image
                    accessibilityLabel={t('media.passageImage')}
                    resizeMode="cover"
                    source={{ uri: passage.image_url }}
                    style={styles.passageImage}
                  />
                  <View pointerEvents="none" style={styles.zoomHint}>
                    <Maximize2 color={colors.neutral[0]} size={14} strokeWidth={2.4} />
                  </View>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </ClayCard>
      ) : null}

      <OptionsByType {...props} />

      {passage?.image_url ? (
        <ImageZoomModal onClose={() => setZoomOpen(false)} uri={passage.image_url} visible={zoomOpen} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.l,
  },
  passageCard: {
    padding: spacing.m,
  },
  passageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
  },
  passageTitle: {
    ...typography.smallMedium,
    fontFamily: typography.h2.fontFamily,
    color: colors.primary[600],
    flex: 1,
  },
  passageBody: {
    marginTop: spacing.m,
    gap: spacing.m,
  },
  passageImage: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: radii.s,
    backgroundColor: colors.neutral[100],
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
});

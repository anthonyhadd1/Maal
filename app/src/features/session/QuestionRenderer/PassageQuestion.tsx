import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ClayCard } from '@/components/clay/ClayCard';
import { MathText } from '@/components/content/MathText';
import { PressableScale } from '@/components/layout/PressableScale';
import type { RendererProps } from '@/features/session/QuestionRenderer/types';
import { OptionsByType } from '@/features/session/QuestionRenderer/optionsByType';
import { colors, radii, spacing, typography } from '@/theme/tokens';

/**
 * Passage question: collapsible « Lire le texte » clay card above the
 * question's own options (design_mobile.md §4b).
 */
export function PassageQuestion(props: RendererProps) {
  const { t } = useTranslation('session');
  const [expanded, setExpanded] = useState(false);
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
              <MathText color={colors.neutral[700]} fontSize={15} text={passage.text} />
              {passage.image_url ? (
                <Image
                  resizeMode="cover"
                  source={{ uri: passage.image_url }}
                  style={styles.passageImage}
                />
              ) : null}
            </View>
          ) : null}
        </ClayCard>
      ) : null}

      <OptionsByType {...props} />
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
});

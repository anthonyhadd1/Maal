import { StyleSheet, View } from 'react-native';

import { MathText } from '@/components/content/MathText';
import { ImageQuestion } from '@/features/session/QuestionRenderer/ImageQuestion';
import { PassageQuestion } from '@/features/session/QuestionRenderer/PassageQuestion';
import { OptionsByType } from '@/features/session/QuestionRenderer/optionsByType';
import { classifyQuestion, type RendererProps } from '@/features/session/QuestionRenderer/types';
import { colors, fonts, spacing } from '@/theme/tokens';

/**
 * Dispatcher (design_mobile.md §4b): question stem (formula-aware) + the
 * renderer matching the discriminated kind. Passage/image kinds wrap the
 * base choice list with their extra content.
 */
export function QuestionRenderer(props: RendererProps) {
  const kind = classifyQuestion(props.question);

  return (
    <View style={styles.root}>
      <MathText
        color={colors.neutral[900]}
        fontSize={19}
        lineHeight={28}
        text={props.question.text}
        textStyle={styles.stem}
      />
      {kind === 'passage' ? (
        <PassageQuestion {...props} />
      ) : kind === 'image' ? (
        <ImageQuestion {...props} />
      ) : (
        <OptionsByType {...props} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.xl,
  },
  stem: {
    fontFamily: fonts.bodyBold,
  },
});

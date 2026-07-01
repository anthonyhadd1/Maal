import { StyleSheet, View } from 'react-native';

import { AnswerOption } from '@/features/session/AnswerOption';
import { choiceRevealState, type RendererProps } from '@/features/session/QuestionRenderer/types';
import { spacing } from '@/theme/tokens';

/** MCQ single answer: 2–5 clay answer cards, tap to select. */
export function SingleChoice({ question, accent, selected, onToggle, revealed, disabled }: RendererProps) {
  return (
    <View style={styles.list}>
      {question.choices.map((choice) => (
        <AnswerOption
          accent={accent}
          disabled={disabled}
          imageUrl={choice.image_url}
          key={choice.id}
          onPress={() => onToggle(choice.id)}
          state={choiceRevealState(choice.id, selected, revealed)}
          testID={`choice-${choice.id}`}
          text={choice.text}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.m,
  },
});

import { StyleSheet, View } from 'react-native';

import { AnswerOption } from '@/features/session/AnswerOption';
import { choiceRevealState, type RendererProps } from '@/features/session/QuestionRenderer/types';
import { spacing } from '@/theme/tokens';

/**
 * Vrai/Faux: two big side-by-side clay buttons (choice labels come from the
 * server, so wording stays content-driven). Select then « Vérifier ».
 */
export function TrueFalse({ question, accent, selected, onToggle, revealed, disabled }: RendererProps) {
  return (
    <View style={styles.row}>
      {question.choices.map((choice) => (
        <View key={choice.id} style={styles.half}>
          <AnswerOption
            accent={accent}
            center
            disabled={disabled}
            onPress={() => onToggle(choice.id)}
            state={choiceRevealState(choice.id, selected, revealed)}
            testID={`choice-${choice.id}`}
            text={choice.text}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.m,
  },
  half: {
    flex: 1,
  },
});

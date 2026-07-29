import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AnswerOption } from '@/features/session/AnswerOption';
import { ImageZoomModal } from '@/features/session/QuestionRenderer/ImageQuestion';
import {
  allChoicesAreImages,
  choiceRevealState,
  type RendererProps,
} from '@/features/session/QuestionRenderer/types';
import { spacing } from '@/theme/tokens';

/** MCQ single answer: 2–5 clay answer cards, tap to select. */
export function SingleChoice({ question, accent, selected, onToggle, revealed, disabled }: RendererProps) {
  // Real exam questions whose ANSWERS are graphs/diagrams ("laquelle de ces
  // courbes représente f ?"): the figures carry the whole question, so they
  // render as large uncropped plates with their own zoom, not 48px thumbnails.
  const imagePrimary = allChoicesAreImages(question);
  const [zoomUri, setZoomUri] = useState<string | null>(null);

  return (
    <View style={styles.list}>
      {question.choices.map((choice, index) => (
        <AnswerOption
          accent={accent}
          disabled={disabled}
          imagePrimary={imagePrimary}
          imageUrl={choice.image_url}
          index={index}
          key={choice.id}
          onPress={() => onToggle(choice.id)}
          onZoom={
            imagePrimary && choice.image_url
              ? () => setZoomUri(choice.image_url ?? null)
              : undefined
          }
          state={choiceRevealState(choice.id, selected, revealed)}
          testID={`choice-${choice.id}`}
          text={choice.text}
        />
      ))}

      {zoomUri ? <ImageZoomModal onClose={() => setZoomUri(null)} uri={zoomUri} visible /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.m,
  },
});

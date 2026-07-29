import { render, screen } from '@testing-library/react-native';

import type { AttemptQuestion } from '@/api/types';
import { ImageQuestion } from '@/features/session/QuestionRenderer/ImageQuestion';
import { SingleChoice } from '@/features/session/QuestionRenderer/SingleChoice';
import {
  allChoicesAreImages,
  classifyQuestion,
} from '@/features/session/QuestionRenderer/types';
import { singleQuestion } from '@/test/fixtures/session';
import { colors } from '@/theme/tokens';

/**
 * Real concours questions whose ANSWERS are graphs ("laquelle de ces courbes
 * représente f ?") were unanswerable while choice figures rendered as 48px
 * cover-cropped thumbnails — four candidate curves became indistinguishable
 * smudges. These lock in the large-uncropped-figure treatment.
 */
const graphChoiceQuestion: AttemptQuestion = {
  ...singleQuestion,
  text: 'La courbe représentative de la fonction x ↦ sin x est donnée par :',
  choices: [
    { id: 1, text: '', image_url: 'http://localhost/media/choices/q22-a.png' },
    { id: 2, text: '', image_url: 'http://localhost/media/choices/q22-b.png' },
    { id: 3, text: '', image_url: 'http://localhost/media/choices/q22-c.png' },
    { id: 4, text: '', image_url: 'http://localhost/media/choices/q22-d.png' },
  ],
};

/** Circuit schematics / oscilloscope traces / labelled biology diagrams. */
const figureQuestion: AttemptQuestion = {
  ...singleQuestion,
  text: "Donner l'expression de la résistance équivalente entre A et B.",
  image_url: 'http://localhost/media/questions/circuit.png',
};

describe('allChoicesAreImages', () => {
  test('true when every choice carries its own figure', () => {
    expect(allChoicesAreImages(graphChoiceQuestion)).toBe(true);
  });

  test('false for ordinary text choices', () => {
    expect(allChoicesAreImages(singleQuestion)).toBe(false);
  });

  test('false when only some choices have a figure (thumbnail-beside-text case)', () => {
    const mixed: AttemptQuestion = {
      ...singleQuestion,
      choices: [
        { id: 1, text: 'Structure A', image_url: 'http://localhost/media/a.png' },
        { id: 2, text: 'Aucune de ces réponses', image_url: null },
      ],
    };
    expect(allChoicesAreImages(mixed)).toBe(false);
  });

  test('false for an empty choice list (never treat "nothing" as all-images)', () => {
    expect(allChoicesAreImages({ ...singleQuestion, choices: [] })).toBe(false);
  });
});

describe('SingleChoice with graph answers', () => {
  test('renders every figure and gives each its own zoom control', async () => {
    await render(
      <SingleChoice
        accent={colors.primary[500]}
        disabled={false}
        onToggle={() => {}}
        question={graphChoiceQuestion}
        revealed={null}
        selected={[]}
      />,
    );

    for (const choice of graphChoiceQuestion.choices) {
      expect(screen.getByTestId(`choice-${choice.id}`)).toBeTruthy();
      expect(screen.getByTestId(`choice-${choice.id}-zoom`)).toBeTruthy();
    }
  });

  test('shows each graph whole — never a cover crop', async () => {
    await render(
      <SingleChoice
        accent={colors.primary[500]}
        disabled={false}
        onToggle={() => {}}
        question={graphChoiceQuestion}
        revealed={null}
        selected={[]}
      />,
    );

    for (const choice of graphChoiceQuestion.choices) {
      const figure = screen.getByTestId(`choice-${choice.id}-figure`);
      expect(figure.props.resizeMode).toBe('contain');
      expect(figure.props.source).toEqual({ uri: choice.image_url });
    }
  });

  test('ordinary text choices get no zoom control', async () => {
    await render(
      <SingleChoice
        accent={colors.primary[500]}
        disabled={false}
        onToggle={() => {}}
        question={singleQuestion}
        revealed={null}
        selected={[]}
      />,
    );

    expect(screen.queryByTestId(`choice-${singleQuestion.choices[0].id}-zoom`)).toBeNull();
  });
});

describe('ImageQuestion figure', () => {
  test('a question carrying a figure is classified as an image question', () => {
    expect(classifyQuestion(figureQuestion)).toBe('image');
    expect(classifyQuestion(singleQuestion)).toBe('single');
  });

  test('shows the figure whole — a cover crop can hide the labelled terminal', async () => {
    await render(
      <ImageQuestion
        accent={colors.primary[500]}
        disabled={false}
        onToggle={() => {}}
        question={figureQuestion}
        revealed={null}
        selected={[]}
      />,
    );

    const figure = screen.getByTestId('question-figure');
    expect(figure.props.resizeMode).toBe('contain');
    expect(figure.props.source).toEqual({ uri: figureQuestion.image_url });
  });
});

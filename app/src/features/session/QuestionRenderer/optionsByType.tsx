import { MultiChoice } from '@/features/session/QuestionRenderer/MultiChoice';
import { SingleChoice } from '@/features/session/QuestionRenderer/SingleChoice';
import { TrueFalse } from '@/features/session/QuestionRenderer/TrueFalse';
import type { RendererProps } from '@/features/session/QuestionRenderer/types';

/**
 * Choice list by `qtype` — shared by the base renderer and the image/passage
 * shells (kept in its own module to avoid renderer↔dispatcher cycles).
 */
export function OptionsByType(props: RendererProps) {
  switch (props.question.qtype) {
    case 'multi':
      return <MultiChoice {...props} />;
    case 'true_false':
      return <TrueFalse {...props} />;
    case 'single':
    default:
      return <SingleChoice {...props} />;
  }
}

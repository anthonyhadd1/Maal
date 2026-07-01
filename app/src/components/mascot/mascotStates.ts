import type LottieView from 'lottie-react-native';
import type { ComponentProps } from 'react';

export type MascotState = 'idle' | 'celebrate' | 'sad' | 'thinking';

type LottieSource = ComponentProps<typeof LottieView>['source'];

/**
 * Placeholder Lottie animations (minimal hand-written JSON).
 * Swapping in the branded phoenix later = replacing these 4 files. Zero code change.
 */
export const mascotSources: Record<MascotState, LottieSource> = {
  idle: require('../../../assets/lottie/mascot-idle.json'),
  celebrate: require('../../../assets/lottie/mascot-celebrate.json'),
  sad: require('../../../assets/lottie/mascot-sad.json'),
  thinking: require('../../../assets/lottie/mascot-thinking.json'),
};

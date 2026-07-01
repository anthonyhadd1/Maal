import LottieView from 'lottie-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { mascotSources, type MascotState } from '@/components/mascot/mascotStates';
import { useReducedMotionPref } from '@/lib/motion';

interface MascotProps {
  state?: MascotState;
  size?: number;
  loop?: boolean;
  speed?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * The ACE mascot. Reduced motion -> a static frame instead of the loop.
 * Purely decorative: hidden from screen readers.
 */
export function Mascot({ state = 'idle', size = 120, loop = true, speed = 1, style }: MascotProps) {
  const reduceMotion = useReducedMotionPref();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.base, { width: size, height: size }, style]}
    >
      <LottieView
        autoPlay={!reduceMotion}
        loop={loop && !reduceMotion}
        progress={reduceMotion ? 0.5 : undefined}
        source={mascotSources[state]}
        speed={speed}
        style={styles.fill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'center',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
});

import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { Circle, Defs, RadialGradient, Stop, Svg } from 'react-native-svg';

import { colors, gradients } from '@/theme/tokens';

interface InkBackdropProps {
  /** Diameter of the soft violet glow. */
  glowSize?: number;
  /** Vertical placement of the glow's centre (CSS-style top offset). */
  glowTop?: `${number}%`;
  /** Peak opacity of the glow's centre stop. */
  glowOpacity?: number;
}

/**
 * Shared near-black backdrop for the dark "getting set up" flow (welcome,
 * login, register, forgot-password, onboarding): the ink gradient plus one
 * soft radial violet glow — a TRUE radial gradient, not a flat semi-opaque
 * circle (which renders a hard, buggy-looking edge in React Native). Kept in
 * one place so every dark screen shares the exact same light source.
 */
export function InkBackdrop({ glowSize = 460, glowTop = '0%', glowOpacity = 0.26 }: InkBackdropProps) {
  return (
    <>
      <LinearGradient
        colors={gradients.ink}
        end={{ x: 0.5, y: 1 }}
        start={{ x: 0.5, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={[styles.glowBand, { top: glowTop }]}>
        <Svg height={glowSize} width={glowSize}>
          <Defs>
            <RadialGradient cx="50%" cy="50%" id="inkGlow" r="50%">
              <Stop offset="0%" stopColor={colors.primary[500]} stopOpacity={glowOpacity} />
              <Stop offset="50%" stopColor={colors.primary[500]} stopOpacity={glowOpacity * 0.45} />
              <Stop offset="100%" stopColor={colors.primary[500]} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={glowSize / 2} cy={glowSize / 2} fill="url(#inkGlow)" r={glowSize / 2} />
        </Svg>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  glowBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});

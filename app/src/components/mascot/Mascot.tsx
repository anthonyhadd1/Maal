import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

import type { MascotState } from '@/components/mascot/mascotStates';
import { useReducedMotionPref } from '@/lib/motion';
import { mascotPalette as P } from '@/theme/tokens';

interface MascotProps {
  state?: MascotState;
  size?: number;
  loop?: boolean;
  speed?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * The ACE mascot — a young violet phoenix chick, hand-drawn SVG.
 * Face + posture change per state; a soft Reanimated bob loop breathes
 * life into it (static under reduced motion). Purely decorative:
 * hidden from screen readers.
 */
export function Mascot({ state = 'idle', size = 120, loop = true, speed = 1, style }: MascotProps) {
  const reduceMotion = useReducedMotionPref();
  const bob = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(bob);
    bob.value = 0;
    if (reduceMotion || !loop || state === 'sad') return;
    const celebrate = state === 'celebrate';
    const amplitude = celebrate ? -7 : -4;
    const duration = (celebrate ? 420 : 1500) / Math.max(speed, 0.1);
    bob.value = withRepeat(
      withSequence(
        withTiming(amplitude, { duration, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
    return () => cancelAnimation(bob);
  }, [bob, state, loop, speed, reduceMotion]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value }],
  }));

  return (
    <View
      aria-hidden
      style={[styles.base, { width: size, height: size }, style]}
    >
      {/* Ground shadow stays put while the chick bobs. */}
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} viewBox="0 0 240 240">
        <Ellipse cx={120} cy={218} rx={52} ry={9} fill={P.groundShadow} />
      </Svg>
      <Animated.View style={[styles.fill, bodyStyle]}>
        <Svg height="100%" viewBox="0 0 240 240" width="100%">
          <Defs>
            <LinearGradient id="aceCrest" x1="0" x2="0" y1="1" y2="0">
              <Stop offset="0" stopColor={P.crestBase} />
              <Stop offset="0.55" stopColor={P.crestMid} />
              <Stop offset="1" stopColor={P.crestTip} />
            </LinearGradient>
          </Defs>
          <Crest state={state} />
          <Body state={state} />
          <Wings state={state} />
          <Face state={state} />
        </Svg>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Composable SVG groups
// ---------------------------------------------------------------------------

/** One crest feather pointing up, base at (0,0). Place with G transforms. */
const FEATHER = 'M0 0 C-11 -10 -12 -30 0 -44 C12 -30 11 -10 0 0 Z';

function Crest({ state }: { state: MascotState }) {
  if (state === 'celebrate') {
    // Flared wide, bases planted in the head (the body is drawn on top).
    return (
      <G>
        <G transform="translate(100, 82) rotate(-38) scale(0.85)">
          <Path d={FEATHER} fill="url(#aceCrest)" />
        </G>
        <G transform="translate(140, 82) rotate(38) scale(0.85)">
          <Path d={FEATHER} fill="url(#aceCrest)" />
        </G>
        <G transform="translate(120, 78) scale(1.12)">
          <Path d={FEATHER} fill="url(#aceCrest)" />
        </G>
      </G>
    );
  }
  if (state === 'sad') {
    // Drooped to the side.
    return (
      <G>
        <G transform="translate(106, 80) rotate(28) scale(0.62)">
          <Path d={FEATHER} fill="url(#aceCrest)" />
        </G>
        <G transform="translate(132, 82) rotate(64) scale(0.7)">
          <Path d={FEATHER} fill="url(#aceCrest)" />
        </G>
        <G transform="translate(120, 78) rotate(46) scale(0.82)">
          <Path d={FEATHER} fill="url(#aceCrest)" />
        </G>
      </G>
    );
  }
  // idle / thinking
  return (
    <G>
      <G transform="translate(105, 82) rotate(-24) scale(0.78)">
        <Path d={FEATHER} fill="url(#aceCrest)" />
      </G>
      <G transform="translate(135, 82) rotate(24) scale(0.78)">
        <Path d={FEATHER} fill="url(#aceCrest)" />
      </G>
      <G transform="translate(120, 78)">
        <Path d={FEATHER} fill="url(#aceCrest)" />
      </G>
    </G>
  );
}

function Body({ state }: { state: MascotState }) {
  const slump = state === 'sad' ? 4 : 0;
  return (
    <G transform={`translate(0, ${slump})`}>
      {/* Depth layer, main volume, top light, belly. */}
      <Ellipse cx={120} cy={140} rx={74} ry={68} fill={P.bodyDeep} />
      <Ellipse cx={120} cy={134} rx={72} ry={66} fill={P.body} />
      <Ellipse cx={110} cy={104} rx={38} ry={25} fill={P.bodyLight} opacity={0.28} />
      <Ellipse cx={120} cy={170} rx={40} ry={27} fill={P.belly} />
      <Ellipse cx={111} cy={162} rx={17} ry={9} fill={P.bellyGlow} opacity={0.4} />
      {/* Feet */}
      <Ellipse cx={100} cy={205} rx={11} ry={6} fill={P.beak} />
      <Ellipse cx={140} cy={205} rx={11} ry={6} fill={P.beak} />
    </G>
  );
}

function Wings({ state }: { state: MascotState }) {
  if (state === 'celebrate') {
    // Wings up!
    return (
      <G>
        <Ellipse cx={42} cy={104} rx={15} ry={32} fill={P.wing} transform="rotate(-42 42 104)" />
        <Ellipse cx={198} cy={104} rx={15} ry={32} fill={P.wing} transform="rotate(42 198 104)" />
      </G>
    );
  }
  if (state === 'sad') {
    // Left tucked, right raised to wipe the eye.
    return (
      <G>
        <Ellipse cx={52} cy={156} rx={16} ry={30} fill={P.wing} transform="rotate(-12 52 156)" />
        <Ellipse cx={158} cy={140} rx={14} ry={28} fill={P.wing} transform="rotate(38 158 140)" />
      </G>
    );
  }
  if (state === 'thinking') {
    // Right tucked, left up to the chin.
    return (
      <G>
        <Ellipse cx={188} cy={152} rx={16} ry={31} fill={P.wing} transform="rotate(14 188 152)" />
        <Ellipse cx={96} cy={158} rx={13} ry={26} fill={P.wing} transform="rotate(24 96 158)" />
      </G>
    );
  }
  return (
    <G>
      <Ellipse cx={52} cy={150} rx={16} ry={31} fill={P.wing} transform="rotate(-14 52 150)" />
      <Ellipse cx={188} cy={150} rx={16} ry={31} fill={P.wing} transform="rotate(14 188 150)" />
    </G>
  );
}

function Face({ state }: { state: MascotState }) {
  return (
    <G>
      {/* Cheeks */}
      <Ellipse cx={82} cy={134} rx={11} ry={7} fill={P.cheek} />
      <Ellipse cx={158} cy={134} rx={11} ry={7} fill={P.cheek} />
      <Eyes state={state} />
      <Beak state={state} />
      {state === 'sad' ? (
        // A single tear under the left eye.
        <Path
          d="M88 130 C84 138 83 143 88 146 C93 143 92 138 88 130 Z"
          fill={P.tear}
          opacity={0.9}
        />
      ) : null}
    </G>
  );
}

function Eyes({ state }: { state: MascotState }) {
  if (state === 'celebrate') {
    // Closed happy ^^ eyes.
    return (
      <G>
        <Path
          d="M82 114 Q96 99 110 114"
          fill="none"
          stroke={P.pupil}
          strokeLinecap="round"
          strokeWidth={7}
        />
        <Path
          d="M130 114 Q144 99 158 114"
          fill="none"
          stroke={P.pupil}
          strokeLinecap="round"
          strokeWidth={7}
        />
      </G>
    );
  }
  if (state === 'sad') {
    return (
      <G>
        {/* Worried brows: inner ends up. */}
        <Path d="M84 96 L106 90" stroke={P.brow} strokeLinecap="round" strokeWidth={5} />
        <Path d="M156 96 L134 90" stroke={P.brow} strokeLinecap="round" strokeWidth={5} />
        <Ellipse cx={96} cy={113} rx={15} ry={15.5} fill={P.eyeWhite} />
        <Ellipse cx={144} cy={113} rx={15} ry={15.5} fill={P.eyeWhite} />
        {/* Pupils low, downturned. */}
        <Circle cx={96} cy={119} r={7.5} fill={P.pupil} />
        <Circle cx={144} cy={119} r={7.5} fill={P.pupil} />
        <Circle cx={93} cy={116} r={2.4} fill={P.eyeWhite} />
        <Circle cx={141} cy={116} r={2.4} fill={P.eyeWhite} />
      </G>
    );
  }
  if (state === 'thinking') {
    return (
      <G>
        {/* One raised brow. */}
        <Path d="M82 90 Q96 83 110 89" fill="none" stroke={P.brow} strokeLinecap="round" strokeWidth={5} />
        <Path d="M134 97 L158 97" stroke={P.brow} strokeLinecap="round" strokeWidth={5} />
        <Ellipse cx={96} cy={111} rx={16.5} ry={18} fill={P.eyeWhite} />
        <Ellipse cx={144} cy={111} rx={16.5} ry={18} fill={P.eyeWhite} />
        {/* Pupils up-left. */}
        <Circle cx={91} cy={105} r={8} fill={P.pupil} />
        <Circle cx={139} cy={105} r={8} fill={P.pupil} />
        <Circle cx={88} cy={102} r={2.8} fill={P.eyeWhite} />
        <Circle cx={136} cy={102} r={2.8} fill={P.eyeWhite} />
      </G>
    );
  }
  // idle: big open eyes + glints
  return (
    <G>
      <Ellipse cx={96} cy={111} rx={16.5} ry={18.5} fill={P.eyeWhite} />
      <Ellipse cx={144} cy={111} rx={16.5} ry={18.5} fill={P.eyeWhite} />
      <Circle cx={96} cy={113} r={8.5} fill={P.pupil} />
      <Circle cx={144} cy={113} r={8.5} fill={P.pupil} />
      <Circle cx={92.5} cy={109} r={3} fill={P.eyeWhite} />
      <Circle cx={140.5} cy={109} r={3} fill={P.eyeWhite} />
      <Circle cx={99.5} cy={117.5} r={1.6} fill={P.eyeWhite} opacity={0.85} />
      <Circle cx={147.5} cy={117.5} r={1.6} fill={P.eyeWhite} opacity={0.85} />
    </G>
  );
}

function Beak({ state }: { state: MascotState }) {
  if (state === 'celebrate') {
    // Open beak: dark cheering mouth + tongue, gold upper beak on top.
    return (
      <G>
        <Ellipse cx={120} cy={138} rx={12.5} ry={10} fill={P.mouth} />
        <Ellipse cx={120} cy={143.5} rx={6} ry={4} fill={P.tongue} />
        <Path d="M106 128 C112 120 128 120 134 128 C130 134 125 136 120 136 C115 136 110 134 106 128 Z" fill={P.beak} />
      </G>
    );
  }
  if (state === 'sad') {
    // Small beak, tilted down.
    return (
      <G transform="translate(12, 17) scale(0.9)">
        <Path d="M108 128 C114 123 126 123 132 128 C128 136 123 138.5 120 138.5 C117 138.5 112 136 108 128 Z" fill={P.beak} />
        <Path d="M113 136 Q120 140.5 127 136 Q124 140 120 140.5 Q116 140 113 136 Z" fill={P.beakDeep} />
      </G>
    );
  }
  // idle / thinking: small smiling beak.
  return (
    <G>
      <Path d="M107 128 C113 122 127 122 133 128 C129 137 123 140 120 140 C117 140 111 137 107 128 Z" fill={P.beak} />
      <Path d="M112 137 Q120 142 128 137 Q124 141.5 120 142 Q116 141.5 112 137 Z" fill={P.beakDeep} />
    </G>
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

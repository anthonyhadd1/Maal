import type { JSX } from 'react';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import { shade, withAlpha } from '@/lib/color';
import { colors, contactShadow } from '@/theme/tokens';

/**
 * Claymorphic scenery props for the map world (design_mobile.md §4a bis).
 *
 * Every prop lives in a 64×64 viewBox, is shaded with a top-left light
 * (gradient light → deep towards bottom-right) and sits on a tiny contact
 * shadow ellipse so it feels grounded. Colors derive from the SUBJECT ACCENT
 * at runtime (accents are data-driven) — never hardcoded hues, except gold
 * details that come from tokens.
 *
 * `muted` renders the low-contrast FAR-tier variant (bigger, washed out,
 * pushed towards the backdrop) — near-tier props stay crisp.
 */

export interface ScenePropProps {
  size: number;
  accent: string;
  /** FAR tier: low-contrast palette that sinks into the backdrop. */
  muted: boolean;
  /** Unique gradient-id suffix (web SVG ids are document-global). */
  gid: string;
}

export type SceneProp = (props: ScenePropProps) => JSX.Element;

interface Palette {
  light: string;
  base: string;
  deep: string;
  detail: string;
  paper: string;
  shadow: string;
}

function paletteFor(accent: string, muted: boolean): Palette {
  if (muted) {
    return {
      light: shade(accent, 0.78),
      base: shade(accent, 0.6),
      deep: shade(accent, 0.42),
      detail: shade(accent, 0.3),
      paper: withAlpha(colors.neutral[0], 0.75),
      shadow: withAlpha(colors.neutral[900], 0.05),
    };
  }
  return {
    light: shade(accent, 0.45),
    base: accent,
    deep: shade(accent, -0.24),
    detail: shade(accent, -0.4),
    paper: colors.neutral[0],
    shadow: contactShadow,
  };
}

/** Top-left key light: light at (0,0) → deep at (1,1). */
function TopLight({ id, from, to }: { id: string; from: string; to: string }) {
  return (
    <SvgLinearGradient id={id} x1="0" x2="1" y1="0" y2="1">
      <Stop offset="0" stopColor={from} />
      <Stop offset="1" stopColor={to} />
    </SvgLinearGradient>
  );
}

/** Ground contact ellipse shared by all props. */
function Ground({ fill, rx = 15 }: { fill: string; rx?: number }) {
  return <Ellipse cx={32} cy={58} fill={fill} rx={rx} ry={3.4} />;
}

// ---------------------------------------------------------------------------
// BIOLOGIE — DNA, cell, leaf sprig, microscope
// ---------------------------------------------------------------------------

const DnaProp: SceneProp = ({ size, accent, muted, gid }) => {
  const p = paletteFor(accent, muted);
  return (
    <Svg height={size} viewBox="0 0 64 64" width={size}>
      <Defs>
        <TopLight from={p.light} id={`dna-${gid}`} to={p.base} />
      </Defs>
      <Ground fill={p.shadow} rx={12} />
      {/* Rungs behind the strands. */}
      <Line stroke={p.light} strokeLinecap="round" strokeWidth={3} x1={26} x2={38} y1={14} y2={14} />
      <Line stroke={p.light} strokeLinecap="round" strokeWidth={3} x1={24} x2={40} y1={22} y2={22} />
      <Line stroke={p.light} strokeLinecap="round" strokeWidth={3} x1={24} x2={40} y1={40} y2={40} />
      <Line stroke={p.light} strokeLinecap="round" strokeWidth={3} x1={26} x2={38} y1={48} y2={48} />
      <Path
        d="M23 7 C 43 19, 43 43, 23 55"
        fill="none"
        stroke={`url(#dna-${gid})`}
        strokeLinecap="round"
        strokeWidth={4.5}
      />
      <Path
        d="M41 7 C 21 19, 21 43, 41 55"
        fill="none"
        stroke={p.deep}
        strokeLinecap="round"
        strokeWidth={4.5}
      />
    </Svg>
  );
};

const CellProp: SceneProp = ({ size, accent, muted, gid }) => {
  const p = paletteFor(accent, muted);
  return (
    <Svg height={size} viewBox="0 0 64 64" width={size}>
      <Defs>
        <TopLight from={p.light} id={`cell-${gid}`} to={p.base} />
      </Defs>
      <Ground fill={p.shadow} rx={17} />
      <Circle cx={32} cy={35} fill={`url(#cell-${gid})`} r={20} />
      <Circle cx={32} cy={35} fill="none" r={20} stroke={p.deep} strokeWidth={2} />
      {/* Nucleus + organelles, pushed to the shaded side. */}
      <Circle cx={37} cy={40} fill={p.deep} r={6.5} />
      <Circle cx={35.2} cy={38.2} fill={p.base} r={2} />
      <Circle cx={24} cy={40} fill={p.deep} opacity={0.55} r={2.2} />
      <Circle cx={40} cy={26} fill={p.deep} opacity={0.55} r={1.8} />
      {/* Top-left sheen. */}
      <Ellipse cx={25} cy={25} fill={p.paper} opacity={0.5} rx={6.5} ry={4} transform="rotate(-32 25 25)" />
    </Svg>
  );
};

const LeafProp: SceneProp = ({ size, accent, muted, gid }) => {
  const p = paletteFor(accent, muted);
  return (
    <Svg height={size} viewBox="0 0 64 64" width={size}>
      <Defs>
        <TopLight from={p.light} id={`leaf-${gid}`} to={p.base} />
      </Defs>
      <Ground fill={p.shadow} rx={11} />
      <Path d="M33 57 C 30 42, 30 28, 34 13" fill="none" stroke={p.deep} strokeLinecap="round" strokeWidth={3} />
      <Ellipse cx={23} cy={33} fill={`url(#leaf-${gid})`} rx={9.5} ry={5.5} transform="rotate(-38 23 33)" />
      <Ellipse cx={43} cy={26} fill={p.base} rx={9} ry={5} transform="rotate(32 43 26)" />
      <Ellipse cx={27} cy={17} fill={`url(#leaf-${gid})`} rx={7.5} ry={4.5} transform="rotate(-28 27 17)" />
      {/* Vein highlights. */}
      <Line stroke={p.paper} strokeLinecap="round" strokeWidth={1.4} opacity={0.55} x1={18} x2={28} y1={37} y2={30} />
      <Line stroke={p.paper} strokeLinecap="round" strokeWidth={1.4} opacity={0.55} x1={38} x2={47} y1={29} y2={23} />
    </Svg>
  );
};

const MicroscopeProp: SceneProp = ({ size, accent, muted, gid }) => {
  const p = paletteFor(accent, muted);
  return (
    <Svg height={size} viewBox="0 0 64 64" width={size}>
      <Defs>
        <TopLight from={p.light} id={`mic-${gid}`} to={p.base} />
      </Defs>
      <Ground fill={p.shadow} rx={16} />
      {/* Base plinth. */}
      <Rect fill={p.deep} height={6} rx={3} width={34} x={15} y={50} />
      {/* Arm. */}
      <Path d="M41 50 C 48 40, 46 26, 34 20" fill="none" stroke={p.deep} strokeLinecap="round" strokeWidth={6} />
      {/* Tilted optical tube (lit face). */}
      <G transform="rotate(28 30 22)">
        <Rect fill={`url(#mic-${gid})`} height={22} rx={4.5} width={11} x={24.5} y={9} />
        <Rect fill={p.light} height={5} rx={2.5} width={13} x={23.5} y={6} />
      </G>
      {/* Stage + lens dot. */}
      <Rect fill={p.base} height={4} rx={2} width={18} x={20} y={41} />
      <Circle cx={36} cy={37} fill={p.detail} r={2.2} />
    </Svg>
  );
};

// ---------------------------------------------------------------------------
// CHIMIE — erlenmeyer, molecule, test tubes
// ---------------------------------------------------------------------------

const FlaskProp: SceneProp = ({ size, accent, muted, gid }) => {
  const p = paletteFor(accent, muted);
  return (
    <Svg height={size} viewBox="0 0 64 64" width={size}>
      <Defs>
        <TopLight from={p.light} id={`fla-${gid}`} to={p.base} />
      </Defs>
      <Ground fill={p.shadow} rx={15} />
      {/* Glass cone. */}
      <Path
        d="M27 9 h10 v14 l10.5 24.5 a5 5 0 0 1 -4.6 7 H21.1 a5 5 0 0 1 -4.6 -7 L27 23 z"
        fill={withAlpha(p.light, muted ? 0.5 : 0.4)}
        stroke={p.deep}
        strokeWidth={2}
      />
      {/* Bubbling liquid. */}
      <Path
        d="M24.6 38.5 l-5.4 12.6 a3.4 3.4 0 0 0 3.1 4.6 h19.4 a3.4 3.4 0 0 0 3.1 -4.6 L39.4 38.5 z"
        fill={`url(#fla-${gid})`}
      />
      <Circle cx={29} cy={35} fill={p.base} r={2.1} />
      <Circle cx={35} cy={30} fill={p.light} r={1.5} />
      <Circle cx={32} cy={25} fill={p.light} r={1.1} />
      {/* Rim + neck sheen. */}
      <Rect fill={p.deep} height={3} rx={1.5} width={14} x={25} y={8} />
      <Line opacity={0.6} stroke={p.paper} strokeLinecap="round" strokeWidth={1.6} x1={29} x2={29} y1={13} y2={21} />
    </Svg>
  );
};

const MoleculeProp: SceneProp = ({ size, accent, muted, gid }) => {
  const p = paletteFor(accent, muted);
  return (
    <Svg height={size} viewBox="0 0 64 64" width={size}>
      <Defs>
        <TopLight from={p.light} id={`mol-${gid}`} to={p.base} />
      </Defs>
      <Ground fill={p.shadow} rx={16} />
      <Line stroke={p.deep} strokeLinecap="round" strokeWidth={4} x1={21} x2={33} y1={44} y2={19} />
      <Line stroke={p.deep} strokeLinecap="round" strokeWidth={4} x1={33} x2={45} y1={19} y2={42} />
      <Circle cx={21} cy={44} fill={`url(#mol-${gid})`} r={9} />
      <Circle cx={45} cy={42} fill={p.deep} r={7.5} />
      <Circle cx={33} cy={17} fill={`url(#mol-${gid})`} r={8} />
      {/* Specular dots (top-left light). */}
      <Circle cx={18} cy={41} fill={p.paper} opacity={0.6} r={2.4} />
      <Circle cx={30.5} cy={14.5} fill={p.paper} opacity={0.6} r={2.1} />
      <Circle cx={42.8} cy={39.5} fill={p.paper} opacity={0.45} r={1.8} />
    </Svg>
  );
};

const TestTubesProp: SceneProp = ({ size, accent, muted, gid }) => {
  const p = paletteFor(accent, muted);
  return (
    <Svg height={size} viewBox="0 0 64 64" width={size}>
      <Defs>
        <TopLight from={p.light} id={`tub-${gid}`} to={p.base} />
      </Defs>
      <Ground fill={p.shadow} rx={14} />
      {/* Tall tube. */}
      <Rect fill={withAlpha(p.light, muted ? 0.5 : 0.35)} height={44} rx={5.5} stroke={p.deep} strokeWidth={2} width={11} x={19} y={12} />
      <Path d="M19 34 h11 v16.5 a5.5 5.5 0 0 1 -11 0 z" fill={`url(#tub-${gid})`} />
      <Rect fill={p.deep} height={3} rx={1.5} width={15} x={17} y={11} />
      {/* Short tube. */}
      <Rect fill={withAlpha(p.light, muted ? 0.5 : 0.35)} height={36} rx={5.5} stroke={p.deep} strokeWidth={2} width={11} x={36} y={20} />
      <Path d="M36 40 h11 v10.5 a5.5 5.5 0 0 1 -11 0 z" fill={p.deep} />
      <Rect fill={p.deep} height={3} rx={1.5} width={15} x={34} y={19} />
      {/* Glass sheen. */}
      <Line opacity={0.6} stroke={p.paper} strokeLinecap="round" strokeWidth={1.6} x1={22.5} x2={22.5} y1={16} y2={30} />
      <Line opacity={0.6} stroke={p.paper} strokeLinecap="round" strokeWidth={1.6} x1={39.5} x2={39.5} y1={24} y2={36} />
    </Svg>
  );
};

// ---------------------------------------------------------------------------
// PHYSIQUE — atom, ringed planet, magnet, lightning chip
// ---------------------------------------------------------------------------

const AtomProp: SceneProp = ({ size, accent, muted, gid }) => {
  const p = paletteFor(accent, muted);
  return (
    <Svg height={size} viewBox="0 0 64 64" width={size}>
      <Defs>
        <TopLight from={p.light} id={`ato-${gid}`} to={p.base} />
      </Defs>
      <Ground fill={p.shadow} rx={15} />
      <Ellipse cx={32} cy={31} fill="none" rx={22} ry={8.5} stroke={p.base} strokeWidth={2.5} transform="rotate(-28 32 31)" />
      <Ellipse cx={32} cy={31} fill="none" rx={22} ry={8.5} stroke={p.deep} strokeWidth={2.5} transform="rotate(28 32 31)" />
      <Circle cx={32} cy={31} fill={`url(#ato-${gid})`} r={6.5} />
      <Circle cx={30} cy={29} fill={p.paper} opacity={0.6} r={1.8} />
      {/* Electrons. */}
      <Circle cx={13.5} cy={22} fill={p.deep} r={2.6} />
      <Circle cx={50} cy={42} fill={p.base} r={2.6} />
    </Svg>
  );
};

const PlanetProp: SceneProp = ({ size, accent, muted, gid }) => {
  const p = paletteFor(accent, muted);
  return (
    <Svg height={size} viewBox="0 0 64 64" width={size}>
      <Defs>
        <TopLight from={p.light} id={`pla-${gid}`} to={p.base} />
      </Defs>
      <Ground fill={p.shadow} rx={15} />
      {/* Back half of the ring. */}
      <Path d="M10 26.5 A 24 8 -16 0 1 54 35.5" fill="none" stroke={p.deep} strokeLinecap="round" strokeWidth={3} opacity={0.55} />
      <Circle cx={32} cy={31} fill={`url(#pla-${gid})`} r={14} />
      {/* Soft bands + sheen. */}
      <Path d="M20 35 q 12 5 24 -1" fill="none" opacity={0.5} stroke={p.deep} strokeLinecap="round" strokeWidth={2.4} />
      <Ellipse cx={27} cy={25} fill={p.paper} opacity={0.55} rx={5} ry={3} transform="rotate(-30 27 25)" />
      {/* Front half of the ring (occludes the sphere). */}
      <Path d="M54 35.5 A 24 8 -16 0 1 10 26.5" fill="none" stroke={p.deep} strokeLinecap="round" strokeWidth={3.4} />
    </Svg>
  );
};

const MagnetProp: SceneProp = ({ size, accent, muted, gid }) => {
  const p = paletteFor(accent, muted);
  return (
    <Svg height={size} viewBox="0 0 64 64" width={size}>
      <Defs>
        <TopLight from={p.light} id={`mag-${gid}`} to={p.base} />
      </Defs>
      <Ground fill={p.shadow} rx={15} />
      {/* U body: two legs + bottom arc. */}
      <Path
        d="M18 14 h11 v20 a3 3 0 0 0 6 0 V14 h11 v21 a14 14 0 0 1 -28 0 z"
        fill={`url(#mag-${gid})`}
        stroke={p.deep}
        strokeWidth={2}
      />
      {/* Pole tips. */}
      <Rect fill={p.paper} height={6.5} rx={2} width={11} x={18} y={14} />
      <Rect fill={p.paper} height={6.5} rx={2} width={11} x={35} y={14} />
      {/* Spark lines. */}
      <Line stroke={p.detail} strokeLinecap="round" strokeWidth={1.8} x1={22} x2={20} y1={9} y2={5.5} />
      <Line stroke={p.detail} strokeLinecap="round" strokeWidth={1.8} x1={42} x2={44} y1={9} y2={5.5} />
    </Svg>
  );
};

const BoltChipProp: SceneProp = ({ size, accent, muted, gid }) => {
  const p = paletteFor(accent, muted);
  return (
    <Svg height={size} viewBox="0 0 64 64" width={size}>
      <Defs>
        <TopLight from={p.light} id={`bol-${gid}`} to={p.base} />
      </Defs>
      <Ground fill={p.shadow} rx={16} />
      <Rect fill={p.deep} height={42} rx={13} width={42} x={11} y={14} />
      <Rect fill={`url(#bol-${gid})`} height={42} rx={13} width={42} x={11} y={11} />
      <Path
        d="M35 18 L24 34 h7 l-3.5 13 L40 30 h-7.5 L36.5 18 z"
        fill={muted ? p.paper : colors.xpGold}
        opacity={muted ? 0.85 : 1}
      />
    </Svg>
  );
};

// ---------------------------------------------------------------------------
// CULTURE (default / fallback) — open book, globe, column, quill
// ---------------------------------------------------------------------------

const BookProp: SceneProp = ({ size, accent, muted, gid }) => {
  const p = paletteFor(accent, muted);
  return (
    <Svg height={size} viewBox="0 0 64 64" width={size}>
      <Defs>
        <TopLight from={p.light} id={`boo-${gid}`} to={p.base} />
      </Defs>
      <Ground fill={p.shadow} rx={17} />
      {/* Cover (deeper, offset down). */}
      <Path d="M32 24 C 22 17, 13 17, 9 21 V 49 C 13 45, 22 45, 32 51 C 42 45, 51 45, 55 49 V 21 C 51 17, 42 17, 32 24 z" fill={`url(#boo-${gid})`} stroke={p.deep} strokeWidth={2} />
      {/* Pages. */}
      <Path d="M32 26 C 24 20.5, 16.5 20.5, 13 23.6 V 45 C 16.5 42, 24 42, 32 47 z" fill={p.paper} />
      <Path d="M32 26 C 40 20.5, 47.5 20.5, 51 23.6 V 45 C 47.5 42, 40 42, 32 47 z" fill={withAlpha(p.paper, 0.85)} />
      {/* Text lines. */}
      <Line opacity={0.5} stroke={p.detail} strokeLinecap="round" strokeWidth={1.5} x1={17} x2={27} y1={28} y2={30} />
      <Line opacity={0.5} stroke={p.detail} strokeLinecap="round" strokeWidth={1.5} x1={17} x2={27} y1={33} y2={35} />
      <Line opacity={0.5} stroke={p.detail} strokeLinecap="round" strokeWidth={1.5} x1={37} x2={47} y1={30} y2={28} />
      <Line opacity={0.5} stroke={p.detail} strokeLinecap="round" strokeWidth={1.5} x1={37} x2={47} y1={35} y2={33} />
    </Svg>
  );
};

const GlobeProp: SceneProp = ({ size, accent, muted, gid }) => {
  const p = paletteFor(accent, muted);
  return (
    <Svg height={size} viewBox="0 0 64 64" width={size}>
      <Defs>
        <TopLight from={p.light} id={`glo-${gid}`} to={p.base} />
      </Defs>
      <Ground fill={p.shadow} rx={13} />
      {/* Stand. */}
      <Path d="M45 15 A 17.5 17.5 0 0 1 45 41" fill="none" stroke={p.deep} strokeLinecap="round" strokeWidth={3} />
      <Rect fill={p.deep} height={4} rx={2} width={18} x={23} y={52} />
      <Rect fill={p.deep} height={7} rx={1.5} width={4} x={30} y={45} />
      {/* Sphere on a slight tilt. */}
      <G transform="rotate(-14 31 28)">
        <Circle cx={31} cy={28} fill={`url(#glo-${gid})`} r={15} />
        <Ellipse cx={31} cy={28} fill="none" opacity={0.65} rx={6.5} ry={15} stroke={p.deep} strokeWidth={1.8} />
        <Line opacity={0.65} stroke={p.deep} strokeLinecap="round" strokeWidth={1.8} x1={16.5} x2={45.5} y1={28} y2={28} />
        <Ellipse cx={25} cy={21} fill={p.paper} opacity={0.5} rx={4.5} ry={2.8} transform="rotate(-30 25 21)" />
      </G>
    </Svg>
  );
};

const ColumnProp: SceneProp = ({ size, accent, muted, gid }) => {
  const p = paletteFor(accent, muted);
  return (
    <Svg height={size} viewBox="0 0 64 64" width={size}>
      <Defs>
        <TopLight from={p.light} id={`col-${gid}`} to={p.base} />
      </Defs>
      <Ground fill={p.shadow} rx={16} />
      {/* Capital. */}
      <Rect fill={p.deep} height={5} rx={2} width={34} x={15} y={9} />
      <Rect fill={`url(#col-${gid})`} height={5} rx={2} width={26} x={19} y={14} />
      {/* Fluted shaft. */}
      <Rect fill={`url(#col-${gid})`} height={26} rx={3} width={20} x={22} y={19} />
      <Line opacity={0.55} stroke={p.deep} strokeLinecap="round" strokeWidth={1.6} x1={27} x2={27} y1={22} y2={42} />
      <Line opacity={0.55} stroke={p.deep} strokeLinecap="round" strokeWidth={1.6} x1={32} x2={32} y1={22} y2={42} />
      <Line opacity={0.55} stroke={p.deep} strokeLinecap="round" strokeWidth={1.6} x1={37} x2={37} y1={22} y2={42} />
      {/* Base steps. */}
      <Rect fill={`url(#col-${gid})`} height={5} rx={2} width={26} x={19} y={45} />
      <Rect fill={p.deep} height={5} rx={2} width={34} x={15} y={50} />
    </Svg>
  );
};

const QuillProp: SceneProp = ({ size, accent, muted, gid }) => {
  const p = paletteFor(accent, muted);
  return (
    <Svg height={size} viewBox="0 0 64 64" width={size}>
      <Defs>
        <TopLight from={p.light} id={`qui-${gid}`} to={p.base} />
      </Defs>
      <Ground fill={p.shadow} rx={12} />
      {/* Feather blade. */}
      <Path
        d="M46 7 C 30 12, 20 28, 21 50 C 33 43, 42 30, 46.5 12 z"
        fill={`url(#qui-${gid})`}
        stroke={p.deep}
        strokeWidth={1.8}
      />
      {/* Rachis. */}
      <Path d="M22 49 C 27 34, 35 20, 45 9" fill="none" opacity={0.75} stroke={p.deep} strokeLinecap="round" strokeWidth={1.8} />
      {/* Nib + ink drop. */}
      <Path d="M21.5 50 l-3.5 6.5 l5.8 -3 z" fill={muted ? p.detail : colors.goldDeep} />
      <Circle cx={15} cy={57} fill={p.detail} r={1.8} />
    </Svg>
  );
};

// ---------------------------------------------------------------------------
// Sets per subject — French slugs (backend) + English aliases.
// ---------------------------------------------------------------------------

const BIOLOGY_SET: SceneProp[] = [DnaProp, CellProp, LeafProp, MicroscopeProp];
const CHEMISTRY_SET: SceneProp[] = [FlaskProp, MoleculeProp, TestTubesProp];
const PHYSICS_SET: SceneProp[] = [AtomProp, PlanetProp, MagnetProp, BoltChipProp];
export const CULTURE_SET: SceneProp[] = [BookProp, GlobeProp, ColumnProp, QuillProp];

const SETS_BY_SLUG: Record<string, SceneProp[]> = {
  biologie: BIOLOGY_SET,
  biology: BIOLOGY_SET,
  chimie: CHEMISTRY_SET,
  chemistry: CHEMISTRY_SET,
  physique: PHYSICS_SET,
  physics: PHYSICS_SET,
};

/** Prop set for a subject slug — culture set is the universal fallback. */
export function propSetFor(slug: string): SceneProp[] {
  return SETS_BY_SLUG[slug] ?? CULTURE_SET;
}

/**
 * Story scenes — reusable pseudo-3D clay pieces (depth via layering,
 * scale, occlusion, soft shadows, perspective ellipses and slow ambient
 * drift; NO real 3D). All pieces are token-driven, decorative (hidden
 * from screen readers, pointerEvents none) and static under reduced
 * motion.
 */

export { Ember, type EmberProps } from '@/features/scenes/Ember';
export {
  FloatingIsland,
  type FloatingIslandProps,
  type IslandPalette,
} from '@/features/scenes/FloatingIsland';
export {
  OrbitingProp,
  type OrbitingPropProps,
  type OrbitPropKind,
} from '@/features/scenes/OrbitingProp';
export { ParticleBurst, type ParticleBurstProps } from '@/features/scenes/ParticleBurst';
export { PodiumDisc, type PodiumDiscProps } from '@/features/scenes/PodiumDisc';
export { RadialRays, type RadialRaysProps } from '@/features/scenes/RadialRays';

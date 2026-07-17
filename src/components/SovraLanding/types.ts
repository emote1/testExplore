// Shared types for the SOVRA landing feature

export type FishType = 'regular' | 'large' | 'scout';

export interface Boid {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  type: FishType;
  speedMul: number;
  brightnessMul: number;
  gather: number;

  // Diving (after Esc with gathered fish): sinks then respawns at edge with noGather=true
  diving: boolean;
  divingAge: number;
  diveDeath?: number;

  // Formation (forming the search bar's pill outline)
  formTarget: Point | null;
  formStartX: number | null;
  formStartY: number | null;
  formStartTime: number | null;
  formDuration: number | null;
  formAngle: number | null;
  formPhase: number | null;
  formWag: number | null;
  formShimmer: number | null;
  formEnergetic: boolean;
  formEnergy: number;

  // After a fish dies (dive cycle), it respawns ungatherable — cost of the summon ritual
  noGather: boolean;

  // Orbit around the search bar (on focus) — replaces the old pill-outline formation.
  // Assigned in formSearchBar, advanced in the step loop, cleared in releaseFromFormation.
  orbitAngle: number | null;
  orbitA: number | null;
  orbitB: number | null;
  orbitSpeed: number | null;
  orbitWobble: number | null;
  lastOrbitTick: number | null;

  // Exile off-screen: non-orbit fish clear the stage on focus, then trickle back on blur.
  exiled: boolean;
  exileTarget: Point | null;
  returnAt: number | null;      // performance.now() timestamp when this fish starts returning
  returnTarget: Point | null;
  returnSpeed: number | null;
}

export interface AmbientParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  tw: number;       // twinkle (alpha factor)
  twSpeed: number;
}

export interface BurstParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface Bubble {
  x: number;
  y: number;
  vy: number;
  vx: number;
  radius: number;
  wobblePhase: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CursorState {
  x: number;
  y: number;
  active: boolean;
}

export interface DisturbanceState {
  x: number;
  y: number;
  strength: number;
}

export interface GuestFishState {
  // Reserved for the (removed) "fish through O ring" feature — kept for future use
}

/* ------------------- Component props / handles ------------------- */

export interface FlockBackgroundProps {
  particleCount?: number;
  ambientCount?: number;
  reactToCursor?: boolean;
  showConnections?: boolean;
  onGatherChange?: (count: number) => void;
  onCountsChange?: (counts: { formation: number; diving: number; noGather: number }) => void;
}

export interface FlockBackgroundHandle {
  /** Trigger a burst at a point (default: viewport center). */
  activate: (point?: Point) => void;
  /** Send all currently-gathered fish into a dive cycle (they respawn as noGather). */
  triggerDive: () => void;
  /**
   * Assign formation targets along the pill outline of `rect`.
   * `energetic`: when true, formation fish get a fading coral glow for 2s.
   */
  formSearchBar: (rect: Rect, energetic?: boolean) => void;
  /** Apply outward impulse to leftover gathered fish (called on first keystroke). */
  scatterGathered: () => void;
  /** Release fish from formation; they fly back into the flock as noGather. */
  releaseFromFormation: () => void;
}

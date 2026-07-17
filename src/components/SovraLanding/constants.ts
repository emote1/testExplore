// Tuning constants and color palettes for the SOVRA landing

/* Boid behavior */
export const PERCEPTION_RADIUS = 60;
export const PERCEPTION_RADIUS_SQ = PERCEPTION_RADIUS * PERCEPTION_RADIUS;
export const SEPARATION_RADIUS = 24;
export const SEPARATION_RADIUS_SQ = SEPARATION_RADIUS * SEPARATION_RADIUS;
export const MAX_SPEED = 1.3;
export const MIN_SPEED = 0.25;

/* Cursor */
export const CURSOR_FORCE = 0.15;
export const CURSOR_RADIUS = 280;
export const CURSOR_RADIUS_SQ = CURSOR_RADIUS * CURSOR_RADIUS;

/* Gather mechanic */
export const GATHER_RADIUS = 180;
export const GATHER_RADIUS_SQ = GATHER_RADIUS * GATHER_RADIUS;
export const GATHER_THRESHOLD = 40;

/* Render */
export const TRAIL_FADE = 'rgba(3, 22, 32, 0.20)';
export const AUTO_PULSE_MS = 8500;

/* Formation (search-bar pill) */
export const FORMATION_COUNT = 55;
export const FORMATION_DURATION_BASE = 2400;
export const FORMATION_DURATION_JITTER = 900;

/* Search-bar repulsion zone */
export const SB_MARGIN = 35;
export const SB_REPULSE_STRENGTH = 0.55;

/* Scatter */
export const SCATTER_FORCE = 4.5;
export const SCATTER_GATHER_THRESHOLD = 0.3;

/* Disturbance (predator wave) */
export const DISTURBANCE_MIN_MS = 45000;
export const DISTURBANCE_MAX_MS = 90000;
export const DISTURBANCE_RADIUS = 320;
export const DISTURBANCE_STRENGTH = 0.95;
export const DISTURBANCE_DECAY = 0.962;

/* Bubble spawn */
export const BUBBLE_SPAWN_MIN_MS = 1400;
export const BUBBLE_SPAWN_JITTER_MS = 2400;

/* Coral energy on formation fish after an energetic summon */
export const FORM_ENERGY_DURATION_MS = 2000;

/* ------------------- Palettes ------------------- */

/** Regular flock fish — aqua-leaning teal range */
export const PALETTE = [
  '#7DD3DA', '#5BC0D9', '#A8DFE5', '#36A299', '#4FB8C9',
];

/** Marine snow ambient particles — desaturated cream/beige */
export const PALETTE_SNOW = [
  '#D8D2C0', '#E2DCC8', '#CFC8B5', '#E8E1C9', '#C8C2AF', '#DDD5C0',
];

/** Scout fish — bright/cold accents */
export const PALETTE_SCOUT = [
  '#D5EEF1', '#E0F2F4', '#B8E0E5', '#A8DFE5', '#C8E6EA',
];

/** Large rare fish — split between warm coral (events) and deep aqua (shadow giants) */
export const PALETTE_LARGE = [
  '#FF8B6E', '#D8623F', '#FFA088',  // coral warm
  '#1F8092', '#36A299', '#0F6E68',  // deep cold
];

/* Brand palette references (used by HeroTitle/PerSearchBar styling) */
export const COLORS = {
  brandGradientTop: '#D5EEF1',
  brandGradientBottom: '#5BC0D9',
  tagDive: '#A8DFE5',
  tagDecode: '#5BC0D9',
  tagDecide: '#FF8B6E',
  coral: '#FF8B6E',
  coralDeep: '#D8623F',
  textPrimary: '#E8F1F3',
} as const;

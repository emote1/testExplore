// Deterministic pseudo-random generator. Same i+salt always returns same 0..1.
// Used to give each coral its own consistent "DNA" (tilt, hue, band step, etc.)
// without re-rolling on every render.
export function coralSeed(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Pastel reef palette — hue rotations applied on top of the metric's accent color.
// Weighted: teal/mint dominate, exotic hues are rare accents (matches reference reef look).
export const CORAL_HUES: readonly number[] = [
    0,    0,    0,  // teal (base) — x3 weight, ~30%
  -28,  -28,        // mint green — x2 weight, ~20%
   24,              // sky blue
  -52,              // sea green
   60,              // pale periwinkle
   90,              // lavender / soft violet
  140,              // rose / soft pink (rare accent)
] as const;

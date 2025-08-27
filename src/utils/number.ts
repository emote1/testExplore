/**
 * Numeric helpers
 *
 * toU64: best-effort conversion of various inputs (number|string|hex-like) to a non-negative integer (u64-ish).
 * - Floors decimals
 * - Interprets hex strings starting with 0x
 * - Returns fallback on NaN/invalid values
 */
export function toU64(value: unknown, fallback = 0): number {
  try {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value));
    if (typeof value === 'string') {
      const v = value.startsWith('0x') ? Number.parseInt(value.slice(2), 16) : Number.parseInt(value, 10);
      return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : fallback;
    }
    const v2 = Number(value as unknown as number | string);
    return Number.isFinite(v2) ? Math.max(0, Math.floor(v2)) : fallback;
  } catch {
    return fallback;
  }
}

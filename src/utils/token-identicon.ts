/**
 * Deterministic SVG token identicons.
 *
 * Inspired by reef-chain/react-lib: generates a unique but consistent
 * icon for any token address. Uses address hash to pick one of 10 color
 * palettes and generates an SVG with geometric patterns.
 */

// 10 distinct color palettes [primary, secondary, accent]
const PALETTES: [string, string, string][] = [
  ['#7c3aed', '#a78bfa', '#ede9fe'],  // violet
  ['#2563eb', '#60a5fa', '#dbeafe'],  // blue
  ['#0891b2', '#22d3ee', '#cffafe'],  // cyan
  ['#059669', '#34d399', '#d1fae5'],  // emerald
  ['#d97706', '#fbbf24', '#fef3c7'],  // amber
  ['#dc2626', '#f87171', '#fee2e2'],  // red
  ['#db2777', '#f472b6', '#fce7f3'],  // pink
  ['#7c3aed', '#c084fc', '#f5f3ff'],  // purple
  ['#0d9488', '#2dd4bf', '#ccfbf1'],  // teal
  ['#4f46e5', '#818cf8', '#e0e7ff'],  // indigo
];

// 10 geometric pattern generators (circle center coords + radii for variety)
const PATTERNS: Array<(p: string, s: string, a: string) => string> = [
  // 0: concentric rings
  (p, s, a) => `<circle cx="16" cy="16" r="14" fill="${a}"/><circle cx="16" cy="16" r="10" fill="${s}" opacity="0.5"/><circle cx="16" cy="16" r="6" fill="${p}"/>`,
  // 1: diamond
  (p, s, a) => `<circle cx="16" cy="16" r="14" fill="${a}"/><polygon points="16,4 28,16 16,28 4,16" fill="${s}" opacity="0.6"/><polygon points="16,8 24,16 16,24 8,16" fill="${p}"/>`,
  // 2: quarter split
  (p, s, a) => `<circle cx="16" cy="16" r="14" fill="${a}"/><path d="M16 2A14 14 0 0 1 30 16H16Z" fill="${p}"/><path d="M16 30A14 14 0 0 1 2 16H16Z" fill="${s}" opacity="0.7"/>`,
  // 3: horizontal bars
  (p, s, a) => `<circle cx="16" cy="16" r="14" fill="${a}"/><rect x="4" y="6" width="24" height="5" rx="2.5" fill="${p}"/><rect x="6" y="14" width="20" height="4" rx="2" fill="${s}" opacity="0.6"/><rect x="4" y="21" width="24" height="5" rx="2.5" fill="${p}"/>`,
  // 4: offset circles
  (p, s, a) => `<circle cx="16" cy="16" r="14" fill="${a}"/><circle cx="11" cy="12" r="7" fill="${p}" opacity="0.8"/><circle cx="21" cy="20" r="7" fill="${s}" opacity="0.7"/>`,
  // 5: cross
  (p, s, a) => `<circle cx="16" cy="16" r="14" fill="${a}"/><rect x="13" y="4" width="6" height="24" rx="3" fill="${p}"/><rect x="4" y="13" width="24" height="6" rx="3" fill="${s}" opacity="0.6"/>`,
  // 6: triangle up
  (p, s, a) => `<circle cx="16" cy="16" r="14" fill="${a}"/><polygon points="16,5 27,25 5,25" fill="${p}" opacity="0.85"/><polygon points="16,11 22,22 10,22" fill="${s}" opacity="0.5"/>`,
  // 7: hexagon
  (p, s, a) => `<circle cx="16" cy="16" r="14" fill="${a}"/><polygon points="16,4 27,10 27,22 16,28 5,22 5,10" fill="${s}" opacity="0.5"/><polygon points="16,8 23,12 23,20 16,24 9,20 9,12" fill="${p}"/>`,
  // 8: dots grid
  (p, s, a) => `<circle cx="16" cy="16" r="14" fill="${a}"/><circle cx="9" cy="9" r="3.5" fill="${p}"/><circle cx="23" cy="9" r="3.5" fill="${s}" opacity="0.7"/><circle cx="9" cy="23" r="3.5" fill="${s}" opacity="0.7"/><circle cx="23" cy="23" r="3.5" fill="${p}"/><circle cx="16" cy="16" r="3" fill="${p}" opacity="0.5"/>`,
  // 9: wave arcs
  (p, s, a) => `<circle cx="16" cy="16" r="14" fill="${a}"/><path d="M4 16c4-8 8-8 12 0s8 8 12 0" fill="none" stroke="${p}" stroke-width="3.5" stroke-linecap="round"/><path d="M4 22c4-6 8-6 12 0s8 6 12 0" fill="none" stroke="${s}" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>`,
];

/**
 * Sum all digits in the address string and return the last digit.
 * Same algorithm as reef-chain/react-lib getHashSumLastNr.
 */
function hashLastDigit(address: string): number {
  const sum = address
    .split('')
    .reduce((acc, ch) => {
      const n = parseInt(ch, 10);
      return Number.isNaN(n) ? acc : acc + n;
    }, 0)
    .toString(10);
  return parseInt(sum.slice(-1), 10);
}

/**
 * Generate a deterministic SVG data URI for a token address.
 * Returns a base64-encoded `data:image/svg+xml;base64,...` string.
 */
export function getTokenIdenticon(address: string): string {
  const idx = hashLastDigit(address);
  const paletteIdx = idx;
  // Use a secondary hash for pattern variety
  const hex = address.replace(/^0x/, '').toLowerCase();
  const patternIdx = hex.length >= 4
    ? parseInt(hex.slice(2, 4), 16) % 10
    : idx;

  const [p, s, a] = PALETTES[paletteIdx];
  const inner = PATTERNS[patternIdx](p, s, a);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">${inner}</svg>`;

  // btoa is available in browser; for SSR use Buffer
  if (typeof btoa === 'function') {
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

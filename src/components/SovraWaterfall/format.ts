// Formatting + small color helpers shared across the Waterfall components.

export function truncate(a: string): string {
  return a.length <= 12 ? a : a.slice(0, 5) + '…' + a.slice(-4);
}

export function fmtAmount(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}

export function fmtUsd(n: number): string {
  if (n < 0.01) return '<$0.01';
  if (n < 1000) return '$' + n.toFixed(2);
  return '$' + (n / 1000).toFixed(1) + 'K';
}

export function fmtAge(ms: number): string {
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (ms < 60000) return 'just now';
  if (ms < 3600000) return m + 'm ago';
  if (ms < 86400000) return h + 'h ago';
  return d + 'd ago';
}

/** Hex color + alpha -> rgba() string. */
export function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

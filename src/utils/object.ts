/**
 * Object path helpers
 */
export function get(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

export function getString(obj: unknown, path: string[]): string | undefined {
  const v = get(obj, path);
  return typeof v === 'string' ? v : undefined;
}

export function getNumber(obj: unknown, path: string[]): number | undefined {
  const v = get(obj, path);
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

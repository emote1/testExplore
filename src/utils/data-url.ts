/**
 * Data URL helpers
 * Supports parsing data:application/json payloads (base64 or URL-encoded)
 */
export function parseDataUrlJson(dataUrl: string): Record<string, unknown> | null {
  try {
    if (!dataUrl || !dataUrl.startsWith('data:')) return null;
    const comma = dataUrl.indexOf(',');
    if (comma < 0) return null;
    const meta = dataUrl.slice(5, comma);
    const payload = dataUrl.slice(comma + 1);
    const isBase64 = /;base64/i.test(meta);
    const decoded = isBase64 ? decodeBase64(payload) : decodeURIComponent(payload);
    const json = JSON.parse(decoded) as unknown;
    if (!json || typeof json !== 'object') return null;
    return json as Record<string, unknown>;
  } catch {
    return null;
  }
}

function decodeBase64(input: string): string {
  // Prefer browser atob when available
  const atobFn = (globalThis as unknown as { atob?: (s: string) => string }).atob;
  if (typeof atobFn === 'function') return atobFn(input);
  // Fallback to Node Buffer if present
  const B = (globalThis as unknown as { Buffer?: { from: (s: string, enc: string) => { toString: (enc: string) => string } } }).Buffer;
  if (B && typeof B.from === 'function') return B.from(input, 'base64').toString('utf-8');
  // Last resort: manual decode (limited)
  throw new Error('Base64 decoding not supported in this environment');
}

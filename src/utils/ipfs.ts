// Shared IPFS URL helpers
// Use named exports; no React components here.

export const DEFAULT_IPFS_GATEWAYS: readonly string[] = [
  'https://ipfs.io/ipfs/',
  'https://reef.infura-ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
];

export interface BuildCandidatesOptions {
  gateways?: string[];
}

// Read env in a Vite-friendly way without importing types.
const ENV = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env) ?? {};

function ensureIpfsGatewayBase(gateway: string): string {
  let base = (gateway || '').trim();
  if (!base) return '';
  // Remove trailing slashes for normalization
  base = base.replace(/\/+$/, '');
  // Ensure `/ipfs/` suffix
  if (/\/ipfs$/i.test(base)) return `${base}/`;
  if (/\/ipfs\/$/i.test(base)) return base;
  return `${base}/ipfs/`;
}

export function resolveIpfsGateways(): string[] {
  try {
    const list = (ENV.VITE_IPFS_GATEWAYS ?? '').split(',').map((s) => ensureIpfsGatewayBase(s)).filter(Boolean);
    if (list.length > 0) {
      // Dedup while preserving order
      const seen = new Set<string>();
      return list.filter((g) => (seen.has(g) ? false : (seen.add(g), true)));
    }
    const single = ensureIpfsGatewayBase(ENV.VITE_IPFS_GATEWAY ?? '');
    if (single) return [single];
  } catch {
    // ignore
  }
  return [...DEFAULT_IPFS_GATEWAYS];
}

export function isIpfsLike(url?: string | null): boolean {
  return !!toCidPath(url ?? undefined);
}

// Extract "<cid>/<path>" from various IPFS URL shapes.
function extractIpfsCidPath(url: string): string | null {
  try {
    if (!url) return null;
    // ipfs://<cid>/<path> or ipfs://ipfs/<cid>/<path>
    if (url.startsWith('ipfs://')) {
      let rest = url.slice('ipfs://'.length);
      // strip leading ipfs/ if present
      rest = rest.replace(/^ipfs\/+/, '');
      return rest.length ? rest : null;
    }
    // http(s)://<host>/ipfs/<cid>/<path>
    const m = url.match(/\/(?:ipfs)\/([^?#]+)/i);
    if (m && m[1]) return m[1];
    // Subdomain gateway: https://<cid>.ipfs.<gateway>/<path>
    // Accept base32 (lowercase) and base58 (mixed), keep it lenient.
    const sub = url.match(/^https?:\/\/([a-z0-9]+)\.ipfs\.[^/]+\/?([^?#]*)/i);
    if (sub && sub[1]) {
      const cid = sub[1];
      const rest = sub[2] ?? '';
      return rest ? `${cid}/${rest}` : cid;
    }
    return null;
  } catch {
    return null;
  }
}

export function toCidPath(url?: string | null): string | null {
  if (!url) return null;
  return extractIpfsCidPath(url);
}

// Conservative conversion: only transform ipfs:// URIs into HTTP gateway.
// Do NOT rewrite existing http(s) IPFS gateway URLs here to avoid unexpected origin changes.
export function toIpfsHttp(url?: string | null, gateway: string = DEFAULT_IPFS_GATEWAYS[0]): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('ipfs://')) {
    const cidPath = extractIpfsCidPath(url);
    if (!cidPath) return undefined;
    // Ensure single trailing slash in gateway
    const base = gateway.endsWith('/') ? gateway : `${gateway}/`;
    return `${base}${cidPath}`;
  }
  return url;
}

export function buildCandidates(url?: string | null, gateways: string[] = resolveIpfsGateways()): string[] {
  if (!url) return [];
  const cid = toCidPath(url);
  if (!cid) return [url];
  return gateways.map((g) => {
    const base = g.endsWith('/') ? g : `${g}/`;
    return `${base}${cid}`;
  });
}

// Aggressive normalization to a single gateway for UI consistency.
// Converts ipfs://, /ipfs/<cid>, and subdomain gateways to the selected gateway.
export function normalizeIpfs(url?: string | null, gateway: string = DEFAULT_IPFS_GATEWAYS[0]): string | undefined {
  if (!url) return undefined;
  const cid = toCidPath(url);
  if (!cid) return url;
  const base = gateway.endsWith('/') ? gateway : `${gateway}/`;
  return `${base}${cid}`;
}

// Try candidates in order until one returns ok. Returns the first ok Response, or the last failed Response/null.
export async function fetchIpfsWithFallback(url?: string | null, init?: RequestInit, gateways?: string[]): Promise<Response | null> {
  try {
    if (!url) return null;
    const candidates = buildCandidates(url, gateways ?? resolveIpfsGateways());
    if (candidates.length === 0) return null;
    let lastResp: Response | null = null;
    const used = new Set<string>();
    for (const c of candidates) {
      if (used.has(c)) continue;
      used.add(c);
      try {
        const resp = await fetch(c as RequestInfo, init);
        if (resp && resp.ok) return resp;
        lastResp = resp;
      } catch {
        // ignore and try next
        continue;
      }
    }
    return lastResp;
  } catch {
    return null;
  }
}

// Minimal EVM JSON-RPC helpers to call Reefswap Factory/Pair without external deps
// NOTE: Keep lean; use fixed 4byte selectors and simple hex encoding.

const ENV = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env) ?? {};
const EVM_RPC_URL: string = ENV.VITE_REEF_EVM_RPC_URL ?? 'https://rpc.reefscan.com';

// UniswapV2-compatible selectors
const SELECTORS = {
  getPair: '0xe6a43905', // getPair(address,address)
  token0: '0x0dfe1681', // token0()
  token1: '0xd21220a7', // token1()
  getReserves: '0x0902f1ac', // getReserves()
} as const;

function strip0x(h: string): string {
  return h.startsWith('0x') ? h.slice(2) : h;
}
function pad32(hex: string): string {
  const s = strip0x(hex).toLowerCase();
  return s.padStart(64, '0');
}
function encodeAddress(addr: string): string {
  const a = strip0x(addr).toLowerCase();
  if (a.length !== 40) return a.padStart(40, '0').slice(-40);
  return a;
}
function buildData(selector: string, params: string[]): string {
  return selector + params.join('');
}

async function rpcCall(method: string, params: unknown[]): Promise<any> {
  const body = { jsonrpc: '2.0', id: 1, method, params };
  const res = await fetch(EVM_RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`RPC ${method} failed: ${res.status}`);
  const json = await res.json().catch(() => null) as any;
  if (!json || json.error) throw new Error(`RPC error: ${JSON.stringify(json?.error ?? {})}`);
  return json.result;
}

export async function ethCall(to: string, data: string): Promise<string | null> {
  // HTTP JSON-RPC call to configured endpoint
  try {
    const result = await rpcCall('eth_call', [{ to, data }, 'latest']);
    return typeof result === 'string' ? result : null;
  } catch {
    return null;
  }
}

export function encodeGetPairData(tokenA: string, tokenB: string): string {
  const a = pad32(encodeAddress(tokenA));
  const b = pad32(encodeAddress(tokenB));
  return buildData(SELECTORS.getPair, [a, b]);
}
export const encodeToken0Data = (): string => SELECTORS.token0;
export const encodeToken1Data = (): string => SELECTORS.token1;
export const encodeGetReservesData = (): string => SELECTORS.getReserves;

export function decodeAddress(retHex: string): string | null {
  try {
    const s = strip0x(retHex);
    if (s.length < 64) return null;
    const word = s.slice(0, 64);
    // address is right-aligned in 32 bytes
    const addr = word.slice(24);
    return '0x' + addr;
  } catch { return null; }
}
export function decodeGetReserves(retHex: string): { reserve0: bigint; reserve1: bigint } | null {
  try {
    const s = strip0x(retHex);
    if (s.length < 64 * 3) return null;
    const r0 = BigInt('0x' + s.slice(0, 64));
    const r1 = BigInt('0x' + s.slice(64, 128));
    return { reserve0: r0, reserve1: r1 };
  } catch { return null; }
}

export const REEF_TOKEN_ADDRESS = '0x0000000000000000000000000000000001000000';

// Return factory candidates (env override first). New default first, then legacy.
export function getFactoryCandidates(): string[] {
  const envFactory = ENV.VITE_REEFSWAP_FACTORY?.trim();
  const list: string[] = [];
  if (envFactory && /^0x[0-9a-fA-F]{40}$/.test(envFactory)) list.push(envFactory);
  // New deployment (reef-chain/reefswap deployments.json)
  list.push('0xe8f4D9308DC06D1D570117B1656C26F515aF22a7');
  // Legacy UI factory
  list.push('0x380a9033500154872813F6E1120a81ed6c0760a8');
  return list;
}

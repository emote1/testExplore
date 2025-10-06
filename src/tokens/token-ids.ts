// Token id sets and helpers shared across hooks/components

const STORAGE_AVAILABLE = typeof window !== 'undefined' && !!window.localStorage;
export const USDC_STORAGE_KEY = 'reef.session.usdc.ids.v1';
export const MRD_STORAGE_KEY = 'reef.session.mrd.ids.v1';
const IDS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function loadIds(key: string): string[] {
  try {
    if (!STORAGE_AVAILABLE) return [];
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.ids) || typeof parsed.ts !== 'number') return [];
    if (Date.now() - parsed.ts > IDS_TTL_MS) return [];
    return (parsed.ids as string[]).map(s => String(s).toLowerCase()).filter(Boolean);
  } catch { return []; }
}
export function saveIds(key: string, ids: Set<string>) {
  try {
    if (!STORAGE_AVAILABLE) return;
    const arr = Array.from(ids);
    window.localStorage.setItem(key, JSON.stringify({ ids: arr, ts: Date.now() }));
  } catch { /* ignore */ }
}

const USDC_ENV_RAW = (import.meta as any)?.env?.VITE_USDC_CONTRACT_IDS as string | undefined;
const USDC_ENV = (USDC_ENV_RAW || '')
  .split(',')
  .map((s: string) => s.trim().toLowerCase())
  .filter(Boolean);
const USDC_DEFAULTS = ['0x7922d8785d93e692bb584e659b607fa821e6a91a'];
export const USDC_ID_SET = new Set<string>(USDC_ENV.length > 0 ? USDC_ENV : USDC_DEFAULTS);
export const USDC_SESSION_SET = new Set<string>();
export const isUsdcId = (id?: string) => {
  if (!id) return false;
  const s = String(id).toLowerCase();
  return USDC_ID_SET.has(s) || USDC_SESSION_SET.has(s);
};

const MRD_ENV_RAW = (import.meta as any)?.env?.VITE_MRD_CONTRACT_IDS as string | undefined;
const MRD_ENV = (MRD_ENV_RAW || '')
  .split(',')
  .map((s: string) => s.trim().toLowerCase())
  .filter(Boolean);
const MRD_DEFAULTS = ['0x95a2af50040b7256a4b4c405a4afd4dd573da115'];
export const MRD_ID_SET = new Set<string>(MRD_ENV.length > 0 ? MRD_ENV : MRD_DEFAULTS);
export const MRD_SESSION_SET = new Set<string>();
export const isMrdId = (id?: string) => {
  if (!id) return false;
  const s = String(id).toLowerCase();
  return MRD_ID_SET.has(s) || MRD_SESSION_SET.has(s);
};

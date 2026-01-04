import { getNumber, getString } from './object';
import { normalizeIpfs } from './ipfs';
import { parseTimestampToDate } from './formatters';

/**
 * Validates if a token is REEF based on its name and decimals.
 */
export function isReefToken(tok?: { name?: string; decimals?: number }): boolean {
  return !!tok && tok.name === 'REEF' && (tok.decimals ?? 18) === 18;
}

/**
 * Normalizes timestamps to epoch milliseconds for stable sorting.
 */
export function toEpochMs(ts: string | number | Date | null | undefined): number {
  if (ts == null) return -Infinity;
  const d = parseTimestampToDate(ts as string | number | Date);
  return d ? d.getTime() : -Infinity;
}

/**
 * Converts a raw amount string to a float number based on decimals.
 */
export function toFloatAmount(amountStr: string, decimals: number): number {
  const s = (amountStr || '').trim();
  if (!/^\d+$/.test(s)) return 0;
  if (decimals === 0) return Number(s);
  if (s.length <= decimals) {
    const pad = s.padStart(decimals, '0');
    return Number(`0.${pad}`);
  }
  const head = s.slice(0, s.length - decimals);
  const tail = s.slice(s.length - decimals);
  return Number(`${head}.${tail}`);
}

const usdcNameSynonyms = new Set(['usdc', 'usdc.e', 'usd coin']);

/**
 * Checks if a token name matches known USDC synonyms.
 */
export function isUsdcByName(tok?: { name?: string | null }): boolean {
  const nm = (tok?.name || '').toString().toLowerCase();
  return !!nm && usdcNameSynonyms.has(nm);
}

/**
 * Safely parses a value to BigInt, returning 0n on failure.
 * Handles absolute values if requested.
 */
export function safeBigInt(v: unknown, absolute = false): bigint {
  try {
    if (v == null) return 0n;
    let bi = BigInt(String(v));
    if (absolute && bi < 0n) bi = -bi;
    return bi;
  } catch {
    return 0n;
  }
}

/**
 * Parses token metadata from contractData JSON.
 */
export interface TokenMeta {
  name: string;
  decimals: number;
  image?: string;
}

export function parseTokenMetadata(
  contractDataRaw: unknown,
  fallbackName: string = 'TOKEN',
  fallbackDecimals: number = 18
): TokenMeta {
  if (!contractDataRaw) return { name: fallbackName, decimals: fallbackDecimals };
  try {
    const cd: unknown = typeof contractDataRaw === 'string' ? JSON.parse(contractDataRaw) : contractDataRaw;
    const symbol = getString(cd, ['symbol']);
    const decimals = getNumber(cd, ['decimals']);
    
    // Extensive list of possible image fields in contract metadata
    const img =
      getString(cd, ['icon'])
      || getString(cd, ['iconUrl'])
      || getString(cd, ['iconURL'])
      || getString(cd, ['icon_url'])
      || getString(cd, ['logo'])
      || getString(cd, ['logoURI'])
      || getString(cd, ['logoUrl'])
      || getString(cd, ['logoURL'])
      || getString(cd, ['logo_url'])
      || getString(cd, ['image'])
      || getString(cd, ['imageUrl'])
      || getString(cd, ['imageURL'])
      || getString(cd, ['image_url'])
      || getString(cd, ['metadata', 'image'])
      || getString(cd, ['metadata', 'imageUrl'])
      || getString(cd, ['metadata', 'imageURL'])
      || getString(cd, ['metadata', 'logoURI'])
      || getString(cd, ['metadata', 'logoUrl'])
      || getString(cd, ['metadata', 'logoURL'])
      || getString(cd, ['metadata', 'icon'])
      || getString(cd, ['metadata', 'iconUrl'])
      || getString(cd, ['metadata', 'iconURL'])
      || undefined;
      
    const image = img ? normalizeIpfs(img) : undefined;
    return { name: symbol || fallbackName, decimals: decimals ?? fallbackDecimals, image };
  } catch {
    return { name: fallbackName, decimals: fallbackDecimals };
  }
}

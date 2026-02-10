import { xxhashAsHex } from '@polkadot/util-crypto';
import { decodeAddress } from '@polkadot/util-crypto';
import { u8aToHex } from '@polkadot/util';

const REEF_RPC_URL = 'https://rpc.reefscan.info';
const META_TTL_MS = 30 * 60 * 1000;

export interface ValidatorMeta {
  name: string | null;
  commissionPct: number | null;
}

let cachedMeta: { data: Map<string, ValidatorMeta>; ts: number } | null = null;

function storageKey(palletName: string, storageName: string, accountSs58: string): string {
  const palletHash = xxhashAsHex(palletName, 128).slice(2);
  const storageHash = xxhashAsHex(storageName, 128).slice(2);
  const pubkey = decodeAddress(accountSs58);
  const pubkeyHex = u8aToHex(pubkey).slice(2);
  const keyHash = xxhashAsHex(pubkey, 64).slice(2);
  return '0x' + palletHash + storageHash + keyHash + pubkeyHex;
}

function decodeIdentityName(hex: string): string | null {
  try {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    const bytes = new Uint8Array(clean.match(/.{2}/g)!.map((b) => parseInt(b, 16)));

    // Registration = { judgements: Vec<(u32,Judgement)>, deposit: u128, info: IdentityInfo }
    // IdentityInfo starts with `display: Data` where Data enum:
    //   0x00 = None, 0x01 = Raw0, 0x02 = Raw1, ... 0x21 = Raw32
    //   tag byte value = 1 + byteLength for Raw variants
    // Skip: judgements vec (compact len) + deposit (u128 = 16 bytes)

    let offset = 0;
    // judgements vec: compact length
    const jLen = bytes[offset] >> 2; // compact u32, assuming small
    offset += 1; // compact byte
    // skip judgements entries (each is u32 + Judgement enum + optional data)
    for (let j = 0; j < jLen; j++) {
      offset += 4; // registrar index u32
      if (offset >= bytes.length) return null;
      const variant = bytes[offset];
      offset += 1; // Judgement enum variant
      // FeePaid(Balance) = variant 1, contains u128
      if (variant === 1) offset += 16;
    }
    // deposit: u128 LE = 16 bytes
    offset += 16;

    // IdentityInfo.additional: BoundedVec<(Data, Data)>
    // compact vec length
    if (offset >= bytes.length) return null;
    const addlLen = bytes[offset] >> 2;
    offset += 1;
    // skip each (Data, Data) pair
    for (let a = 0; a < addlLen; a++) {
      for (let d = 0; d < 2; d++) {
        if (offset >= bytes.length) return null;
        const dt = bytes[offset];
        offset += 1;
        if (dt >= 1 && dt <= 33) offset += dt - 1;
      }
    }

    // IdentityInfo.display (Data enum)
    if (offset >= bytes.length) return null;
    const tag = bytes[offset];
    offset += 1;
    if (tag === 0) return null; // None
    if (tag >= 1 && tag <= 33) {
      // Raw variant: length = tag - 1
      const len = tag - 1;
      if (offset + len > bytes.length || len === 0) return null;
      const name = new TextDecoder().decode(bytes.slice(offset, offset + len));
      if (/[a-zA-Z]/.test(name)) return name;
    }
    return null;
  } catch {
    return null;
  }
}

function decodeCompact(bytes: Uint8Array, offset: number): { value: number; len: number } | null {
  if (offset >= bytes.length) return null;
  const mode = bytes[offset] & 0x03;
  if (mode === 0) return { value: bytes[offset] >> 2, len: 1 };
  if (mode === 1) {
    if (offset + 1 >= bytes.length) return null;
    return { value: (bytes[offset] | (bytes[offset + 1] << 8)) >> 2, len: 2 };
  }
  if (mode === 2) {
    if (offset + 3 >= bytes.length) return null;
    const v = (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 2;
    return { value: v, len: 4 };
  }
  return null;
}

function decodeCommission(hex: string): number | null {
  try {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (clean.length < 2) return null;
    const bytes = new Uint8Array(clean.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
    const compact = decodeCompact(bytes, 0);
    if (!compact) return null;
    return compact.value / 1_000_000_000 * 100;
  } catch {
    return null;
  }
}

async function rpcBatch(calls: { method: string; params: string[] }[]): Promise<(string | null)[]> {
  const batch = calls.map((c, i) => ({ jsonrpc: '2.0', id: i + 1, method: c.method, params: c.params }));
  const res = await fetch(REEF_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(batch),
  });
  if (!res.ok) return calls.map(() => null);
  const responses = await res.json();
  const sorted = Array.isArray(responses) ? [...responses].sort((a: { id: number }, b: { id: number }) => a.id - b.id) : [];
  return calls.map((_, i) => sorted[i]?.result ?? null);
}

export async function fetchValidatorsMeta(addresses: string[]): Promise<Map<string, ValidatorMeta>> {
  if (cachedMeta && Date.now() - cachedMeta.ts < META_TTL_MS) {
    const allCached = addresses.every((a) => cachedMeta!.data.has(a));
    if (allCached) return cachedMeta.data;
  }

  const result = new Map<string, ValidatorMeta>();
  if (addresses.length === 0) return result;

  try {
    // Batch 1: IdentityOf + Staking.Validators for all addresses
    const calls1 = [
      ...addresses.map((a) => ({ method: 'state_getStorage', params: [storageKey('Identity', 'IdentityOf', a)] })),
      ...addresses.map((a) => ({ method: 'state_getStorage', params: [storageKey('Staking', 'Validators', a)] })),
    ];
    const res1 = await rpcBatch(calls1);
    const n = addresses.length;

    for (let i = 0; i < n; i++) {
      const identityHex = res1[i];
      const validatorHex = res1[n + i];
      const name = typeof identityHex === 'string' ? decodeIdentityName(identityHex) : null;
      const commissionPct = typeof validatorHex === 'string' ? decodeCommission(validatorHex) : null;
      result.set(addresses[i], { name, commissionPct });
    }

    cachedMeta = { data: result, ts: Date.now() };
    return result;
  } catch {
    return result;
  }
}

// Native (REEF) balance breakdown for the `account` table.
//
// The source of truth is on-chain `system.account(addr)`, exactly what Subsquid
// reads. We store the four Substrate balance facets so the frontend can show the
// *available* (transferable) balance — free minus what staking/locks freeze:
//   free      = data.free
//   reserved  = data.reserved
//   locked    = data.frozen           (newer runtime)
//             = max(miscFrozen, feeFrozen)  (older runtime — Reef uses this)
//   available = max(0, free - locked)  (transferable; locked is the staking bond etc.)
//
// EVM-keyed account rows (id = 0x… 40-hex) are NOT real Substrate accounts —
// their REEF lives on a bound native account — so they are skipped here. The
// lake always resolves the input address to its native id before querying.

export interface AccountBalanceRow {
  id: string;        // native SS58 account id
  free: string;      // raw u128 (18 decimals)
  reserved: string;
  locked: string;
  available: string;
}

const EVM_ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

/** True for native SS58 ids (i.e. not an 0x… EVM address). */
export function isNativeAccount(id: string): boolean {
  return !EVM_ADDR_RE.test(id);
}

function toBig(v: unknown): bigint {
  try {
    return BigInt((v as { toString(): string })?.toString() ?? '0');
  } catch {
    return 0n;
  }
}

function bigMax(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

/** Decode one `system.account` AccountInfo into our balance row. */
export function decodeBalance(id: string, info: unknown): AccountBalanceRow {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (info as any)?.data ?? {};
  const free = toBig(data.free);
  const reserved = toBig(data.reserved);
  const frozen = data.frozen !== undefined && data.frozen !== null
    ? toBig(data.frozen)
    : bigMax(toBig(data.miscFrozen), toBig(data.feeFrozen));
  const available = free > frozen ? free - frozen : 0n;
  return {
    id,
    free: free.toString(),
    reserved: reserved.toString(),
    locked: frozen.toString(),
    available: available.toString(),
  };
}

/**
 * Read the current on-chain balance breakdown for a set of native account ids.
 * Non-native ids are skipped. `api` may be the live ApiPromise (latest state —
 * what we want for "current balance") or an ApiDecoration at a block hash.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchBalances(api: any, ids: string[]): Promise<AccountBalanceRow[]> {
  const natives = ids.filter(isNativeAccount);
  if (natives.length === 0) return [];
  const infos = await api.query.system.account.multi(natives);
  return natives.map((id: string, i: number) => decodeBalance(id, infos[i]));
}

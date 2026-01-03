import type { TransferWhereInput, TransferType } from '@/gql/graphql';
import { toChecksumAddress } from '@/utils/address-helpers';
import { safeBigInt } from '@/utils/token-helpers';

interface BuildFilterParams {
  resolvedAddress?: string | null;
  resolvedEvmAddress?: string | null;
  direction?: TransactionDirection;
  /** Minimum amount for REEF (Native) in raw units (10^18). If provided, filter will include only Native transfers with amount >= this value. */
  minReefRaw?: string | bigint | null;
  /** Maximum amount for REEF (Native) in raw units (10^18). If provided, filter will include only Native transfers with amount <= this value. */
  maxReefRaw?: string | bigint | null;
  /** When true, restrict results to REEF (Native) transfers even if no amount range is provided. */
  reefOnly?: boolean;
  /** Restrict results to specific token contract ids (lowercased). Enables optional token amount range. */
  tokenIds?: string[] | null;
  /** Minimum amount for selected token (raw). Applied only when tokenIds is provided. */
  tokenMinRaw?: string | bigint | null;
  /** Maximum amount for selected token (raw). Applied only when tokenIds is provided. */
  tokenMaxRaw?: string | bigint | null;
  /** When true and tokenIds are not provided, restrict to ERC20 tokens to narrow fallback. */
  erc20Only?: boolean;
  /** When true, exclude swap legs from results (reefswapAction is null). */
  excludeSwapLegs?: boolean;
}

export type TransactionDirection = 'any' | 'incoming' | 'outgoing';

// Builds a TransferWhereInput with OR over native id and EVM address.
// Returns undefined if neither address is provided.
export function buildTransferWhereFilter({
  resolvedAddress,
  resolvedEvmAddress,
  direction = 'any',
  minReefRaw = null,
  maxReefRaw = null,
  reefOnly = false,
  tokenIds = null,
  tokenMinRaw = null,
  tokenMaxRaw = null,
  erc20Only = false,
  excludeSwapLegs = false,
}: BuildFilterParams): TransferWhereInput | undefined {
  const orClauses: NonNullable<TransferWhereInput['OR']> = [];
  const wantIncoming = direction === 'any' || direction === 'incoming';
  const wantOutgoing = direction === 'any' || direction === 'outgoing';

  if (resolvedAddress) {
    if (wantOutgoing) orClauses.push({ from: { id_eq: resolvedAddress } });
    if (wantIncoming) orClauses.push({ to: { id_eq: resolvedAddress } });
  }
  if (resolvedEvmAddress) {
    if (wantOutgoing) orClauses.push({ fromEvmAddress_eq: resolvedEvmAddress });
    if (wantIncoming) orClauses.push({ toEvmAddress_eq: resolvedEvmAddress });
  }

  if (orClauses.length === 0) return undefined;
  const base: TransferWhereInput = { OR: orClauses } as TransferWhereInput;

  const hasTokenIds = Array.isArray(tokenIds) && tokenIds.length > 0;
  const hasTokenMin = tokenMinRaw != null && safeBigInt(tokenMinRaw) > 0n;
  const hasTokenMax = tokenMaxRaw != null && safeBigInt(tokenMaxRaw) > 0n;

  if (hasTokenIds) {
    const tokenOrClauses: Array<any> = [];
    const normalize0x = (v: string) => v.startsWith('0x') ? v : `0x${v}`;

    for (const id of (tokenIds as string[])) {
      const sRaw = String(id || '');
      if (!sRaw) continue;
      const s = normalize0x(sRaw);
      const lower = s.toLowerCase();
      const checksum = toChecksumAddress(s);
      // Deduplicate variants
      const variants = Array.from(new Set([s, lower, checksum]));
      for (const v of variants) tokenOrClauses.push({ id_eq: v });
    }
    const tokenFilter: any = tokenOrClauses.length > 1 ? { OR: tokenOrClauses } : (tokenOrClauses[0] || {});
    const andClauses: NonNullable<TransferWhereInput['AND']> = [base, { token: tokenFilter } as any];
    if (hasTokenMin) andClauses.push({ amount_gte: safeBigInt(tokenMinRaw!).toString() });
    if (hasTokenMax) andClauses.push({ amount_lte: safeBigInt(tokenMaxRaw!).toString() });
    let result: TransferWhereInput = { AND: andClauses } as TransferWhereInput;
    if (excludeSwapLegs) {
      result = { AND: [result, { reefswapAction_isNull: true } as any] } as any;
    }
    return result;
  }

  const hasMin = minReefRaw != null && safeBigInt(minReefRaw) > 0n;
  const hasMax = maxReefRaw != null && safeBigInt(maxReefRaw) > 0n;
  if (reefOnly || hasMin || hasMax) {
    const andClauses: NonNullable<TransferWhereInput['AND']> = [base, { type_eq: 'Native' as TransferType }];
    if (hasMin) andClauses.push({ amount_gte: safeBigInt(minReefRaw!).toString() });
    let result: TransferWhereInput = { AND: andClauses } as TransferWhereInput;
    if (excludeSwapLegs) {
      result = { AND: [result, { reefswapAction_isNull: true } as any] } as any;
    }
    return result;
  }

  if (erc20Only) {
    const andClauses: NonNullable<TransferWhereInput['AND']> = [base, { token: { type_eq: 'ERC20' as any } } as any];
    let result: TransferWhereInput = { AND: andClauses } as TransferWhereInput;
    if (excludeSwapLegs) {
      result = { AND: [result, { reefswapAction_isNull: true } as any] } as any;
    }
    return result;
  }

  if (excludeSwapLegs) {
    return { AND: [base, { reefswapAction_isNull: true } as any] } as any;
  }
  return base;
}

import type { TransferWhereInput, TransferType } from '@/gql/graphql';
import { toChecksumAddress } from '@/utils/address-helpers';
import { safeBigInt } from '@/utils/token-helpers';

const ENV = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env) ?? {};
const EXPLORER_HTTP_URL = ENV.VITE_REEF_EXPLORER_HTTP_URL ?? '';

export const isHasuraExplorerMode = EXPLORER_HTTP_URL.includes('/v1/graphql');

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

export type TransferWhere = TransferWhereInput | Record<string, unknown>;

export function buildTransferOrderBy(): unknown {
  if (isHasuraExplorerMode) {
    return [{ timestamp: 'desc' }, { id: 'desc' }];
  }
  return ['timestamp_DESC', 'id_DESC'];
}

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
}: BuildFilterParams): TransferWhere | undefined {
  if (isHasuraExplorerMode) {
    return buildTransferWhereFilterHasura({
      resolvedAddress,
      resolvedEvmAddress,
      direction,
      minReefRaw,
      maxReefRaw,
      reefOnly,
      tokenIds,
      tokenMinRaw,
      tokenMaxRaw,
      erc20Only,
      excludeSwapLegs,
    });
  }

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
    const tokenOrClauses: Array<{ id_eq: string }> = [];
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
    const tokenFilter = tokenOrClauses.length > 1 ? { OR: tokenOrClauses } : (tokenOrClauses[0] || {});
    const andClauses: NonNullable<TransferWhereInput['AND']> = [base, { token: tokenFilter }];
    if (hasTokenMin) andClauses.push({ amount_gte: safeBigInt(tokenMinRaw!).toString() });
    if (hasTokenMax) andClauses.push({ amount_lte: safeBigInt(tokenMaxRaw!).toString() });
    let result: TransferWhereInput = { AND: andClauses };
    if (excludeSwapLegs) {
      result = { AND: [result, { reefswapAction_isNull: true }] };
    }
    return result;
  }

  const hasMin = minReefRaw != null && safeBigInt(minReefRaw) > 0n;
  const hasMax = maxReefRaw != null && safeBigInt(maxReefRaw) > 0n;
  if (reefOnly || hasMin || hasMax) {
    const andClauses: NonNullable<TransferWhereInput['AND']> = [base, { type_eq: 'Native' as TransferType }];
    if (hasMin) andClauses.push({ amount_gte: safeBigInt(minReefRaw!).toString() });
    if (hasMax) andClauses.push({ amount_lte: safeBigInt(maxReefRaw!).toString() });
    let result: TransferWhereInput = { AND: andClauses };
    if (excludeSwapLegs) {
      result = { AND: [result, { reefswapAction_isNull: true }] };
    }
    return result;
  }

  if (erc20Only) {
    const andClauses: NonNullable<TransferWhereInput['AND']> = [base, { token: { type_eq: 'ERC20' } }];
    let result: TransferWhereInput = { AND: andClauses };
    if (excludeSwapLegs) {
      result = { AND: [result, { reefswapAction_isNull: true }] };
    }
    return result;
  }

  if (excludeSwapLegs) {
    return { AND: [base, { reefswapAction_isNull: true }] };
  }
  return base;
}

function buildTransferWhereFilterHasura({
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
}: BuildFilterParams): Record<string, unknown> | undefined {
  const orClauses: Array<Record<string, unknown>> = [];
  const wantIncoming = direction === 'any' || direction === 'incoming';
  const wantOutgoing = direction === 'any' || direction === 'outgoing';

  if (resolvedAddress) {
    if (wantOutgoing) orClauses.push({ from_id: { _eq: resolvedAddress } });
    if (wantIncoming) orClauses.push({ to_id: { _eq: resolvedAddress } });
  }
  if (resolvedEvmAddress) {
    if (wantOutgoing) orClauses.push({ from_evm_address: { _eq: resolvedEvmAddress } });
    if (wantIncoming) orClauses.push({ to_evm_address: { _eq: resolvedEvmAddress } });
  }

  if (orClauses.length === 0) return undefined;

  const andClauses: Array<Record<string, unknown>> = [{ _or: orClauses }];

  const hasTokenIds = Array.isArray(tokenIds) && tokenIds.length > 0;
  const hasTokenMin = tokenMinRaw != null && safeBigInt(tokenMinRaw) > 0n;
  const hasTokenMax = tokenMaxRaw != null && safeBigInt(tokenMaxRaw) > 0n;

  if (hasTokenIds) {
    const tokenIdVariants: string[] = [];
    const normalize0x = (v: string) => (v.startsWith('0x') ? v : `0x${v}`);
    for (const id of tokenIds as string[]) {
      const sRaw = String(id || '');
      if (!sRaw) continue;
      const s = normalize0x(sRaw);
      const lower = s.toLowerCase();
      const checksum = toChecksumAddress(s);
      for (const v of Array.from(new Set([s, lower, checksum]))) tokenIdVariants.push(v);
    }
    const uniqueTokenIds = Array.from(new Set(tokenIdVariants));
    if (uniqueTokenIds.length > 0) andClauses.push({ token_id: { _in: uniqueTokenIds } });
    if (hasTokenMin) andClauses.push({ amount: { _gte: safeBigInt(tokenMinRaw!).toString() } });
    if (hasTokenMax) andClauses.push({ amount: { _lte: safeBigInt(tokenMaxRaw!).toString() } });
  } else {
    const hasMin = minReefRaw != null && safeBigInt(minReefRaw) > 0n;
    const hasMax = maxReefRaw != null && safeBigInt(maxReefRaw) > 0n;
    if (reefOnly || hasMin || hasMax) {
      andClauses.push({ type: { _eq: 'Native' } });
      if (hasMin) andClauses.push({ amount: { _gte: safeBigInt(minReefRaw!).toString() } });
      if (hasMax) andClauses.push({ amount: { _lte: safeBigInt(maxReefRaw!).toString() } });
    } else if (erc20Only) {
      andClauses.push({ verified_contract: { type: { _eq: 'ERC20' } } });
    }
  }

  if (excludeSwapLegs) andClauses.push({ reefswap_action: { _is_null: true } });

  if (andClauses.length === 1) return andClauses[0];
  return { _and: andClauses };
}

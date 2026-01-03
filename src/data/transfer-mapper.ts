import { isValidEvmAddressFormat } from '@/utils/address-helpers';
import { getNumber, getString } from '@/utils/object';
import { parseTokenMetadata, safeBigInt } from '@/utils/token-helpers';
// Use minimal shapes instead of tight GraphQL-generated types so both
// paginated and polling queries can reuse the mapper without type friction.

export interface UiSwapLeg {
  amount: string;
  /** Cached bigint for faster compares (optional) */
  amountBI?: bigint;
  token: { id: string; name: string; decimals: number };
}

export interface UiSwapInfo {
  sold: UiSwapLeg;
  bought: UiSwapLeg;
  /** Optional: underlying transfer id (block-extrinsic-event) to build a direct Reefscan transfer link */
  preferredTransferId?: string;
}

export interface UiTransfer {
  id: string;
  from: string;
  to: string;
  type: 'INCOMING' | 'OUTGOING' | 'SWAP';
  amount: string;
  /** Cached bigint representation of amount for fast numeric compares */
  amountBI?: bigint;
  isNft: boolean;
  tokenId: string | null;
  token: {
    id: string; 
    name: string;
    decimals: number;
  };
  timestamp: string;
  success: boolean;

  extrinsicHash: string;
  /** Present on subsquid for swap-related legs */
  reefswapAction?: string | null;

  // Optional precise indices for Reefscan transfer link
  blockHeight?: number;
  extrinsicIndex?: number;
  eventIndex?: number;
  /** Optional extrinsic id in the form Block-Extrinsic (no event) */
  extrinsicId?: string;

  /** Synthetic method when we aggregate legs into a single logical action */
  method?: 'swap' | 'transfer';
  /** Detailed amounts for swap rows */
  swapInfo?: UiSwapInfo;
}

interface TransferLikeToken {
  id: string;
  name: string;
  contractData?: unknown;
}

interface TransferLike {
  id: string;
  amount: string;
  timestamp: string;
  success: boolean;
  type: string;
  signedData?: unknown;
  extrinsicHash?: string | null;
  fromEvmAddress?: string | null;
  toEvmAddress?: string | null;
  from: { id: string };
  to: { id: string };
  token: TransferLikeToken;
}

type TransferEdge = { node: TransferLike };
type Transfer = TransferLike;


// Cache token metadata derived from contractData to avoid repeated JSON.parse
const tokenMetaCache = new Map<string, { name: string; decimals: number }>();

/** Check if token metadata is already cached for a given token id (as-is, checksum preserved). */
export function hasTokenMetaCached(id?: string | null): boolean {
  if (!id) return false;
  return tokenMetaCache.has(id);
}

/** Prime token metadata cache from a list of contracts (id + contractData JSON). Returns number of items added. */
export function primeTokenMetaCacheFromContracts(items: Array<{ id?: string | null; contractData?: unknown; name?: string | null }>): number {
  let added = 0;
  for (const it of items) {
    const id = (it?.id ?? '').toString();
    if (!id || tokenMetaCache.has(id)) continue;
    const meta = parseTokenMetadata(it?.contractData, it?.name ?? 'TOKEN');
    tokenMetaCache.set(id, { name: meta.name, decimals: meta.decimals });
    added += 1;
  }
  return added;
}

const resolveTransferDirection = (
  transfer: Transfer,
  userAddress: string,
): 'INCOMING' | 'OUTGOING' => {
  const ua = userAddress.toLowerCase();
  if (isValidEvmAddressFormat(userAddress)) {
    const fromEvm = (transfer.fromEvmAddress || '').toString().toLowerCase();
    const toEvm = (transfer.toEvmAddress || '').toString().toLowerCase();
    if (fromEvm && fromEvm === ua) return 'OUTGOING';
    if (toEvm && toEvm === ua) return 'INCOMING';
  }
  return (transfer.from.id.toLowerCase() === ua ? 'OUTGOING' : 'INCOMING');
};

function parseTokenData(transfer: Transfer): { name: string; decimals: number } {
  if (transfer.type === 'ERC721' || transfer.type === 'ERC1155') {
    return { name: 'NFT', decimals: 0 };
  }

  // If token is REEF, short-circuit
  if (transfer.token.name === 'REEF') return { name: 'REEF', decimals: 18 };

  // Try cache first
  const cached = tokenMetaCache.get(transfer.token.id);
  if (cached) return cached;

  // contractData may be omitted from some queries to reduce payload size
  const contractDataRaw = transfer.token.contractData;
  if (!contractDataRaw) {
    // Fallbacks for well-known tokens when metadata is omitted
    const nm = (transfer.token.name || '').toString();
    const lower = nm.toLowerCase();
    if (lower === 'usdc' || lower === 'usdc.e' || lower === 'usd coin') {
      return { name: nm, decimals: 6 };
    }
    if (lower === 'mrd') {
      return { name: nm, decimals: 18 };
    }
    // Generic default
    return { name: nm, decimals: 18 };
  }

  const meta = parseTokenMetadata(contractDataRaw, transfer.token.name);
  const result = { name: meta.name, decimals: meta.decimals };
  
  // Cache only when we had contractData to avoid caching placeholders
  tokenMetaCache.set(transfer.token.id, result);
  return result;
}



export function mapTransfersToUiTransfers(
  transferEdges: (TransferEdge | null)[] | null | undefined,
  userAddress: string | null | undefined
): UiTransfer[] {
  if (!transferEdges || !userAddress) {
    return [];
  }

  return transferEdges
    .map((edge): UiTransfer | null => {
      if (!edge?.node) {
        return null;
      }
      const transfer = edge.node;
      const { name: tokenName, decimals: tokenDecimals } = parseTokenData(transfer);
      const isNft = transfer.type === 'ERC721' || transfer.type === 'ERC1155';
      const swapFlag = getString(transfer as any, ['reefswapAction']) ?? null;
      return {
        id: transfer.id,
        from: transfer.from.id,
        to: transfer.to.id,
        type: resolveTransferDirection(transfer, userAddress),
        amount: transfer.amount,
        amountBI: safeBigInt(transfer.amount),
        isNft,
        tokenId: isNft ? transfer.amount : null, // Simplification, might need adjustment based on actual NFT logic
        token: {
          id: transfer.token.id,
          name: tokenName,
          decimals: tokenDecimals,
        },
        timestamp: transfer.timestamp,
        success: transfer.success,

        extrinsicHash: transfer.extrinsicHash || '',
        reefswapAction: swapFlag,
        method: swapFlag ? 'swap' : 'transfer',
        blockHeight: getNumber(transfer as any, ['blockHeight']) ?? undefined,
        extrinsicIndex: getNumber(transfer as any, ['extrinsicIndex']) ?? undefined,
        eventIndex: getNumber(transfer as any, ['eventIndex']) ?? undefined,
        extrinsicId: getString(transfer as any, ['extrinsicId']) ?? undefined,
      };
    })
    .filter((transfer): transfer is UiTransfer => transfer !== null);
}

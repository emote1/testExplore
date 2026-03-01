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
  amount: string | number | bigint;
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

function toRawAmountString(value: string | number | bigint): string {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '0';
    return Math.trunc(value).toLocaleString('fullwide', { useGrouping: false });
  }
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '0';
  if (/^\d+$/.test(trimmed)) return trimmed;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return '0';
  return Math.trunc(parsed).toLocaleString('fullwide', { useGrouping: false });
}


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
  // Some response paths (e.g. polling / partially-normalized Hasura payloads)
  // may not include nested from/to objects. Derive fallbacks from flat fields.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fromId = (transfer.from?.id || getString(transfer as any, ['fromId']) || getString(transfer as any, ['from_id']) || '').toLowerCase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toId = (transfer.to?.id || getString(transfer as any, ['toId']) || getString(transfer as any, ['to_id']) || '').toLowerCase();

  if (isValidEvmAddressFormat(userAddress)) {
    const fromEvm = (transfer.fromEvmAddress || '').toString().toLowerCase();
    const toEvm = (transfer.toEvmAddress || '').toString().toLowerCase();
    if (fromEvm && fromEvm === ua) return 'OUTGOING';
    if (toEvm && toEvm === ua) return 'INCOMING';
  }
  if (fromId && fromId === ua) return 'OUTGOING';
  if (toId && toId === ua) return 'INCOMING';
  return 'INCOMING';
};

function parseTokenData(transfer: Transfer): { name: string; decimals: number } {
  if (transfer.type === 'ERC721' || transfer.type === 'ERC1155') {
    return { name: 'NFT', decimals: 0 };
  }

  // Safety check for null token
  if (!transfer.token) {
    return { name: 'Unknown', decimals: 18 };
  }

  // If token is REEF, short-circuit
  if (transfer.token.name === 'REEF') return { name: 'REEF', decimals: 18 };

  // Try cache first
  const cached = tokenMetaCache.get(transfer.token.id);
  if (cached) return cached;

  // Check by token ID (contract address) for well-known tokens
  const tokenIdLower = (transfer.token.id || '').toLowerCase();
  if (tokenIdLower === '0x7922d8785d93e692bb584e659b607fa821e6a91a') {
    return { name: 'USDC', decimals: 6 };
  }
  if (tokenIdLower === '0x95a2af50040b7256a4b4c405a4afd4dd573da115') {
    return { name: 'MRD', decimals: 18 };
  }

  // contractData may be omitted from some queries to reduce payload size
  const contractDataRaw = transfer.token.contractData;
  if (!contractDataRaw) {
    // Fallbacks for well-known tokens when metadata is omitted by name
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
      const amount = toRawAmountString(transfer.amount);
      const { name: tokenName, decimals: tokenDecimals } = parseTokenData(transfer);
      const isNft = transfer.type === 'ERC721' || transfer.type === 'ERC1155';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const swapFlag = getString(transfer as any, ['reefswapAction']) ?? null;
      return {
        id: transfer.id,
        from: transfer.from?.id || '',
        to: transfer.to?.id || '',
        type: resolveTransferDirection(transfer, userAddress),
        amount,
        amountBI: safeBigInt(amount),
        isNft,
        tokenId: isNft ? amount : null, // Simplification, might need adjustment based on actual NFT logic
        token: {
          id: transfer.token?.id || '',
          name: tokenName,
          decimals: tokenDecimals,
        },
        timestamp: transfer.timestamp,
        success: transfer.success,

        extrinsicHash: transfer.extrinsicHash || '',
        reefswapAction: swapFlag,
        method: swapFlag ? 'swap' : 'transfer',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        blockHeight: getNumber(transfer as any, ['blockHeight']) ?? undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        extrinsicIndex: getNumber(transfer as any, ['extrinsicIndex']) ?? undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eventIndex: getNumber(transfer as any, ['eventIndex']) ?? undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        extrinsicId: getString(transfer as any, ['extrinsicId']) ?? undefined,
      };
    })
    .filter((transfer): transfer is UiTransfer => transfer !== null);
}

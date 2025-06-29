import type {
  TransfersQueryQuery as TransfersQuery,
  ExtrinsicsByIdsQuery,
} from '../types/graphql-generated';

// The correct, modern UI Transfer model
export interface UiTransfer {
  id: string;
  from: string;
  to: string;
  type: 'INCOMING' | 'OUTGOING';
  amount: string;
  token: {
    id: string;
    name: string;
    decimals: number;
  };
  fee: {
    amount: string;
    token: {
      id: string;
      name: string;
      decimals: number;
    };
  };
  timestamp: string;
  success: boolean;
  extrinsicHash: string | null | undefined;
}

// Type helpers from generated types
type TransferEdge = TransfersQuery['transfersConnection']['edges'][0];
type Transfer = NonNullable<TransferEdge>['node'];
type Extrinsic = ExtrinsicsByIdsQuery['extrinsics'][0];

// Helper to parse token symbol and decimals from a transfer
const parseTokenData = (transfer: Transfer): { symbol: string; decimals: number } => {
  // Handle NFTs first, as they are distinct.
  if (transfer.type === 'ERC721' || transfer.type === 'ERC1155') {
    return { symbol: 'NFT', decimals: 0 };
  }

  // The native REEF token is the only one without contractData.
  if (!transfer.token.contractData) {
    return { symbol: 'REEF', decimals: 18 };
  }

  // Also treat REEFERC20 as REEF for display purposes.
  if (transfer.token.name === 'REEFERC20') {
    return { symbol: 'REEF', decimals: 18 };
  }

  // For all other tokens (like ERC20), use their provided name and decimals.
  // Prioritize `symbol` from contractData if available, as `name` can be generic.
  const symbol = (transfer.token.contractData as any)?.symbol || transfer.token.name;
  return {
    symbol,
    decimals: (transfer.token.contractData as any)?.decimals ?? 18,
  };
};

// Helper to determine if a transfer is incoming or outgoing
const resolveTransferDirection = (
  transfer: Transfer,
  userAddress: string,
): 'INCOMING' | 'OUTGOING' => (transfer.from.id === userAddress ? 'OUTGOING' : 'INCOMING');

/**
 * Maps raw transfer data from GraphQL to a UI-friendly format.
 * @param transferEdges - The edges from the transfersConnection query.
 * @param userAddress - The address of the current user to determine transfer direction.
 * @param feeEvents - A list of 'TransactionFeePaid' events to source fee data from.
 * @returns An array of UiTransfer objects.
 */
export function mapTransfersToUiTransfers(
  transferEdges: (TransferEdge | null)[] | null | undefined,
  userAddress: string | null | undefined,
  extrinsics: Extrinsic[],
): UiTransfer[] {
  if (!transferEdges || !userAddress) {
    return [];
  }

  const uiTransfers = transferEdges
    .map((edge): UiTransfer | null => {
      if (!edge?.node) {
        return null;
      }
      const transfer = edge.node;
      const type = resolveTransferDirection(transfer, userAddress);
      const { symbol: tokenSymbol, decimals: tokenDecimals } = parseTokenData(transfer);

      // Find the corresponding extrinsic to extract the fee from its signedData
      const extrinsic = extrinsics.find((ext) => ext.id === transfer.extrinsicId);
      
      // The `signedData` field is a JSON string, so we need to parse it.
      // The fee is a hex string (e.g., "0x..."), convert it to a decimal string.
            const feeAmount = extrinsic?.signedData?.fee?.partialFee
        ? BigInt(extrinsic.signedData.fee.partialFee).toString()
        : '0';

      return {
        id: transfer.id,
        from: transfer.from.id,
        to: transfer.to.id,
        type,
        amount: transfer.amount,
        token: {
          id: transfer.token.id,
          name: tokenSymbol,
          decimals: tokenDecimals,
        },
        fee: {
          amount: feeAmount,
          token: {
            id: 'reef', // Fee is always in REEF
            name: 'REEF',
            decimals: 18,
          },
        },
        timestamp: transfer.timestamp,
        success: transfer.success,
        extrinsicHash: transfer.extrinsicHash,
      };
    })
    .filter((transfer): transfer is UiTransfer => transfer !== null);

  return uiTransfers;
}

import type { TransfersFeeQueryQuery as TransfersFeeQuery } from '../types/graphql-generated';

export interface UiTransfer {
  id: string;
  from: string;
  to: string;
  type: 'INCOMING' | 'OUTGOING';
  amount: string;
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
  feeAmount: string;
}

// Type helpers from generated types
type TransferEdge = TransfersFeeQuery['transfersConnection']['edges'][0];
type Transfer = NonNullable<TransferEdge>['node'];


const resolveTransferDirection = (
  transfer: Transfer,
  userAddress: string,
): 'INCOMING' | 'OUTGOING' => (transfer.from.id.toLowerCase() === userAddress.toLowerCase() ? 'OUTGOING' : 'INCOMING');

const parseTokenData = (transfer: Transfer): { name: string; decimals: number } => {
  if (transfer.type === 'ERC721' || transfer.type === 'ERC1155') {
    return { name: 'NFT', decimals: 0 };
  }

  if (transfer.token.name === 'REEF' || !transfer.token.contractData) {
    return { name: 'REEF', decimals: 18 };
  }

  try {
    // contractData can be a stringified JSON, so we need to parse it safely.
    const contractData = typeof transfer.token.contractData === 'string' 
      ? JSON.parse(transfer.token.contractData)
      : transfer.token.contractData;

    return {
      name: contractData?.symbol || transfer.token.name,
      decimals: contractData?.decimals ?? 18,
    };
  } catch (error) {
    console.error('Failed to parse contractData:', transfer.token.contractData, error);
    // Fallback to default values if parsing fails
    return { name: transfer.token.name, decimals: 18 };
  }
};



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

      return {
        id: transfer.id,
        from: transfer.from.id,
        to: transfer.to.id,
        type: resolveTransferDirection(transfer, userAddress),
        amount: transfer.amount,
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
        feeAmount: '0',
      };
    })
    .filter((transfer): transfer is UiTransfer => transfer !== null);
}

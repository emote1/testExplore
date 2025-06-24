import type { TransfersQueryQuery } from '../types/graphql-generated';

export interface UiTransfer {
  id: string;
  hash: string;
  timestamp: string;
  from: string;
  to: string;
  amount: string;
  tokenSymbol: string;
  tokenDecimals: number;
  success: boolean;
  status: 'Success' | 'Fail';
  type: string;
  feeAmount: string;
  feeTokenSymbol: string;
}

type TransferEdge = TransfersQueryQuery['transfersConnection']['edges'][0];
type Transfer = TransferEdge['node'];

const parseTokenData = (transfer: Transfer): { symbol: string; decimals: number } => {
  // Handle different transfer types
  switch (transfer.type) {
    case 'Native':
      return { symbol: 'REEF', decimals: 18 };
    case 'ERC721':
    case 'ERC1155':
      return { symbol: 'NFT', decimals: 0 };
    case 'ERC20':
      // Use token name if available, fallback to type
      const tokenName = transfer.token?.name || 'TOKEN';
      return { symbol: tokenName, decimals: 18 }; // Default to 18 for ERC20
    default:
      return { symbol: 'UNKNOWN', decimals: 0 };
  }
};

const processTransfer = (
  transfer: Transfer,
  userAddress: string | null | undefined,
): UiTransfer => {
  const { symbol: tokenSymbol, decimals: tokenDecimals } = parseTokenData(transfer);

  const toAddress = transfer.to.id.toLowerCase().trim();
  const fromAddress = transfer.from.id.toLowerCase().trim();
  const currentUserAddress = (userAddress || '').toLowerCase().trim();

  const isTo = toAddress === currentUserAddress;
  const isFrom = fromAddress === currentUserAddress;

  let type = 'UNKNOWN';
  if (isTo) {
    type = 'INCOMING';
  } else if (isFrom) {
    type = 'OUTGOING';
  }

  return {
    id: transfer.id,
    hash: transfer.extrinsicHash || '',
    timestamp: new Date(transfer.timestamp).toISOString(),
    from: transfer.from.id,
    to: transfer.to.id,
    amount: transfer.amount.toString(),
    tokenSymbol,
    tokenDecimals,
    success: transfer.success,
    status: transfer.success ? 'Success' : 'Fail',
    type, // Use the calculated type
    feeAmount: '0', // This will be updated by the hook if needed
    feeTokenSymbol: 'REEF',
  };
};

export const mapTransfersToUiTransfers = (
  transferEdges: TransferEdge[] | undefined | null,
  userAddress?: string | null,
): UiTransfer[] => {
  if (!transferEdges) {
    return [];
  }

  return transferEdges.map(edge => processTransfer(edge.node, userAddress));
};

// Legacy alias for backward compatibility during migration
export const mapEventsToUiTransfers = mapTransfersToUiTransfers;

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
    case 'ERC20': {
      // Attempt to read symbol and decimals from contractData
      let symbol = transfer.token?.name || 'TOKEN';
      let decimals = 18;

      const { contractData } = transfer.token || {};
      if (contractData) {
        try {
          const data =
            typeof contractData === 'string' ? JSON.parse(contractData) : contractData;
          if (typeof data.symbol === 'string' && data.symbol) {
            symbol = data.symbol;
          }
          if (data.decimals !== undefined && !isNaN(Number(data.decimals))) {
            decimals = Number(data.decimals);
          }
        } catch (error) {
          console.error('Failed to parse contractData for token', transfer.token?.id, error);
        }
      }

      return { symbol, decimals };
    }
    default:
      return { symbol: 'UNKNOWN', decimals: 0 };
  }
};

const processTransfer = (
  transfer: Transfer,
  userAddress: string | null | undefined,
): UiTransfer => {
  const { symbol: tokenSymbol, decimals: tokenDecimals } = parseTokenData(transfer);

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
    type: 
      transfer.to.id.toLowerCase() === (userAddress || '').toLowerCase()
        ? transfer.from.id.toLowerCase() === (userAddress || '').toLowerCase()
          ? 'SELF'
          : 'INCOMING'
        : 'OUTGOING',
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

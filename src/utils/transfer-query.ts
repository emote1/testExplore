import type { TransferWhereInput } from '@/gql/graphql';

interface BuildFilterParams {
  resolvedAddress?: string | null;
  resolvedEvmAddress?: string | null;
  direction?: TransactionDirection;
}

export type TransactionDirection = 'any' | 'incoming' | 'outgoing';

// Builds a TransferWhereInput with OR over native id and EVM address.
// Returns undefined if neither address is provided.
export function buildTransferWhereFilter({
  resolvedAddress,
  resolvedEvmAddress,
  direction = 'any',
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
  return { OR: orClauses } as TransferWhereInput;
}

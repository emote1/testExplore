import type { TransferWhereInput } from '@/gql/graphql';

interface BuildFilterParams {
  resolvedAddress?: string | null;
  resolvedEvmAddress?: string | null;
}

// Builds a TransferWhereInput with OR over native id and EVM address.
// Returns undefined if neither address is provided.
export function buildTransferWhereFilter({
  resolvedAddress,
  resolvedEvmAddress,
}: BuildFilterParams): TransferWhereInput | undefined {
  const orClauses: NonNullable<TransferWhereInput['OR']> = [];

  if (resolvedAddress) {
    orClauses.push({ from: { id_eq: resolvedAddress } });
    orClauses.push({ to: { id_eq: resolvedAddress } });
  }
  if (resolvedEvmAddress) {
    orClauses.push({ fromEvmAddress_eq: resolvedEvmAddress });
    orClauses.push({ toEvmAddress_eq: resolvedEvmAddress });
  }

  if (orClauses.length === 0) return undefined;
  return { OR: orClauses } as TransferWhereInput;
}

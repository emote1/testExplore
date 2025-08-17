import { useEffect, useState } from 'react';
import { useQuery } from '@apollo/client';
import { useAddressResolver } from './use-address-resolver';
import { NFTS_BY_OWNER_PAGED_QUERY } from '../data/nfts';

export function useNftsByOwner(ownerAddress: string) {
  const { resolveEvmAddress, isResolving: isAddressResolving } = useAddressResolver();
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);

  useEffect(() => {
    const resolve = async () => {
      if (ownerAddress) {
        const evmAddress = await resolveEvmAddress(ownerAddress);
        setResolvedAddress(evmAddress);
      }
    };
    resolve();
  }, [ownerAddress, resolveEvmAddress]);

  const { data, loading, error } = useQuery(NFTS_BY_OWNER_PAGED_QUERY, {
    variables: { owner: resolvedAddress || '', limit: 150, offset: 0 },
    skip: !resolvedAddress || isAddressResolving,
  });

  return { nfts: data?.tokenHolders, isLoading: loading || isAddressResolving, error };
}

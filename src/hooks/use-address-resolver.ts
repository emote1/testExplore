import { useCallback } from 'react';
import { useLazyQuery } from '@apollo/client';
import { GET_ACCOUNT_BY_EVM_QUERY, GET_ACCOUNT_BY_NATIVE_QUERY } from '../data/addresses';
import { getAddressType, isValidAddress } from '../utils/address-helpers';
import type { GetAccountByEvmQuery, GetAccountByNativeQuery } from '@/gql/graphql';

/**
 * Hook for resolving and validating addresses in Reef Chain
 * Supports both EVM and Substrate (native) addresses
 */
export function useAddressResolver() {
  const [getAccountByEvm, { loading: isResolvingEvm }] = useLazyQuery<GetAccountByEvmQuery>(GET_ACCOUNT_BY_EVM_QUERY);
  const [getAccountByNative, { loading: isResolvingNative }] = useLazyQuery<GetAccountByNativeQuery>(GET_ACCOUNT_BY_NATIVE_QUERY);

  /**
   * Resolves an address to ensure it exists on the chain
   * @param address - The address to resolve (EVM or Substrate format)
   * @returns Promise with the resolved address or null if not found
   */
  const resolveAddress = useCallback(async (address: string): Promise<string | null> => {
    if (!isValidAddress(address)) {
      return null;
    }

    const addressType = getAddressType(address);
    
    try {
      if (addressType === 'evm') {
        const { data } = await getAccountByEvm({ variables: { evmAddress: address } });
        return data?.accounts?.[0]?.id || null;
      } else if (addressType === 'substrate') {
        const { data } = await getAccountByNative({ variables: { nativeAddress: address } });
        return data?.accounts?.[0]?.id || null;
      }
    } catch (error) {
      console.warn('Failed to resolve address:', address, error);
      return null;
    }

    return null;
  }, [getAccountByEvm, getAccountByNative]);

  /**
   * Validates if an address exists on the chain
   * @param address - The address to validate
   * @returns Promise with boolean indicating if address exists
   */
  const validateAddress = useCallback(async (address: string): Promise<boolean> => {
    const resolved = await resolveAddress(address);
    return resolved !== null;
  }, [resolveAddress]);

  /**
   * Resolves an address to an EVM (0x...) address if available.
   * - For an EVM input, returns it as-is
   * - For a Substrate input, returns mapped evmAddress or null if not mapped
   */
  const resolveEvmAddress = useCallback(async (address: string): Promise<string | null> => {
    if (!isValidAddress(address)) return null;
    const type = getAddressType(address);
    if (type === 'evm') return address;
    try {
      const { data } = await getAccountByNative({ variables: { nativeAddress: address } });
      const evm = data?.accounts?.[0]?.evmAddress ?? null;
      return evm;
    } catch (error) {
      console.warn('Failed to resolve EVM address:', address, error);
      return null;
    }
  }, [getAccountByNative]);

  /**
   * Gets the type of address without making network calls
   * @param address - The address to check
   * @returns 'evm' | 'substrate' | 'invalid'
   */
  const getAddressTypeSync = useCallback((address: string) => {
    return getAddressType(address);
  }, []);

  const isResolving = isResolvingEvm || isResolvingNative;

  return {
    resolveAddress,
    validateAddress,
    resolveEvmAddress,
    getAddressType: getAddressTypeSync,
    isValidAddress,
    isResolving,
  };
}

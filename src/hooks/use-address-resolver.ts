import { useCallback } from 'react';
import { useLazyQuery } from '@apollo/client';
import { GET_ACCOUNT_BY_EVM_QUERY, GET_ACCOUNT_BY_NATIVE_QUERY } from '../data/addresses';
import { getAddressType, isValidAddress } from '../utils/address-helpers';
import type { GetAccountByEvmQuery, GetAccountByNativeQuery } from '@/gql/graphql';
import { createLruCache } from '@/utils/lru';

/**
 * Hook for resolving and validating addresses in Reef Chain
 * Supports both EVM and Substrate (native) addresses
 */
// Module-level caches (shared across hook instances)
const nativeIdCache = createLruCache<string, string | null>({ max: 512, ttlMs: 10 * 60 * 1000 });
const evmAddrCache = createLruCache<string, string | null>({ max: 512, ttlMs: 10 * 60 * 1000 });

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
      const cached = nativeIdCache.get(address);
      if (cached !== undefined) return cached;
      if (addressType === 'evm') {
        const { data } = await getAccountByEvm({ variables: { evmAddress: address } });
        const value = data?.accounts?.[0]?.id || null;
        nativeIdCache.set(address, value);
        return value;
      } else if (addressType === 'substrate') {
        const { data } = await getAccountByNative({ variables: { nativeAddress: address } });
        const value = data?.accounts?.[0]?.id || null;
        nativeIdCache.set(address, value);
        return value;
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
      const cached = evmAddrCache.get(address);
      if (cached !== undefined) return cached;
      const { data } = await getAccountByNative({ variables: { nativeAddress: address } });
      const evm = data?.accounts?.[0]?.evmAddress ?? null;
      evmAddrCache.set(address, evm);
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

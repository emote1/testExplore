import { useCallback } from 'react';
import { useLazyQuery } from '@apollo/client';
import { GET_ACCOUNT_BY_EVM_QUERY, GET_ACCOUNT_BY_NATIVE_QUERY } from '../data/addresses';
import { getAddressType, isValidAddress } from '../utils/address-helpers';
import type { GetAccountByEvmQuery, GetAccountByNativeQuery } from '@/gql/graphql';
import { createLruCache } from '@/utils/lru';

/**
 * Hook for resolving and validating addresses in Reef Chain
 * Supports both EVM and Substrate (native) addresses
 * 
 * OPTIMIZED: Uses unified cache to avoid duplicate queries.
 * One query returns both nativeId and evmAddress.
 */

// Unified cache: stores both nativeId and evmAddress from single query
interface ResolvedAccount {
  nativeId: string | null;
  evmAddress: string | null;
}
const accountCache = createLruCache<string, ResolvedAccount>({ max: 512, ttlMs: 10 * 60 * 1000 });

// Pending requests map: prevents duplicate in-flight queries for same address
const pendingRequests = new Map<string, Promise<ResolvedAccount>>();

export function useAddressResolver() {
  const [getAccountByEvm, { loading: isResolvingEvm }] = useLazyQuery<GetAccountByEvmQuery>(GET_ACCOUNT_BY_EVM_QUERY);
  const [getAccountByNative, { loading: isResolvingNative }] = useLazyQuery<GetAccountByNativeQuery>(GET_ACCOUNT_BY_NATIVE_QUERY);

  /**
   * Resolves both nativeId and evmAddress in ONE query.
   * Results are cached for subsequent calls.
   */
  const resolveBoth = useCallback(async (address: string): Promise<ResolvedAccount> => {
    if (!isValidAddress(address)) {
      return { nativeId: null, evmAddress: null };
    }

    // Check unified cache first
    const cached = accountCache.get(address);
    if (cached !== undefined) return cached;

    // Check if there's already a pending request for this address
    const pending = pendingRequests.get(address);
    if (pending) return pending;

    const addressType = getAddressType(address);
    
    // Create the promise and store it to prevent duplicate requests
    const fetchPromise = (async (): Promise<ResolvedAccount> => {
      try {
        if (addressType === 'evm') {
          const { data } = await getAccountByEvm({ variables: { evmAddress: address } });
          const account = data?.accounts?.[0];
          const result: ResolvedAccount = {
            nativeId: account?.id || null,
            evmAddress: address, // EVM input is already the EVM address
          };
          accountCache.set(address, result);
          // Also cache by nativeId for reverse lookups
          if (result.nativeId) accountCache.set(result.nativeId, result);
          return result;
        } else if (addressType === 'substrate') {
          const { data } = await getAccountByNative({ variables: { nativeAddress: address } });
          const account = data?.accounts?.[0];
          const result: ResolvedAccount = {
            nativeId: account?.id || null,
            evmAddress: account?.evmAddress ?? null,
          };
          accountCache.set(address, result);
          // Also cache by evmAddress for reverse lookups
          if (result.evmAddress) accountCache.set(result.evmAddress, result);
          return result;
        }
      } catch (error) {
        console.warn('Failed to resolve address:', address, error);
      }
      return { nativeId: null, evmAddress: null };
    })();

    // Store pending request
    pendingRequests.set(address, fetchPromise);

    // Clean up after completion
    fetchPromise.finally(() => {
      pendingRequests.delete(address);
    });

    return fetchPromise;
  }, [getAccountByEvm, getAccountByNative]);

  /**
   * Resolves an address to native id (uses unified cache)
   */
  const resolveAddress = useCallback(async (address: string): Promise<string | null> => {
    const result = await resolveBoth(address);
    return result.nativeId;
  }, [resolveBoth]);

  /**
   * Validates if an address exists on the chain
   */
  const validateAddress = useCallback(async (address: string): Promise<boolean> => {
    const resolved = await resolveAddress(address);
    return resolved !== null;
  }, [resolveAddress]);

  /**
   * Resolves an address to EVM address (uses unified cache)
   * - For EVM input: returns as-is
   * - For Substrate input: returns mapped evmAddress
   */
  const resolveEvmAddress = useCallback(async (address: string): Promise<string | null> => {
    if (!isValidAddress(address)) return null;
    const type = getAddressType(address);
    if (type === 'evm') return address;
    const result = await resolveBoth(address);
    return result.evmAddress;
  }, [resolveBoth]);

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
    resolveBoth, // Optimized: one query for both nativeId and evmAddress
    getAddressType: getAddressTypeSync,
    isValidAddress,
    isResolving,
  };
}

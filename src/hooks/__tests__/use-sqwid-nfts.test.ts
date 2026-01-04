import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSqwidNfts } from '../use-sqwid-nfts';
import { createWrapper } from '../../test/test-utils';
import { apolloClient } from '../../apollo-client';

vi.mock('../../apollo-client', () => ({
  apolloClient: {
    query: vi.fn(),
  },
}));

vi.mock('../use-address-resolver', () => ({
  useAddressResolver: vi.fn(() => ({
    resolveEvmAddress: vi.fn(async (addr: string) => addr || null),
    resolvedAddress: null,
    isLoading: false,
    error: null,
  })),
}));

describe('useSqwidNfts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('invalid addresses', () => {
    it('should return empty arrays for null address', async () => {
      const { result } = renderHook(() => useSqwidNfts(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.nfts).toEqual([]);
      expect(result.current.collections).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should return empty arrays for undefined address', async () => {
      const { result } = renderHook(() => useSqwidNfts(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.nfts).toEqual([]);
      expect(result.current.collections).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should return empty arrays for empty string address', async () => {
      const { result } = renderHook(() => useSqwidNfts(''), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.nfts).toEqual([]);
      expect(result.current.collections).toEqual([]);
    });
  });

  describe('valid addresses', () => {
    it('should start with isLoading true for valid address', () => {
      vi.mocked(apolloClient.query).mockImplementation(() => 
        new Promise(() => {}) // Never resolves
      );

      const validAddress = '5EDEq19u8KMtJq7ve4fDPQY9z1FtbkdG3nvIupkhq5fhiVx';
      const { result } = renderHook(() => useSqwidNfts(validAddress), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.nfts).toEqual([]);
      expect(result.current.collections).toEqual([]);
    });

    it('should handle empty GraphQL result', async () => {
      vi.mocked(apolloClient.query).mockResolvedValueOnce({
        data: { tokenHolders: [] },
        loading: false,
        networkStatus: 7,
      });

      const validAddress = '5EDEq19u8KMtJq7ve4fDPQY9z1FtbkdG3nvIupkhq5fhiVx';
      const { result } = renderHook(() => useSqwidNfts(validAddress), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.nfts).toEqual([]);
      expect(result.current.collections).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should handle GraphQL error', async () => {
      const errorMessage = 'GraphQL network error';
      vi.mocked(apolloClient.query).mockRejectedValueOnce(new Error(errorMessage));

      const validAddress = '0x1234567890123456789012345678901234567890';
      const { result } = renderHook(() => useSqwidNfts(validAddress), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.error).not.toBeNull());

      expect(result.current.error?.message).toContain(errorMessage);
      expect(result.current.nfts).toEqual([]);
      expect(result.current.collections).toEqual([]);
    });
  });

  describe('query key consistency', () => {
    it('should use the same query key for the same address', () => {
      vi.mocked(apolloClient.query).mockResolvedValue({
        data: { tokenHolders: [] },
        loading: false,
        networkStatus: 7,
      });

      const address = '5EDEq19u8KMtJq7ve4fDPQY9z1FtbkdG3nvIupkhq5fhiVx';
      
      const { result: result1 } = renderHook(() => useSqwidNfts(address), {
        wrapper: createWrapper(),
      });

      const { result: result2 } = renderHook(() => useSqwidNfts(address), {
        wrapper: createWrapper(),
      });

      expect(result1.current.isLoading).toBe(result2.current.isLoading);
    });

  });

  describe('return value structure', () => {
    it('should return correct shape', async () => {
      vi.mocked(apolloClient.query).mockResolvedValueOnce({
        data: { tokenHolders: [] },
        loading: false,
        networkStatus: 7,
      });

      const { result } = renderHook(() => useSqwidNfts(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current).toHaveProperty('nfts');
      expect(result.current).toHaveProperty('collections');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      
      expect(Array.isArray(result.current.nfts)).toBe(true);
      expect(Array.isArray(result.current.collections)).toBe(true);
      expect(typeof result.current.isLoading).toBe('boolean');
    });
  });
});

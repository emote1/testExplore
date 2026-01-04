import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTokenBootstrap } from '../use-token-bootstrap';
import { createWrapper } from '../../test/test-utils';
import type { ApolloClient, NormalizedCacheObject } from '@apollo/client';

const mockApolloClient = {
  query: vi.fn(),
} as unknown as ApolloClient<NormalizedCacheObject>;

describe('useTokenBootstrap', () => {
  const defaultArgs = {
    effectiveStrict: false,
    tokenFilter: 'all',
    enforceStrict: false,
    isLoading: false,
    initialTransactions: null,
    serverTokenIds: null,
    setServerTokenIds: vi.fn(),
    softFallbackActive: false,
    setSoftFallbackActive: vi.fn(),
    softFallbackAttempted: false,
    setSoftFallbackAttempted: vi.fn(),
    apollo: mockApolloClient,
    usdcBootstrapDone: false,
    setUsdcBootstrapDone: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('serverTokenIds management', () => {
    it('should reset serverTokenIds when effectiveStrict is false', () => {
      const setServerTokenIds = vi.fn();
      const { rerender } = renderHook(
        (props) => useTokenBootstrap(props),
        {
          wrapper: createWrapper(),
          initialProps: { ...defaultArgs, serverTokenIds: ['0x123'], setServerTokenIds },
        }
      );

      rerender({ ...defaultArgs, effectiveStrict: false, serverTokenIds: ['0x123'], setServerTokenIds });

      expect(setServerTokenIds).toHaveBeenCalledWith(null);
    });

    it('should reset serverTokenIds when tokenFilter is "all"', () => {
      const setServerTokenIds = vi.fn();
      renderHook(() => useTokenBootstrap({ ...defaultArgs, tokenFilter: 'all', serverTokenIds: ['0x123'], setServerTokenIds }), {
        wrapper: createWrapper(),
      });

      expect(setServerTokenIds).toHaveBeenCalledWith(null);
    });

    it('should reset serverTokenIds when tokenFilter is "reef"', () => {
      const setServerTokenIds = vi.fn();
      renderHook(() => useTokenBootstrap({ ...defaultArgs, tokenFilter: 'reef', serverTokenIds: ['0x123'], setServerTokenIds }), {
        wrapper: createWrapper(),
      });

      expect(setServerTokenIds).toHaveBeenCalledWith(null);
    });
  });

  describe('hex address handling', () => {
    it('should set serverTokenIds for valid hex address', async () => {
      const setServerTokenIds = vi.fn();
      const hexAddress = '0x1234567890123456789012345678901234567890';
      
      renderHook(
        () => useTokenBootstrap({
          ...defaultArgs,
          effectiveStrict: true,
          tokenFilter: hexAddress,
          setServerTokenIds,
        }),
        { wrapper: createWrapper() }
      );

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(setServerTokenIds).toHaveBeenCalledWith([hexAddress]);
    });

    it('should not update for invalid hex address', () => {
      const setServerTokenIds = vi.fn();
      
      renderHook(
        () => useTokenBootstrap({
          ...defaultArgs,
          effectiveStrict: true,
          tokenFilter: 'not-a-hex-address',
          setServerTokenIds,
        }),
        { wrapper: createWrapper() }
      );

      expect(setServerTokenIds).not.toHaveBeenCalled();
    });
  });

  describe('hook initialization', () => {
    it('should initialize without errors', () => {
      const { result } = renderHook(
        () => useTokenBootstrap(defaultArgs),
        { wrapper: createWrapper() }
      );

      expect(result).toBeDefined();
    });

    it('should accept all required parameters', () => {
      expect(() => {
        renderHook(
          () => useTokenBootstrap({
            ...defaultArgs,
            effectiveStrict: true,
            tokenFilter: 'usdc',
          }),
          { wrapper: createWrapper() }
        );
      }).not.toThrow();
    });
  });

  describe('token filter switching', () => {
    it('should handle switching from usdc to mrd', () => {
      const setServerTokenIds = vi.fn();
      const { rerender } = renderHook(
        (props) => useTokenBootstrap(props),
        {
          wrapper: createWrapper(),
          initialProps: {
            ...defaultArgs,
            effectiveStrict: true,
            tokenFilter: 'usdc',
            setServerTokenIds,
          },
        }
      );

      setServerTokenIds.mockClear();

      rerender({
        ...defaultArgs,
        effectiveStrict: true,
        tokenFilter: 'mrd',
        setServerTokenIds,
      });

      expect(setServerTokenIds).toHaveBeenCalled();
    });
  });
});

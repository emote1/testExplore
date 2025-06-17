import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import axios from 'axios'; 
import { useTransactionDataWithBlocks } from './use-transaction-data-with-blocks';
import { PAGINATION_CONFIG } from '../constants/pagination';

interface MockedAxios {
  post: Mock<(...args: any[]) => Promise<any>>;
}

// Mock axios module
vi.mock('axios', () => ({
  __esModule: true, 
  default: {        
    post: vi.fn(),
  },
}));

// Mock block-pagination utilities
vi.mock('../utils/block-pagination', () => ({
  createTransactionBlock: vi.fn(),
  extractPageFromBlock: vi.fn(),
  canServePageFromBlock: vi.fn(),
  getPagesInBlock: vi.fn(),
}));

// Import the mocked functions AFTER vi.mock calls
import {
  createTransactionBlock as mockedCreateTransactionBlock,
  extractPageFromBlock as mockedExtractPageFromBlock,
  canServePageFromBlock as mockedCanServePageFromBlock,
  getPagesInBlock as mockedGetPagesInBlock
} from '../utils/block-pagination';

// Mock cache manager
const mockCacheManager = {
  get: vi.fn(),
  set: vi.fn(),
  has: vi.fn(),
  clear: vi.fn(),
  clearForAddress: vi.fn(),
  getStats: vi.fn(() => ({
    size: 0,
    maxSize: PAGINATION_CONFIG.MAX_CACHE_SIZE,
    accessOrderLength: 0
  }))
};

vi.mock('../utils/cache-manager', () => ({
  PaginationCacheManager: vi.fn(() => mockCacheManager)
}));

vi.mock('../utils/reefscan-helpers', () => ({
  determineDisplayType: vi.fn(() => 'incoming')
}));

describe('useTransactionDataWithBlocks', () => {
  const mockApiResponse = {
    data: {
      data: {
        transfersConnection: {
          edges: [
            {
              node: {
                id: 'test-id',
                extrinsicHash: 'test-hash',
                from: { id: 'test-from' },
                to: { id: 'test-to' },
                timestamp: '2023-01-01T00:00:00.000Z',
                amount: '1000000000000000000',
                type: 'transfer',
                status: 'success',
                token: {
                  id: 'REEF',
                  name: 'Reef Finance',
                  verifiedContract: {
                    contractData: JSON.stringify({
                      name: 'Reef token',
                      symbol: 'REEF',
                      decimals: 18,
                    })
                  }
                },
                signedData: JSON.stringify({
                  fee: { partialFee: '1000000000000000' }
                })
              }
            }
          ],
          pageInfo: {
            hasNextPage: true,
            hasPreviousPage: false,
            startCursor: 'start-cursor',
            endCursor: 'end-cursor'
          },
          totalCount: 100
        }
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup axios mock
    ((axios as unknown as MockedAxios).post as Mock).mockResolvedValue(mockApiResponse);
    
    // Setup block utilities mocks
    (mockedCreateTransactionBlock as Mock).mockImplementation((transactions, pageInfo, totalCount, nativeAddress) => ({
      transactions,
      pageInfo,
      totalCount,
      nativeAddress,
      fetchedAt: Date.now()
    }));
    
    (mockedExtractPageFromBlock as Mock).mockImplementation((block, pageNumber) => {
      const pageSize = PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE;
      const relativePageIndex = pageNumber - 1; 

      const startIndex = relativePageIndex * pageSize;
      const endIndex = startIndex + pageSize;
      
      return {
        transactions: block.transactions.slice(startIndex, endIndex),
        hasMore: endIndex < block.transactions.length || block.pageInfo.hasNextPage
      };
    });
    
    (mockedCanServePageFromBlock as Mock).mockImplementation((block, pageNumber) => {
      if (!block) return false;
      const pageSize = PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE;
      const relativePageIndex = pageNumber - 1; 
      const startIndex = relativePageIndex * pageSize;
      return startIndex >= 0 && startIndex < block.transactions.length;
    });
    
    (mockedGetPagesInBlock as Mock).mockImplementation((block) => Math.ceil(block.transactions.length / PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE));
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useTransactionDataWithBlocks());

      expect(result.current.transactions).toEqual([]);
      expect(result.current.currentPage).toBe(1);
      expect(result.current.hasNextPage).toBe(false);
      expect(result.current.totalTransactions).toBe(0);
      expect(result.current.error).toBeNull();
      expect(result.current.isFetchingTransactions).toBe(false);
      expect(result.current.isNavigatingToLastPage).toBe(false);
      expect(result.current.userInputAddress).toBe('');
      expect(result.current.currentSearchAddress).toBe('');
      expect(result.current.nativeAddressForCurrentSearch).toBe('');
    });
  });

  describe('address handling', () => {
    it('should handle address submission', async () => {
      const { result } = renderHook(() => useTransactionDataWithBlocks());

      act(() => {
        result.current.setUserInputAddress('test-address');
      });

      expect(result.current.userInputAddress).toBe('test-address');

      await act(async () => {
        await result.current.handleAddressSubmit('test-address');
      });

      expect((axios as unknown as MockedAxios).post).toHaveBeenCalled();
    });
  });

  describe('pagination', () => {
    it('should handle next page navigation', async () => {
      const { result } = renderHook(() => useTransactionDataWithBlocks());

      // First set up an address and fetch data
      act(() => {
        result.current.setUserInputAddress('test-address');
      });

      await act(async () => {
        await result.current.handleAddressSubmit('test-address');
      });

      // Then navigate to next page
      await act(async () => {
        await result.current.handleNextPage();
      });

      expect(result.current.currentPage).toBeGreaterThan(1);
    });

    it('should handle previous page navigation', async () => {
      const { result } = renderHook(() => useTransactionDataWithBlocks());

      // Setup initial state on page 2
      act(() => {
        result.current.setUserInputAddress('test-address');
      });

      await act(async () => {
        await result.current.handleAddressSubmit('test-address');
      });

      await act(async () => {
        await result.current.handleNextPage();
      });

      // Now go back to previous page
      await act(async () => {
        await result.current.handlePreviousPage();
      });

      expect(result.current.currentPage).toBe(1);
    });

    it('should handle first page navigation', async () => {
      const { result } = renderHook(() => useTransactionDataWithBlocks());

      await act(async () => {
        await result.current.handleFirstPage();
      });

      expect(result.current.currentPage).toBe(1);
    });

    it('should handle last page navigation', async () => {
      const { result } = renderHook(() => useTransactionDataWithBlocks());

      act(() => {
        result.current.setUserInputAddress('test-address');
      });

      await act(async () => {
        await result.current.handleLastPage();
      });

      expect(result.current.isNavigatingToLastPage).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle API errors', async () => {
      const { result } = renderHook(() => useTransactionDataWithBlocks());

      ((axios as unknown as MockedAxios).post as Mock).mockRejectedValueOnce(new Error('API Error'));

      act(() => {
        result.current.setUserInputAddress('test-address');
      });

      await act(async () => {
        await result.current.handleAddressSubmit('test-address');
      });

      expect(result.current.error).not.toBeNull();
    });
  });

  describe('cache and block stats', () => {
    it('should provide cache statistics', () => {
      const { result } = renderHook(() => useTransactionDataWithBlocks());

      expect(result.current.cacheStats).toBeDefined();
      expect(typeof result.current.cacheStats.size).toBe('number');
      expect(typeof result.current.cacheStats.maxSize).toBe('number');
    });

    it('should provide block statistics', () => {
      const { result } = renderHook(() => useTransactionDataWithBlocks());

      expect(result.current.blockStats).toBeDefined();
      expect(typeof result.current.blockStats.hasCurrentBlock).toBe('boolean');
      expect(typeof result.current.blockStats.currentBlockStartPage).toBe('number');
    });
  });
});

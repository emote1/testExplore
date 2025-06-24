import { renderHook, act } from '@testing-library/react';
import { useTanstackTransactionAdapter } from './useTanstackTransactionAdapter';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UiTransfer } from '../data/transfer-mapper';
import { ApolloError } from '@apollo/client';

// Helper to create mock data conforming to the UiTransfer structure
const createMockUiTransfer = (id: string): UiTransfer => ({
  id,
  hash: `0xhash${id}`,
  timestamp: new Date().toISOString(),
  from: `from-${id}`,
  to: `to-${id}`,
  amount: '100000000000000000000',
  tokenSymbol: 'REEF',
  tokenDecimals: 18,
  success: true,
  status: 'Success',
  type: 'INCOMING',
  feeAmount: '0',
  feeTokenSymbol: 'REEF',
});

// Mock the underlying data hook
const mockFetchMore = vi.fn();
const mockUseTransactionDataResult = {
  transactions: [] as UiTransfer[],
  isLoading: false,
  error: undefined as ApolloError | undefined,
  hasNextPage: false,
  totalCount: 0,
  fetchMore: mockFetchMore,
};

// Mock the hook module
vi.mock('./use-transaction-data-with-blocks', () => ({
  useTransactionDataWithBlocks: vi.fn(() => mockUseTransactionDataResult),
}));

describe('useTanstackTransactionAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchMore.mockClear();
    // Reset mock state before each test
    mockUseTransactionDataResult.transactions = [];
    mockUseTransactionDataResult.isLoading = false;
    mockUseTransactionDataResult.error = undefined;
    mockUseTransactionDataResult.hasNextPage = false;
    mockUseTransactionDataResult.totalCount = 0;
  });

  it('should initialize and reflect the data hook loading state', () => {
    mockUseTransactionDataResult.isLoading = true;
    const { result } = renderHook(() => useTanstackTransactionAdapter('some-address'));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.table.options.data).toEqual([]);
  });

  it('should populate the table with data from the hook', () => {
    const mockTransfer = createMockUiTransfer('1');
    mockUseTransactionDataResult.transactions = [mockTransfer];
    mockUseTransactionDataResult.totalCount = 1;

    const { result } = renderHook(() => useTanstackTransactionAdapter('some-address'));

    expect(result.current.table.options.data.length).toBe(1);
    expect(result.current.table.options.data[0]).toEqual(mockTransfer);
    expect(result.current.table.getPageCount()).toBe(1);
  });

  it('should call fetchMore when table page changes and there is more data', () => {
    const mockTransfers = Array.from({ length: 10 }, (_, i) => createMockUiTransfer(`${i}`));
    mockUseTransactionDataResult.transactions = mockTransfers;
    mockUseTransactionDataResult.totalCount = 20; // More pages available
    mockUseTransactionDataResult.hasNextPage = true;

    const { result } = renderHook(() => useTanstackTransactionAdapter('some-address'));

    expect(result.current.table.getPageCount()).toBe(2);

    act(() => {
      result.current.table.nextPage();
    });

    expect(mockFetchMore).toHaveBeenCalledTimes(1);
  });

  it('should not call fetchMore if there are no more pages', () => {
    const mockTransfers = Array.from({ length: 10 }, (_, i) => createMockUiTransfer(`${i}`));
    mockUseTransactionDataResult.transactions = mockTransfers;
    mockUseTransactionDataResult.totalCount = 10;
    mockUseTransactionDataResult.hasNextPage = false;

    const { result } = renderHook(() => useTanstackTransactionAdapter('some-address'));

    expect(result.current.table.getPageCount()).toBe(1);
    expect(result.current.table.getCanNextPage()).toBe(false);

    act(() => {
      result.current.table.nextPage();
    });

    expect(mockFetchMore).not.toHaveBeenCalled();
  });

  it('should reflect error state from the data hook', () => {
    const error = new ApolloError({ errorMessage: 'Failed to fetch' });
    mockUseTransactionDataResult.error = error;

    const { result } = renderHook(() => useTanstackTransactionAdapter('some-address'));

    expect(result.current.error).toBe(error);
  });
});

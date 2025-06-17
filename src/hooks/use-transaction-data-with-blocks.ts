import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import axios from 'axios';
import type { Transaction, SortConfig, SignedData, TransactionBlock, BlockPaginationState } from '../types/transaction-types';
import type { ApiPageInfo, ApiTransfersConnection, ApiTransactionEdge } from '../types/reefscan-api';
import { PaginationCacheManager } from '../utils/cache-manager';
import { PAGINATION_CONFIG } from '../constants/pagination';
import { determineDisplayType } from '../utils/reefscan-helpers';
import {
  createTransactionBlock,
  extractPageFromBlock,
  canServePageFromBlock,
  getPagesInBlock
} from '../utils/block-pagination';

// Define a helper interface for parsed contract_data
interface ParsedContractData {
  name?: string;
  symbol?: string;
  decimals?: number;
}

// Error interfaces
interface AppError {
  userMessage: string;
  originalError?: unknown;
}

interface GraphQLError {
  message: string;
}

const API_URL = 'https://squid.subsquid.io/reef-explorer/graphql';

// Hook return interface
interface UseTransactionDataReturn {
  transactions: Transaction[];
  currentPage: number;
  hasNextPage: boolean;
  totalTransactions: number;
  error: string | null;
  isFetchingTransactions: boolean;
  isNavigatingToLastPage: boolean;
  isLastPageNavigable: boolean;
  userInputAddress: string;
  currentSearchAddress: string;
  nativeAddressForCurrentSearch: string | null;
  pageInfoForCurrentPage: ApiPageInfo | null;
  sortConfig: SortConfig;
  handleFirstPage: () => void;
  handlePreviousPage: () => void;
  handleNextPage: () => void;
  handleLastPage: () => void;
  handleAddressSubmit: (address: string) => void;
  setUserInputAddress: React.Dispatch<React.SetStateAction<string>>;
  handleSort: (key: keyof Transaction | null) => void;
  cacheStats: { size: number; maxSize: number; accessOrderLength: number; };
  // New block-related stats for debugging
  blockStats: {
    hasCurrentBlock: boolean;
    currentBlockStartPage: number;
    transactionsInBlock: number;
    pagesInBlock: number;
  };
}

// Helper to parse signedData from the API
const parseSignedData = (data: any): SignedData | undefined => {
  if (!data) {
    return undefined;
  }
  try {
    const rawSignedData = typeof data === 'string' ? JSON.parse(data) : data;

    if (rawSignedData && rawSignedData.fee && typeof rawSignedData.fee.partialFee === 'string') {
      return { 
        fee: { 
          partialFee: rawSignedData.fee.partialFee 
        } 
      };
    }
    if (rawSignedData && typeof rawSignedData.partialFee === 'string') {
      return { fee: { partialFee: rawSignedData.partialFee } };
    }
    return undefined;
  } catch (e) {
    // Silently ignore parsing errors, as this data is not critical
    return undefined;
  }
};

// Main hook implementation with block optimization
export function useTransactionDataWithBlocks(initialAddress: string = ''): UseTransactionDataReturn {
  // Cache manager instance (kept for fallback scenarios)
  const cacheManager = useRef(new PaginationCacheManager());
  
  // Traditional state management
  const [pageInfoForCurrentPage, setPageInfoForCurrentPage] = useState<ApiPageInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [userInputAddress, setUserInputAddress] = useState<string>(initialAddress);
  const [currentSearchAddress, setCurrentSearchAddress] = useState<string>('');
  const [nativeAddressForCurrentSearch, setNativeAddressForCurrentSearch] = useState<string | null>('');
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [isFetchingTransactions, setIsFetchingTransactions] = useState(false);
  const [isNavigatingToLastPage, setIsNavigatingToLastPage] = useState(false);
  const [isInitialDataSet, setIsInitialDataSet] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'desc' });
  const [isLastPageNavigable, setIsLastPageNavigable] = useState(true);

  // New block-based state
  const [blockCache, setBlockCache] = useState<Map<number, TransactionBlock>>(new Map());
  const [blockState, setBlockState] = useState<BlockPaginationState>({
    currentBlock: null,
    currentBlockStartPage: 1,
    remainingTransactions: []
  });

  // API function to fetch paginated transfers with configurable page size
  const fetchPaginatedTransfers = useCallback(async (
    nativeAddress: string,
    pageSize: number,
    cursor?: string | null
  ): Promise<ApiTransfersConnection> => {
    let paginationArgs = `first: ${pageSize}`;
    if (cursor) {
      paginationArgs += `, after: "${cursor}"`;
    }

    const query = `
      query GetTransfers($nativeAddressVariable: String!) {
        transfersConnection(
          orderBy: timestamp_DESC,
          where: {
            AND: [
              { success_eq: true },
              { OR: [
                  { from: { id_eq: $nativeAddressVariable } },
                  { to: { id_eq: $nativeAddressVariable } }
                ]
              }
            ]
          },
          ${paginationArgs}
        ) {
          edges {
            node {
              id
              timestamp
              denom
              amount
              success
              extrinsicHash
              extrinsicId
              type
              token {
                id
                name
                contractData
              }
              from { id evmAddress }
              to { id evmAddress }
              signedData
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
          totalCount
        }
      }
    `;

    const variables = {
      nativeAddressVariable: nativeAddress
    };

    const response = await axios.post(API_URL, { query, variables });
    
    if (response.data?.errors) {
      throw new Error(response.data.errors.map((e: GraphQLError) => e.message).join(', '));
    }

    if (response.data?.data?.transfersConnection) {
      return response.data.data.transfersConnection;
    } else {
      throw new Error('Invalid data structure or transfersConnection is null.');
    }
  }, []);

  // Process transaction edges into Transaction objects
  const processTransactionEdges = useCallback((edges: ApiTransactionEdge[]): Transaction[] => {
    const processedTransactions: Transaction[] = edges.map((edge) => {
      const tx = edge.node;

      // Safely parse signedData
      const signedData = parseSignedData(tx.signedData);
      const feeAmount = signedData?.fee?.partialFee || '0';

      // Safely parse contract_data which might be a stringified JSON
      let parsedContractData: ParsedContractData | undefined;
      try {
        if (tx.token?.contractData) {
          parsedContractData = typeof tx.token.contractData === 'string'
            ? JSON.parse(tx.token.contractData)
            : tx.token.contractData;
        }
      } catch (e) {
        // Silently ignore parsing errors
      }

      return {
        id: tx.id,
        hash: tx.extrinsicHash || '', // Populate hash
        timestamp: tx.timestamp,
        from: tx.from.id,
        to: tx.to.id,
        fromEvm: tx.from.evmAddress,
        toEvm: tx.to.evmAddress,
        amount: tx.amount,
        tokenSymbol: parsedContractData?.symbol || tx.token.name || 'Unknown',
        tokenDecimals: parsedContractData?.decimals ?? 18, // Default to 18 if not available
        success: tx.success,
        status: tx.success ? 'Success' : 'Fail', // Populate status
        extrinsicHash: tx.extrinsicHash,
        extrinsicId: tx.extrinsicId,
        type: determineDisplayType(tx.type, tx.from.id, tx.to.id, nativeAddressForCurrentSearch || ''),
        feeAmount,
        feeTokenSymbol: 'REEF', // Populate feeTokenSymbol
        signedData,
        raw: tx,
      };
    });

    return processedTransactions;
  }, [nativeAddressForCurrentSearch]);

  // Fetch a new block of transactions
  const fetchNewBlock = useCallback(async (
    nativeAddress: string,
    cursor?: string | null
  ): Promise<TransactionBlock> => {
    const fetchSize = PAGINATION_CONFIG.ENABLE_BLOCK_OPTIMIZATION 
      ? PAGINATION_CONFIG.BLOCK_FETCH_SIZE 
      : PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE;

    const apiData = await fetchPaginatedTransfers(nativeAddress, fetchSize, cursor);
    const processedTransactions = processTransactionEdges(apiData.edges);
    
    return createTransactionBlock(
      processedTransactions,
      apiData.pageInfo,
      apiData.totalCount,
      nativeAddress
    );
  }, [fetchPaginatedTransfers, processTransactionEdges]);

  // Load page data using block optimization
  const loadPageData = useCallback(async (
    pageNumber: number,
    nativeAddress: string,
    cursor?: string | null
  ) => {
    if (!nativeAddress) return;

    setIsFetchingTransactions(true);
    setError(null);

    try {
      // 1. Check if we can serve this page from the current block
      if (PAGINATION_CONFIG.ENABLE_BLOCK_OPTIMIZATION && 
          canServePageFromBlock(blockState.currentBlock, pageNumber, blockState.currentBlockStartPage)) {
        
        const result = extractPageFromBlock(blockState.currentBlock!, pageNumber, blockState.currentBlockStartPage);
        
        setTransactions(result.transactions);
        setCurrentPage(pageNumber);
        setHasNextPage(result.hasMore);
        setTotalTransactions(blockState.currentBlock!.totalCount);
        
        setPageInfoForCurrentPage({
          hasNextPage: result.hasMore,
          hasPreviousPage: pageNumber > 1,
          startCursor: blockState.currentBlock!.pageInfo.startCursor,
          endCursor: blockState.currentBlock!.pageInfo.endCursor
        });
        return; // Served from current block
      }

      // 2. Check if we can serve from a cached block
      for (const [startPage, cachedBlock] of blockCache.entries()) {
        if (canServePageFromBlock(cachedBlock, pageNumber, startPage)) {
          // Found a block in the cache! Use it.
          const result = extractPageFromBlock(cachedBlock, pageNumber, startPage);

          setBlockState({ currentBlock: cachedBlock, currentBlockStartPage: startPage, remainingTransactions: [] });
          setTransactions(result.transactions);
          setCurrentPage(pageNumber);
          setHasNextPage(result.hasMore);
          setTotalTransactions(cachedBlock.totalCount);
          setPageInfoForCurrentPage({
            hasNextPage: result.hasMore,
            hasPreviousPage: pageNumber > 1,
            startCursor: cachedBlock.pageInfo.startCursor,
            endCursor: cachedBlock.pageInfo.endCursor
          });
          return; // Served from cache
        }
      }

      // 3. Need to fetch a new block
      const newBlock = await fetchNewBlock(nativeAddress, cursor);
      
      // Add new block to cache
      setBlockCache(prevCache => new Map(prevCache).set(pageNumber, newBlock));
      
      // Update block state with the new block
      setBlockState({
        currentBlock: newBlock,
        currentBlockStartPage: pageNumber,
        remainingTransactions: []
      });

      // Extract first page from the new block
      const result = extractPageFromBlock(newBlock, pageNumber, pageNumber);
      
      setTransactions(result.transactions);
      setCurrentPage(pageNumber);
      setHasNextPage(result.hasMore);
      setTotalTransactions(newBlock.totalCount);
      
      setPageInfoForCurrentPage({
        hasNextPage: result.hasMore,
        hasPreviousPage: pageNumber > 1,
        startCursor: newBlock.pageInfo.startCursor,
        endCursor: newBlock.pageInfo.endCursor
      });

      const totalPages = Math.ceil(newBlock.totalCount / PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE);
      const pagesToJump = totalPages - pageNumber;
      setIsLastPageNavigable(pagesToJump <= PAGINATION_CONFIG.MAX_SEQUENTIAL_FETCH_PAGES);

    } catch (err) {
      // Only log errors in non-test environments to avoid stderr pollution during tests
      if (process.env.NODE_ENV !== 'test') {
        console.error('Error loading page data:', err);
      }
      setError({
        userMessage: 'Ошибка загрузки данных. Попробуйте обновить страницу.',
        originalError: err
      });
    } finally {
      setIsFetchingTransactions(false);
    }
  }, [blockState, fetchNewBlock, blockCache]);

  // Navigation handlers
  const handleNextPage = useCallback(async () => {
    if (!nativeAddressForCurrentSearch || isFetchingTransactions || !hasNextPage) return;
    const nextPage = currentPage + 1;
    await loadPageData(nextPage, nativeAddressForCurrentSearch, blockState.currentBlock?.pageInfo.endCursor);
  }, [currentPage, nativeAddressForCurrentSearch, isFetchingTransactions, blockState, loadPageData, hasNextPage]);

  const handlePreviousPage = useCallback(async () => {
    if (!nativeAddressForCurrentSearch || isFetchingTransactions || currentPage <= 1) return;
    const prevPage = currentPage - 1;
    await loadPageData(prevPage, nativeAddressForCurrentSearch, null); // Cursor is null for previous, cache will be checked
  }, [currentPage, nativeAddressForCurrentSearch, isFetchingTransactions, loadPageData]);

  const handleFirstPage = useCallback(async () => {
    if (!nativeAddressForCurrentSearch || isFetchingTransactions) return;
    await loadPageData(1, nativeAddressForCurrentSearch);
  }, [nativeAddressForCurrentSearch, isFetchingTransactions, loadPageData]);

  const handleLastPage = useCallback(async () => {
    if (!nativeAddressForCurrentSearch || isFetchingTransactions || !totalTransactions || !isLastPageNavigable) return;

    setIsNavigatingToLastPage(true);
    setError(null);

    try {
      const totalPages = Math.ceil(totalTransactions / PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE);
      if (currentPage === totalPages) {
        setIsNavigatingToLastPage(false);
        return;
      }

      let currentBlock = blockState.currentBlock;
      let currentBlockStartPage = blockState.currentBlockStartPage;
      const newCache = new Map(blockCache);

      while (currentBlock && currentBlock.pageInfo.hasNextPage && !canServePageFromBlock(currentBlock, totalPages, currentBlockStartPage)) {
        const nextBlockStartPage = currentBlockStartPage + getPagesInBlock(currentBlock);
        const newBlock = await fetchNewBlock(nativeAddressForCurrentSearch, currentBlock.pageInfo.endCursor);
        newCache.set(nextBlockStartPage, newBlock);
        currentBlock = newBlock;
        currentBlockStartPage = nextBlockStartPage;
      }
      
      setBlockCache(newCache);

      await loadPageData(totalPages, nativeAddressForCurrentSearch);

    } catch (err) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Error navigating to last page:', err);
      }
      setError({
        userMessage: 'Ошибка при переходе на последнюю страницу.',
        originalError: err,
      });
    } finally {
      setIsNavigatingToLastPage(false);
    }
  }, [
    nativeAddressForCurrentSearch,
    isFetchingTransactions,
    totalTransactions,
    currentPage,
    blockState,
    blockCache,
    loadPageData,
    fetchNewBlock,
    isLastPageNavigable,
  ]);

  // Address handling
  const handleAddressSubmit = useCallback(async (address: string) => {
    if (!address.trim()) return;

    setCurrentSearchAddress(address);
    setNativeAddressForCurrentSearch(null); // Reset while resolving
    setError(null);
    setTransactions([]);
    setCurrentPage(1);
    setBlockState({ currentBlock: null, currentBlockStartPage: 1, remainingTransactions: [] });
    setBlockCache(new Map());
    setIsInitialDataSet(false);
    setIsLastPageNavigable(true);

    try {
      // Resolve native address
      // For simplicity, we'll assume the input address is the native address
      setNativeAddressForCurrentSearch(address);
      
      // Load first page
      await loadPageData(1, address);
    } catch (err) {
      console.error('Error resolving address:', err);
    }
  }, [loadPageData]);

  // Sorting handler (simplified)
  const handleSort = useCallback((key: keyof Transaction | null) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
    // Note: Sorting with blocks would require re-fetching data with different orderBy
    // This is a simplified implementation
  }, []);

  // Cache stats
  const cacheStats = useMemo(() => {
    const stats = cacheManager.current.getStats();
    return {
      size: stats.size,
      maxSize: stats.maxSize,
      accessOrderLength: stats.accessOrderLength
    };
  }, []);

  // Block stats for debugging
  const blockStats = useMemo(() => ({
    hasCurrentBlock: blockState.currentBlock !== null,
    currentBlockStartPage: blockState.currentBlockStartPage,
    transactionsInBlock: blockState.currentBlock?.transactions.length || 0,
    pagesInBlock: blockState.currentBlock ? getPagesInBlock(blockState.currentBlock) : 0
  }), [blockState]);

  // Initialize with address if provided
  useEffect(() => {
    if (initialAddress && !isInitialDataSet) {
      handleAddressSubmit(initialAddress);
      setIsInitialDataSet(true);
    }
  }, [initialAddress, isInitialDataSet, handleAddressSubmit]);

  return {
    transactions,
    currentPage,
    hasNextPage,
    totalTransactions,
    error: error?.userMessage || null,
    isFetchingTransactions,
    isNavigatingToLastPage,
    isLastPageNavigable,
    userInputAddress,
    currentSearchAddress,
    nativeAddressForCurrentSearch,
    pageInfoForCurrentPage,
    sortConfig,
    handleFirstPage,
    handlePreviousPage,
    handleNextPage,
    handleLastPage,
    handleAddressSubmit,
    setUserInputAddress,
    handleSort,
    cacheStats,
    blockStats
  };
}

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import axios from 'axios';
import type { Transaction, SortConfig, SignedData } from '../types/transaction-types';
import type { ApiPageInfo, ApiTransfersConnection, ApiTransactionEdge } from '../types/reefscan-api';
import { PaginationCacheManager } from '../utils/cache-manager';
import { PAGINATION_CONFIG } from '../constants/pagination';
import { determineDisplayType } from '../utils/reefscan-helpers';

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
  isResolvingAddress: boolean;
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
}

// Helper functions
function validatePaginationParams(params: {
  currentPage?: number;
  totalTransactions?: number;
  nativeAddress?: string | null;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (params.currentPage !== undefined) {
    if (!Number.isInteger(params.currentPage) || params.currentPage < 1) {
      errors.push('Current page must be a positive integer');
    }
  }

  if (params.totalTransactions !== undefined) {
    if (!Number.isInteger(params.totalTransactions) || params.totalTransactions < 0) {
      errors.push('Total transactions must be a non-negative integer');
    }
  }

  if (params.nativeAddress !== undefined) {
    if (!params.nativeAddress || typeof params.nativeAddress !== 'string' || params.nativeAddress.trim().length === 0) {
      errors.push('Native address must be a non-empty string');
    }
  }

  return { isValid: errors.length === 0, errors };
}

function isAlreadyOnTargetPage(
  currentPage: number,
  targetPage: number,
  transactions: Transaction[],
  hasNextPage: boolean
): boolean {
  return currentPage === targetPage && 
         transactions.length > 0 && 
         (targetPage === 1 || !hasNextPage);
}

// Error handler class
class PaginationErrorHandler {
  static handleValidationError(errors: string[], context: string): AppError {
    const message = `Validation failed in ${context}: ${errors.join(', ')}`;
    return {
      userMessage: 'Некорректные данные. Проверьте введенные параметры.',
      originalError: message
    };
  }

  static async safeAsync<T>(
    operation: () => Promise<T>,
    _context: string
  ): Promise<{ success: true; data: T } | { success: false; error: AppError }> {
    try {
      const data = await operation();
      return { success: true, data };
    } catch (error) {
      return { 
        success: false, 
        error: { 
          userMessage: 'Ошибка загрузки данных. Попробуйте обновить страницу.', 
          originalError: error 
        } 
      };
    }
  }
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

// Main hook implementation
export function useTransactionData(initialAddress: string = ''): UseTransactionDataReturn {
  // Cache manager instance
  const cacheManager = useRef(new PaginationCacheManager());
  
  // State management
  const [pageInfoForCurrentPage, setPageInfoForCurrentPage] = useState<ApiPageInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [userInputAddress, setUserInputAddress] = useState<string>(initialAddress);
  const [currentSearchAddress, setCurrentSearchAddress] = useState<string>(initialAddress);
  const [nativeAddressForCurrentSearch, setNativeAddressForCurrentSearch] = useState<string | null>(null);
  const [isResolvingAddress, setIsResolvingAddress] = useState<boolean>(false);
  const [isFetchingTransactions, setIsFetchingTransactions] = useState<boolean>(false);
  const [isNavigatingToLastPage, setIsNavigatingToLastPage] = useState<boolean>(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });
  const [hasNextPage, setHasNextPage] = useState<boolean>(false);
  const [isInitialDataSet, setIsInitialDataSet] = useState<boolean>(false);
  const [totalTransactions, setTotalTransactions] = useState<number>(0);
  const [error, setError] = useState<AppError | null>(null);

  // API function to fetch paginated transfers
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
              token { id name }
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
  const processTransactionEdges = useCallback((edges: ApiTransactionEdge[], nativeAddress: string): Transaction[] => {
    return edges.map((edge) => {
      const tx = edge.node;
      
      // Use denom as primary token symbol, fallback to token.name or 'REEF'
      const tokenSymbol = tx.denom || tx.token?.name || 'REEF';
      
      // Known decimals map
      const knownDecimals: { [key: string]: number } = {
        'REEF': 18,
        'MRD': 18,
      };
      
      const tokenDecimals = knownDecimals[tokenSymbol] || 18;
      
      // Process amount with proper decimals
      let finalAmount: string | number = '0';
      if (tx.amount) {
        if (knownDecimals[tokenSymbol]) {
          const rawAmount = parseFloat(tx.amount);
          finalAmount = rawAmount / Math.pow(10, tokenDecimals);
        } else {
          finalAmount = tx.amount; // Display raw amount for unknown tokens
        }
      }

      const displayType = determineDisplayType(tx.from.id, tx.to.id, nativeAddress, tx.type || 'transfer');
      
      const parsedSignedData = parseSignedData(tx.signedData);
      
      let feeAmount = 0;
      if (parsedSignedData?.fee?.partialFee) {
        try {
          const feeInSmallestUnit = BigInt(parsedSignedData.fee.partialFee);
          feeAmount = Number(feeInSmallestUnit) / 1e18;
        } catch (e) {
          // console.error('Could not parse partialFee', parsedSignedData.fee.partialFee);
          feeAmount = 0;
        }
      }

      return {
        id: tx.id,
        hash: tx.extrinsicHash || tx.id,
        blockNumber: 0, // Would need to be fetched separately
        amount: finalAmount,
        tokenSymbol,
        tokenDecimals,
        displayType,
        feeAmount,
        feeTokenSymbol: 'REEF',
        signedData: parsedSignedData,
        timestamp: tx.timestamp,
        success: tx.success,
        status: tx.success ? 'Success' : 'Failed',
        type: tx.type,
        extrinsicId: tx.extrinsicId,
        extrinsicHash: tx.extrinsicHash,
        sender: tx.from.id,
        signer: tx.from.id,
        recipient: tx.to.id,
        from: tx.from.id,
        to: tx.to.id,
        section: tx.type === 'evm_call' ? 'evm' : 'balances',
        method: tx.type,
        raw: tx,
      };
    });
  }, []);

  // Safe error handling
  const safeSetError = useCallback((errorValue: AppError | null) => {
    setError(errorValue);
  }, []);

  // Reset state when address changes
  const resetPaginationState = useCallback(() => {
    setTransactions([]);
    setCurrentPage(1);
    setPageInfoForCurrentPage(null);
    setHasNextPage(false);
    setTotalTransactions(0);
    setError(null);
    setIsInitialDataSet(false);
    setIsFetchingTransactions(false);
    setIsNavigatingToLastPage(false);
    if (nativeAddressForCurrentSearch) {
      cacheManager.current.clearForAddress(nativeAddressForCurrentSearch);
    }
  }, [nativeAddressForCurrentSearch]);

  // Background prefetch function for adjacent pages
  const prefetchAdjacentPages = useCallback(async (currentPageNum: number, nativeAddress: string, currentPageInfo: ApiPageInfo) => {
    if (!nativeAddress || isFetchingTransactions || isNavigatingToLastPage) return;
    
    // Prefetch next page if it exists and not cached
    if (currentPageInfo.hasNextPage) {
      const nextPageNum = currentPageNum + 1;
      const nextPageCached = cacheManager.current.get(nativeAddress, nextPageNum, true);
      
      if (!nextPageCached && currentPageInfo.endCursor) {
        try {
          const nextPageData = await fetchPaginatedTransfers(
            nativeAddress,
            PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE,
            currentPageInfo.endCursor
          );
          
          const processedTransactions = processTransactionEdges(nextPageData.edges, nativeAddress);
          const cacheData = {
            transactions: processedTransactions,
            pageInfo: nextPageData.pageInfo,
            nativeAddress,
            totalCount: nextPageData.totalCount,
          };
          
          cacheManager.current.set(nativeAddress, nextPageNum, cacheData, true);
        } catch (error) {
          // Prefetch errors are silent to avoid disrupting user experience
        }
      }
    }
    
    // Prefetch previous page if not page 1 and not cached
    if (currentPageNum > 1) {
      const prevPageNum = currentPageNum - 1;
      const prevPageCached = cacheManager.current.get(nativeAddress, prevPageNum, true);
      
      if (!prevPageCached) {
        // Try to find a path to the previous page
        try {
          // Look for closest cached page before target
          let startPage = 1;
          let startCursor: string | null = null;
          
          for (let page = prevPageNum - 1; page >= 1; page--) {
            const cachedPage = cacheManager.current.get(nativeAddress, page, false);
            if (cachedPage) {
              startPage = page;
              startCursor = cachedPage.pageInfo.endCursor;
              break;
            }
          }
          
          // Only prefetch if we don't need to fetch too many pages
          const pagesToFetch = prevPageNum - startPage;
          if (pagesToFetch <= 2) { // Limit prefetch to avoid long operations
            let currentCursor = startCursor;
            
            for (let page = startPage + 1; page <= prevPageNum; page++) {
              const apiData = await fetchPaginatedTransfers(
                nativeAddress,
                PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE,
                currentCursor
              );
              
              const processedTransactions = processTransactionEdges(apiData.edges, nativeAddress);
              const cacheData = {
                transactions: processedTransactions,
                pageInfo: apiData.pageInfo,
                nativeAddress,
                totalCount: apiData.totalCount,
              };
              
              cacheManager.current.set(nativeAddress, page, cacheData, true);
              currentCursor = apiData.pageInfo.endCursor;
            }
          }
        } catch (error) {
          // Prefetch errors are silent
        }
      }
    }
  }, [fetchPaginatedTransfers, processTransactionEdges, isFetchingTransactions, isNavigatingToLastPage]);

  // Handle first page navigation
  const handleFirstPage = useCallback(async () => {
    const validation = validatePaginationParams({ nativeAddress: nativeAddressForCurrentSearch });
    if (!validation.isValid) {
      const error = PaginationErrorHandler.handleValidationError(validation.errors, 'handleFirstPage');
      safeSetError(error);
      return;
    }

    if (isAlreadyOnTargetPage(currentPage, 1, transactions, hasNextPage)) {
      return;
    }

    // Check UI cache first
    const cachedData = cacheManager.current.get(nativeAddressForCurrentSearch!, 1, true);
    if (cachedData) {
      setTransactions(cachedData.transactions);
      setCurrentPage(1);
      setPageInfoForCurrentPage(cachedData.pageInfo);
      setHasNextPage(cachedData.pageInfo.hasNextPage);
      setTotalTransactions(cachedData.totalCount);
      return;
    }

    // Fetch from API
    setIsFetchingTransactions(true);
    safeSetError(null);

    const result = await PaginationErrorHandler.safeAsync(
      () => fetchPaginatedTransfers(nativeAddressForCurrentSearch!, PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE),
      'handleFirstPage'
    );

    setIsFetchingTransactions(false);

    if (!result.success) {
      safeSetError(result.error);
      return;
    }

    const apiData = result.data;
    if (!apiData?.edges || apiData.edges.length === 0) {
      safeSetError({ userMessage: 'Транзакции не найдены', originalError: new Error('No transactions found') });
      return;
    }

    const processedTxs = processTransactionEdges(apiData.edges, nativeAddressForCurrentSearch!);
    
    // Update state
    setTransactions(processedTxs);
    setCurrentPage(1);
    setPageInfoForCurrentPage(apiData.pageInfo);
    setHasNextPage(apiData.pageInfo.hasNextPage);
    if (apiData.totalCount) {
      setTotalTransactions(apiData.totalCount);
    }
    setIsInitialDataSet(true);

    // Cache the result
    const cacheData = {
      transactions: processedTxs,
      pageInfo: apiData.pageInfo,
      nativeAddress: nativeAddressForCurrentSearch!,
      totalCount: apiData.totalCount ?? totalTransactions,
    };
    cacheManager.current.set(nativeAddressForCurrentSearch!, 1, cacheData, true);

    // Prefetch adjacent pages
    prefetchAdjacentPages(1, nativeAddressForCurrentSearch!, apiData.pageInfo);
  }, [nativeAddressForCurrentSearch, currentPage, transactions, hasNextPage, totalTransactions, safeSetError, fetchPaginatedTransfers, processTransactionEdges, prefetchAdjacentPages]);

  // Handle next page navigation
  const handleNextPage = useCallback(async () => {
    if (!nativeAddressForCurrentSearch || !pageInfoForCurrentPage || !hasNextPage || isFetchingTransactions) {
      return;
    }

    const nextPageNumber = currentPage + 1;

    // Check UI cache
    const cachedData = cacheManager.current.get(nativeAddressForCurrentSearch, nextPageNumber, true);
    if (cachedData) {
      setTransactions(cachedData.transactions);
      setCurrentPage(nextPageNumber);
      setPageInfoForCurrentPage(cachedData.pageInfo);
      setHasNextPage(cachedData.pageInfo.hasNextPage);
      setTotalTransactions(cachedData.totalCount);
      return;
    }

    // Fetch from API
    setIsFetchingTransactions(true);
    safeSetError(null);

    const result = await PaginationErrorHandler.safeAsync(
      () => fetchPaginatedTransfers(nativeAddressForCurrentSearch!, PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE, pageInfoForCurrentPage.endCursor),
      'handleNextPage'
    );

    setIsFetchingTransactions(false);

    if (!result.success) {
      safeSetError(result.error);
      return;
    }

    const apiData = result.data;
    if (!apiData?.edges || apiData.edges.length === 0) {
      setHasNextPage(false);
      return;
    }

    const processedTxs = processTransactionEdges(apiData.edges, nativeAddressForCurrentSearch!);
    setTransactions(processedTxs);
    setCurrentPage(nextPageNumber);
    setPageInfoForCurrentPage(apiData.pageInfo);
    setHasNextPage(apiData.pageInfo.hasNextPage);
    if (apiData.totalCount) setTotalTransactions(apiData.totalCount);

    const newCacheData = {
      transactions: processedTxs,
      pageInfo: apiData.pageInfo,
      nativeAddress: nativeAddressForCurrentSearch!,
      totalCount: apiData.totalCount ?? totalTransactions,
    };
    cacheManager.current.set(nativeAddressForCurrentSearch!, nextPageNumber, newCacheData, true);

    // Prefetch adjacent pages
    prefetchAdjacentPages(nextPageNumber, nativeAddressForCurrentSearch!, apiData.pageInfo);
  }, [nativeAddressForCurrentSearch, currentPage, hasNextPage, pageInfoForCurrentPage, isFetchingTransactions, safeSetError, fetchPaginatedTransfers, processTransactionEdges, prefetchAdjacentPages, totalTransactions]);

  // Handle previous page navigation
  const handlePreviousPage = useCallback(async () => {
    if (currentPage <= 1 || !nativeAddressForCurrentSearch || isFetchingTransactions) {
      return;
    }

    const prevPageNumber = currentPage - 1;
    const cachedData = cacheManager.current.get(nativeAddressForCurrentSearch, prevPageNumber, true);
    
    if (cachedData) {
      // Handle oversized cached pages by slicing to UI size
      let transactionsToDisplay = cachedData.transactions;
      if (transactionsToDisplay.length > PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE) {
        transactionsToDisplay = transactionsToDisplay.slice(0, PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE);
        
        // Update cache with properly sized data
        const updatedCacheData = {
          ...cachedData,
          transactions: transactionsToDisplay
        };
        cacheManager.current.set(nativeAddressForCurrentSearch, prevPageNumber, updatedCacheData, true);
      }
      
      setTransactions(transactionsToDisplay);
      setCurrentPage(prevPageNumber);
      setPageInfoForCurrentPage(cachedData.pageInfo);
      setHasNextPage(true); // Previous page always has next
      setTotalTransactions(cachedData.totalCount);
      return;
    }

    safeSetError({ userMessage: 'Предыдущая страница не найдена в кеше', originalError: 'Previous page not found in cache' });
  }, [nativeAddressForCurrentSearch, currentPage, isFetchingTransactions, safeSetError]);

  // Handle last page navigation
  const handleLastPage = useCallback(async () => {
    if (!nativeAddressForCurrentSearch || isFetchingTransactions || isNavigatingToLastPage) {
      return;
    }

    setIsNavigatingToLastPage(true);
    setIsFetchingTransactions(true);
    safeSetError(null);

    try {
      let finalTotal = totalTransactions;
      if (finalTotal <= 0) {
        const initialData = await fetchPaginatedTransfers(nativeAddressForCurrentSearch, 1);
        finalTotal = initialData.totalCount;
        setTotalTransactions(finalTotal);
      }

      if (finalTotal <= 0) {
        safeSetError({ userMessage: 'Не удалось определить общее количество транзакций.' });
        return;
      }

      const lastPageNumber = Math.ceil(finalTotal / PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE);
      if (currentPage === lastPageNumber) return;

      const cachedLastPage = cacheManager.current.get(nativeAddressForCurrentSearch, lastPageNumber, true);
      if (cachedLastPage) {
        setTransactions(cachedLastPage.transactions);
        setCurrentPage(lastPageNumber);
        setPageInfoForCurrentPage(cachedLastPage.pageInfo);
        setHasNextPage(cachedLastPage.pageInfo.hasNextPage);
        return;
      }

      // Sequential scan to find last page
      let currentCursor: string | null = null;
      let accumulatedCount = 0;

      while (accumulatedCount < finalTotal) {
        const apiData = await fetchPaginatedTransfers(nativeAddressForCurrentSearch, PAGINATION_CONFIG.SEQUENTIAL_FETCH_PAGE_SIZE, currentCursor);
        if (!apiData.edges || apiData.edges.length === 0) break;

        const processedTxs = processTransactionEdges(apiData.edges, nativeAddressForCurrentSearch);
        accumulatedCount += processedTxs.length;

        // Cache intermediate pages for backward navigation
        const numUiPagesInBatch = Math.ceil(processedTxs.length / PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE);
        for (let i = 0; i < numUiPagesInBatch; i++) {
          const startIdx = i * PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE;
          const endIdx = startIdx + PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE;
          const pageTransactions = processedTxs.slice(startIdx, endIdx);
          
          if (pageTransactions.length > 0) {
            const pageNum = Math.floor((accumulatedCount - processedTxs.length + startIdx) / PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE) + 1;
            const cacheData = {
              transactions: pageTransactions,
              pageInfo: { ...apiData.pageInfo, hasNextPage: pageNum < lastPageNumber },
              nativeAddress: nativeAddressForCurrentSearch,
              totalCount: finalTotal,
            };
            cacheManager.current.set(nativeAddressForCurrentSearch, pageNum, cacheData, true);
          }
        }

        currentCursor = apiData.pageInfo.endCursor;
        if (!apiData.pageInfo.hasNextPage) break;
      }

      // Load the last page
      const finalCachedPage = cacheManager.current.get(nativeAddressForCurrentSearch, lastPageNumber, true);
      if (finalCachedPage) {
        setTransactions(finalCachedPage.transactions);
        setCurrentPage(lastPageNumber);
        setPageInfoForCurrentPage(finalCachedPage.pageInfo);
        setHasNextPage(false);
      } else {
        safeSetError({ userMessage: 'Не удалось загрузить последнюю страницу.' });
      }
    } catch (e) {
      safeSetError({ userMessage: 'Произошла непредвиденная ошибка при переходе к последней странице.', originalError: e });
    } finally {
      setIsNavigatingToLastPage(false);
      setIsFetchingTransactions(false);
    }
  }, [nativeAddressForCurrentSearch, totalTransactions, currentPage, isFetchingTransactions, isNavigatingToLastPage, safeSetError, fetchPaginatedTransfers, processTransactionEdges]);

  // Handle address submission
  const handleAddressSubmit = useCallback(async (inputAddress: string) => {
    const trimmedAddress = inputAddress?.trim() || '';
    setUserInputAddress(trimmedAddress);
    resetPaginationState();
    
    if (!trimmedAddress) {
      safeSetError({ userMessage: 'Пожалуйста, введите адрес' });
      setNativeAddressForCurrentSearch(null);
      return;
    }
    
    setIsResolvingAddress(true);
    try {
      if (trimmedAddress.length < 47 || !trimmedAddress.startsWith('5')) {
        throw new Error('Неверный формат адреса Reef');
      }
      
      setCurrentSearchAddress(trimmedAddress);
      setNativeAddressForCurrentSearch(trimmedAddress);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при обработке адреса';
      safeSetError({ userMessage: errorMessage, originalError: err });
      setNativeAddressForCurrentSearch(null);
    } finally {
      setIsResolvingAddress(false);
    }
  }, [resetPaginationState, safeSetError]);

  // Handle sorting
  const handleSort = useCallback((key: keyof Transaction | null) => {
    setSortConfig(prevConfig => {
      if (prevConfig.key === key && prevConfig.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      if (prevConfig.key === key && prevConfig.direction === 'desc') {
        return { key: null, direction: 'asc' };
      }
      return { key, direction: 'asc' };
    });
  }, []);

  // Sorted transactions memo
  const sortedTransactions = useMemo(() => {
    if (!sortConfig.key) return transactions;
    const sortable = [...transactions];
    sortable.sort((a, b) => {
      const aValue = a[sortConfig.key!];
      const bValue = b[sortConfig.key!];

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortConfig.direction === 'asc' ? 1 : -1;
      if (bValue == null) return sortConfig.direction === 'asc' ? -1 : 1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        if (aValue === bValue) return 0;
        return sortConfig.direction === 'asc' ? (aValue ? 1 : -1) : (bValue ? 1 : -1);
      }
      try {
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      } catch (e) {
        // Comparison failed, treat as equal
      }
      return 0;
    });
    return sortable;
  }, [transactions, sortConfig]);

  // Effect to load initial data when native address is resolved
  useEffect(() => {
    if (nativeAddressForCurrentSearch && nativeAddressForCurrentSearch.trim() !== '' && !isInitialDataSet) {
      handleFirstPage();
    }
  }, [nativeAddressForCurrentSearch, isInitialDataSet, handleFirstPage]);

  // Prefetch effect - runs after successful navigation with delay
  useEffect(() => {
    let prefetchTimer: NodeJS.Timeout | undefined;

    // Only prefetch if we have valid data and are not currently fetching
    if (nativeAddressForCurrentSearch && pageInfoForCurrentPage && !isFetchingTransactions && !isNavigatingToLastPage) {
      // Add delay to avoid interfering with tests and user interactions
      prefetchTimer = setTimeout(() => {
        prefetchAdjacentPages(currentPage, nativeAddressForCurrentSearch, pageInfoForCurrentPage);
      }, 1000); // 1 second delay
    }

    return () => {
      if (prefetchTimer) {
        clearTimeout(prefetchTimer);
      }
    };
  }, [currentPage, nativeAddressForCurrentSearch, pageInfoForCurrentPage, isFetchingTransactions, isNavigatingToLastPage, prefetchAdjacentPages]);

  // Return hook interface
  return {
    transactions: sortedTransactions,
    currentPage,
    hasNextPage,
    totalTransactions,
    error: error?.userMessage || null,
    isFetchingTransactions,
    isNavigatingToLastPage,
    isResolvingAddress,
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
    cacheStats: cacheManager.current.getStats(),
  };
}
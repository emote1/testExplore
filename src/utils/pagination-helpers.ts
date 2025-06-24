/**
 * Pagination utility functions
 * Helper functions for transaction pagination logic
 */

import type { Transfer, PageInfo } from '../types/graphql-generated';
import { PAGINATION_CONFIG } from '../constants/pagination';
import type { CachedPageData } from '../data/cache-manager';

/**
 * Calculate total number of UI pages based on total transactions
 */
export function calculateTotalPages(totalTransactions: number): number {
  if (totalTransactions <= 0) return 1;
  return Math.ceil(totalTransactions / PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE);
}

/**
 * Calculate which UI pages can be created from a batch of transactions
 */
export function calculateUiPagesFromBatch(
  batchTransactions: Transfer[],
  batchPageNumber: number
): Array<{
  pageNumber: number;
  transactions: Transfer[];
  startIndex: number;
  endIndex: number;
}> {
  const pages: Array<{
    pageNumber: number;
    transactions: Transfer[];
    startIndex: number;
    endIndex: number;
  }> = [];

  if (batchTransactions.length <= PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE) {
    // Single UI page from this batch
    pages.push({
      pageNumber: batchPageNumber,
      transactions: batchTransactions,
      startIndex: 0,
      endIndex: batchTransactions.length,
    });
    return pages;
  }

  // Multiple UI pages from this batch
  const numUiPages = Math.ceil(batchTransactions.length / PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE);
  const baseUiPageNumber = (batchPageNumber - 1) * Math.floor(
    PAGINATION_CONFIG.SEQUENTIAL_FETCH_PAGE_SIZE / PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE
  ) + 1;

  for (let i = 0; i < numUiPages; i++) {
    const startIndex = i * PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE;
    const endIndex = Math.min(
      startIndex + PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE,
      batchTransactions.length
    );
    const uiPageTransactions = batchTransactions.slice(startIndex, endIndex);

    pages.push({
      pageNumber: baseUiPageNumber + i,
      transactions: uiPageTransactions,
      startIndex,
      endIndex,
    });
  }

  return pages;
}

/**
 * Extract the correct last page transactions from a batch
 */
export function extractLastPageTransactions(
  batchTransactions: Transfer[],
  totalTransactions: number
): Transfer[] {
  if (batchTransactions.length <= PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE) {
    return batchTransactions;
  }

  const remainingTransactions = totalTransactions % PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE;
  
  if (remainingTransactions > 0) {
    // Last page is partial
    const startIndex = Math.max(0, batchTransactions.length - remainingTransactions);
    return batchTransactions.slice(startIndex);
  } else {
    // Last page is full UI_TRANSACTIONS_PER_PAGE
    const startIndex = Math.max(0, batchTransactions.length - PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE);
    return batchTransactions.slice(startIndex);
  }
}

/**
 * Create UI page cache data from batch data
 */
export function createUiPageCacheData(
  transactions: Transfer[],
  pageInfo: PageInfo,
  nativeAddress: string,
  totalCount: number,
  hasNextPage: boolean,
  hasPreviousPage: boolean
): CachedPageData {
  return {
    transactions,
    pageInfo: {
      ...pageInfo,
      hasNextPage,
      hasPreviousPage,
    },
    nativeAddress,
    totalCount,
  };
}

/**
 * Validate pagination parameters
 */
export function validatePaginationParams(params: {
  currentPage?: number;
  totalTransactions?: number;
  nativeAddress?: string | null;
}): {
  isValid: boolean;
  errors: string[];
} {
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

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Check if we're already on the target page
 */
export function isAlreadyOnTargetPage(
  currentPage: number,
  targetPage: number,
  transactions: Transfer[],
  hasNextPage: boolean
): boolean {
  return currentPage === targetPage && 
         transactions.length > 0 && 
         (targetPage === 1 || !hasNextPage);
}

/**
 * Safe array slicing with bounds checking
 */
export function safeSlice<T>(
  array: T[],
  start: number,
  end?: number
): T[] {
  if (!Array.isArray(array)) {
    console.warn('[PAGINATION_HELPERS] safeSlice: Input is not an array');
    return [];
  }

  const safeStart = Math.max(0, Math.min(start, array.length));
  const safeEnd = end !== undefined ? Math.max(safeStart, Math.min(end, array.length)) : array.length;

  return array.slice(safeStart, safeEnd);
}

/**
 * Calculate batch page number from UI page number
 */
export function calculateBatchPageFromUiPage(uiPageNumber: number): number {
  const transactionsPerBatch = PAGINATION_CONFIG.SEQUENTIAL_FETCH_PAGE_SIZE;
  const transactionsPerUiPage = PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE;
  const uiPagesPerBatch = Math.floor(transactionsPerBatch / transactionsPerUiPage);
  
  return Math.ceil(uiPageNumber / uiPagesPerBatch);
}

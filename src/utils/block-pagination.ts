import type { UiTransfer } from '../data/transfer-mapper';
import type { PageInfo } from '../types/graphql-generated';
import { PAGINATION_CONFIG } from '../constants/pagination';

// New interfaces using AppTransaction
export interface AppTransactionBlock {
  transactions: UiTransfer[];
  pageInfo: PageInfo;
  totalCount: number;
  fetchedAt: number;
  nativeAddress: string;
}



/**
 * Creates a transaction block from API response
 */
export function createTransactionBlock(
  transactions: UiTransfer[],
  pageInfo: PageInfo,
  totalCount: number,
  nativeAddress: string
): AppTransactionBlock {
  return {
    transactions,
    pageInfo,
    totalCount,
    fetchedAt: Date.now(),
    nativeAddress
  };
}

/**
 * Extracts a page of transactions from a block
 */
export function extractPageFromBlock(
  block: AppTransactionBlock,
  pageNumber: number,
  blockStartPage: number
): { transactions: UiTransfer[]; hasMore: boolean } {
  const pageSize = PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE;
  const relativePageIndex = pageNumber - blockStartPage;
  const startIndex = relativePageIndex * pageSize;
  const endIndex = startIndex + pageSize;
  
  const transactions = block.transactions.slice(startIndex, endIndex);
  const hasMoreInBlock = endIndex < block.transactions.length;
  const hasMoreFromAPI = block.pageInfo.hasNextPage;
  
  return {
    transactions,
    hasMore: hasMoreInBlock || hasMoreFromAPI
  };
}

/**
 * Determines if a page can be served from the current block
 */
export function canServePageFromBlock(
  block: AppTransactionBlock | null,
  pageNumber: number,
  blockStartPage: number
): boolean {
  if (!block) return false;
  
  const pageSize = PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE;
  const relativePageIndex = pageNumber - blockStartPage;
  const startIndex = relativePageIndex * pageSize;
  
  return startIndex >= 0 && startIndex < block.transactions.length;
}

/**
 * Calculates how many pages can be served from a block
 */
export function getPagesInBlock(block: AppTransactionBlock): number {
  const pageSize = PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE;
  return Math.ceil(block.transactions.length / pageSize);
}



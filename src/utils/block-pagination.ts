import type { Transaction, TransactionBlock, BlockPaginationState } from '../types/transaction-types';
import type { ApiPageInfo } from '../types/reefscan-api';
import { PAGINATION_CONFIG } from '../constants/pagination';

/**
 * Creates a transaction block from API response
 */
export function createTransactionBlock(
  transactions: Transaction[],
  pageInfo: ApiPageInfo,
  totalCount: number,
  nativeAddress: string
): TransactionBlock {
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
  block: TransactionBlock,
  pageNumber: number,
  blockStartPage: number
): { transactions: Transaction[]; hasMore: boolean } {
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
  block: TransactionBlock | null,
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
export function getPagesInBlock(block: TransactionBlock): number {
  const pageSize = PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE;
  return Math.ceil(block.transactions.length / pageSize);
}

/**
 * Validates block pagination state
 */
export function validateBlockState(state: BlockPaginationState): boolean {
  if (!state.currentBlock) return true;
  
  const { currentBlock, currentBlockStartPage } = state;
  
  // Validate that start page is positive
  if (currentBlockStartPage < 1) return false;
  
  // Validate that block has transactions
  if (currentBlock.transactions.length === 0) return false;
  
  return true;
}

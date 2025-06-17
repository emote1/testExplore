import { describe, it, expect } from 'vitest';
import {
  createTransactionBlock,
  extractPageFromBlock,
  canServePageFromBlock,
  getPagesInBlock,
  validateBlockState
} from './block-pagination';
import type { Transaction, BlockPaginationState } from '../types/transaction-types';
import type { ApiPageInfo } from '../types/reefscan-api';
import { PAGINATION_CONFIG } from '../constants/pagination';

const UI_PAGE_SIZE = PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE; // Should be 10

// Mock data helpers
const createMockTransaction = (id: string): Transaction => ({
  id,
  hash: `hash-${id}`,
  from: `from-${id}`,
  to: `to-${id}`,
  timestamp: new Date().toISOString(),
  type: 'transfer',
  amount: '100',
  status: 'Success',
  success: true,
  feeAmount: '0.001',
  feeTokenSymbol: 'REEF',
  tokenSymbol: 'REEF',
  tokenDecimals: 18
});

const createMockPageInfo = (hasNextPage: boolean = true): ApiPageInfo => ({
  hasNextPage,
  hasPreviousPage: false,
  startCursor: 'start-cursor',
  endCursor: 'end-cursor'
});

describe('Block Pagination Utils', () => {
  describe('createTransactionBlock', () => {
    it('should create a valid transaction block', () => {
      const transactions = [createMockTransaction('1'), createMockTransaction('2')];
      const pageInfo = createMockPageInfo();
      const totalCount = 100;
      const nativeAddress = 'test-address';

      const block = createTransactionBlock(transactions, pageInfo, totalCount, nativeAddress);

      expect(block.transactions).toEqual(transactions);
      expect(block.pageInfo).toEqual(pageInfo);
      expect(block.totalCount).toBe(totalCount);
      expect(block.nativeAddress).toBe(nativeAddress);
      expect(block.fetchedAt).toBeTypeOf('number');
      expect(block.fetchedAt).toBeGreaterThan(0);
    });
  });

  describe('extractPageFromBlock', () => {
    it('should extract first page correctly', () => {
      const transactions = Array.from({ length: UI_PAGE_SIZE + 5 }, (_, i) => createMockTransaction(`${i + 1}`));
      const block = createTransactionBlock(transactions, createMockPageInfo(), 100, 'test-address');

      const result = extractPageFromBlock(block, 1, 1);

      expect(result.transactions).toHaveLength(UI_PAGE_SIZE);
      expect(result.transactions[0].id).toBe('1');
      expect(result.transactions[UI_PAGE_SIZE - 1].id).toBe(`${UI_PAGE_SIZE}`);
      expect(result.hasMore).toBe(true);
    });

    it('should extract middle page correctly', () => {
      const transactions = Array.from({ length: UI_PAGE_SIZE * 2 + 5 }, (_, i) => createMockTransaction(`${i + 1}`));
      const block = createTransactionBlock(transactions, createMockPageInfo(), 100, 'test-address');

      const result = extractPageFromBlock(block, 2, 1);

      expect(result.transactions).toHaveLength(UI_PAGE_SIZE);
      expect(result.transactions[0].id).toBe(`${UI_PAGE_SIZE + 1}`);
      expect(result.transactions[UI_PAGE_SIZE - 1].id).toBe(`${UI_PAGE_SIZE * 2}`);
      expect(result.hasMore).toBe(true);
    });

    it('should handle last page in block without API next page', () => {
      const transactions = Array.from({ length: UI_PAGE_SIZE * 2 + 5 }, (_, i) => createMockTransaction(`${i + 1}`));
      const block = createTransactionBlock(transactions, createMockPageInfo(false), 25, 'test-address');

      const result = extractPageFromBlock(block, 3, 1);

      expect(result.transactions).toHaveLength(transactions.length % UI_PAGE_SIZE);
      expect(result.transactions[0].id).toBe(`${UI_PAGE_SIZE * 2 + 1}`);
      expect(result.hasMore).toBe(false);
    });

    it('should handle last page in block with API next page', () => {
      const transactions = Array.from({ length: UI_PAGE_SIZE * 2 + 5 }, (_, i) => createMockTransaction(`${i + 1}`));
      const block = createTransactionBlock(transactions, createMockPageInfo(true), 100, 'test-address');

      const result = extractPageFromBlock(block, 3, 1);

      expect(result.transactions).toHaveLength(transactions.length % UI_PAGE_SIZE);
      expect(result.hasMore).toBe(true);
    });
  });

  describe('canServePageFromBlock', () => {
    it('should return false for null block', () => {
      const result = canServePageFromBlock(null, 1, 1);
      expect(result).toBe(false);
    });

    it('should return true for pages within block range', () => {
      const transactions = Array.from({ length: UI_PAGE_SIZE * 3 - 2 }, (_, i) => createMockTransaction(`${i + 1}`));
      const block = createTransactionBlock(transactions, createMockPageInfo(), 100, 'test-address');

      expect(canServePageFromBlock(block, 1, 1)).toBe(true);
      expect(canServePageFromBlock(block, 2, 1)).toBe(true);
      expect(canServePageFromBlock(block, 3, 1)).toBe(true);
    });

    it('should return false for pages outside block range', () => {
      const transactions = Array.from({ length: UI_PAGE_SIZE }, (_, i) => createMockTransaction(`${i + 1}`));
      const block = createTransactionBlock(transactions, createMockPageInfo(), 100, 'test-address');

      expect(canServePageFromBlock(block, 2, 1)).toBe(false);
    });

    it('should handle different block start pages', () => {
      const transactions = Array.from({ length: UI_PAGE_SIZE }, (_, i) => createMockTransaction(`${i + 1}`));
      const block = createTransactionBlock(transactions, createMockPageInfo(), 100, 'test-address');

      expect(canServePageFromBlock(block, 5, 5)).toBe(true);
      expect(canServePageFromBlock(block, 4, 5)).toBe(false);
      expect(canServePageFromBlock(block, 6, 5)).toBe(false);
    });
  });

  describe('getPagesInBlock', () => {
    it('should calculate pages correctly for full pages', () => {
      const transactions = Array.from({ length: UI_PAGE_SIZE * 4 }, (_, i) => createMockTransaction(`${i + 1}`));
      const block = createTransactionBlock(transactions, createMockPageInfo(), 100, 'test-address');

      const pages = getPagesInBlock(block);
      expect(pages).toBe(4);
    });

    it('should calculate pages correctly for partial last page', () => {
      const transactions = Array.from({ length: UI_PAGE_SIZE * 4 + 1 }, (_, i) => createMockTransaction(`${i + 1}`));
      const block = createTransactionBlock(transactions, createMockPageInfo(), 100, 'test-address');

      const pages = getPagesInBlock(block);
      expect(pages).toBe(5);
    });

    it('should handle empty block', () => {
      const block = createTransactionBlock([], createMockPageInfo(), 0, 'test-address');

      const pages = getPagesInBlock(block);
      expect(pages).toBe(0);
    });
  });

  describe('validateBlockState', () => {
    it('should return true for null block', () => {
      const state: BlockPaginationState = {
        currentBlock: null,
        currentBlockStartPage: 1,
        remainingTransactions: []
      };

      expect(validateBlockState(state)).toBe(true);
    });

    it('should return true for valid block state', () => {
      const transactions = Array.from({ length: UI_PAGE_SIZE * 2 }, (_, i) => createMockTransaction(`${i + 1}`));
      const block = createTransactionBlock(transactions, createMockPageInfo(), 100, 'test-address');
      
      const state: BlockPaginationState = {
        currentBlock: block,
        currentBlockStartPage: 1,
        remainingTransactions: []
      };

      expect(validateBlockState(state)).toBe(true);
    });

    it('should return false for invalid start page', () => {
      const transactions = Array.from({ length: UI_PAGE_SIZE * 2 }, (_, i) => createMockTransaction(`${i + 1}`));
      const block = createTransactionBlock(transactions, createMockPageInfo(), 100, 'test-address');
      
      const state: BlockPaginationState = {
        currentBlock: block,
        currentBlockStartPage: 0,
        remainingTransactions: []
      };

      expect(validateBlockState(state)).toBe(false);
    });

    it('should return false for empty block transactions', () => {
      const block = createTransactionBlock([], createMockPageInfo(), 0, 'test-address');
      
      const state: BlockPaginationState = {
        currentBlock: block,
        currentBlockStartPage: 1,
        remainingTransactions: []
      };

      expect(validateBlockState(state)).toBe(false);
    });
  });
});

/**
 * Cache manager for transaction pagination
 * Handles FIFO cache with access tracking and size management
 */

import type { Transfer, PageInfo } from '@/gql/graphql';
import { PAGINATION_CONFIG, CACHE_CONFIG } from '../constants/pagination';

export interface CachedPageData {
  transactions: Transfer[];
  pageInfo: PageInfo;
  nativeAddress: string;
  totalCount: number;
}

export class PaginationCacheManager {
  private cache = new Map<string, CachedPageData>();
  private accessOrder: string[] = [];

  /**
   * Generate cache key for a page
   */
  private generateCacheKey(
    nativeAddress: string, 
    pageNumber: number, 
    isUiCache = false
  ): string {
    const prefix = isUiCache ? CACHE_CONFIG.UI_CACHE_PREFIX : CACHE_CONFIG.PAGE_CACHE_PREFIX;
    return `${nativeAddress}${CACHE_CONFIG.CACHE_KEY_SEPARATOR}${prefix}${pageNumber}`;
  }

  /**
   * Get cached page data
   */
  get(nativeAddress: string, pageNumber: number, isUiCache = false): CachedPageData | null {
    const key = this.generateCacheKey(nativeAddress, pageNumber, isUiCache);
    const data = this.cache.get(key);
    
    if (data) {
      this.markAsAccessed(key);
      return data;
    }
    
    return null;
  }

  /**
   * Set cached page data
   */
  set(
    nativeAddress: string, 
    pageNumber: number, 
    data: CachedPageData, 
    isUiCache = false
  ): void {
    if (!this.isValidCacheData(data)) {
      console.warn('[CACHE] Invalid data provided, skipping cache set');
      return;
    }

    const key = this.generateCacheKey(nativeAddress, pageNumber, isUiCache);
    this.cache.set(key, data);
    this.markAsAccessed(key);
    this.manageCacheSize();
  }

  /**
   * Check if page exists in cache
   */
  has(nativeAddress: string, pageNumber: number, isUiCache = false): boolean {
    const key = this.generateCacheKey(nativeAddress, pageNumber, isUiCache);
    return this.cache.has(key);
  }

  /**
   * Mark a cache entry as accessed (for FIFO management)
   */
  private markAsAccessed(key: string): void {
    // Remove from current position if exists
    const existingIndex = this.accessOrder.indexOf(key);
    if (existingIndex !== -1) {
      this.accessOrder.splice(existingIndex, 1);
    }
    
    // Add to end (most recently accessed)
    this.accessOrder.push(key);
  }

  /**
   * Manage cache size using FIFO eviction
   */
  private manageCacheSize(): void {
    while (this.cache.size > PAGINATION_CONFIG.MAX_CACHE_SIZE && this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder.shift();
      if (oldestKey && this.cache.has(oldestKey)) {
        this.cache.delete(oldestKey);
        console.log(`[CACHE] Evicted oldest entry: ${oldestKey}`);
      }
    }
  }

  /**
   * Validate cache data before storing
   */
  private isValidCacheData(data: CachedPageData): boolean {
    return !!(
      data &&
      Array.isArray(data.transactions) &&
      data.pageInfo &&
      typeof data.nativeAddress === 'string' &&
      data.nativeAddress.length > 0 &&
      typeof data.totalCount === 'number' &&
      data.totalCount >= 0
    );
  }

  /**
   * Clear all cache entries for a specific address
   */
  clearForAddress(nativeAddress: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (key.startsWith(nativeAddress + CACHE_CONFIG.CACHE_KEY_SEPARATOR)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      const accessIndex = this.accessOrder.indexOf(key);
      if (accessIndex !== -1) {
        this.accessOrder.splice(accessIndex, 1);
      }
    });
    
    console.log(`[CACHE] Cleared ${keysToDelete.length} entries for address: ${nativeAddress}`);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    accessOrderLength: number;
  } {
    return {
      size: this.cache.size,
      maxSize: PAGINATION_CONFIG.MAX_CACHE_SIZE,
      accessOrderLength: this.accessOrder.length,
    };
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    console.log('[CACHE] All cache entries cleared');
  }
}

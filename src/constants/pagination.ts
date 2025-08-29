/**
 * Pagination constants for transaction history
 */

export const PAGINATION_CONFIG = {
  /** Number of transactions to display per page in the UI */
  UI_TRANSACTIONS_PER_PAGE: 10,
  
  /** Number of items to fetch per API request */
  API_FETCH_PAGE_SIZE: 30,
  
  /** Number of items to fetch per polling subscription request */
  SUBSCRIPTION_FETCH_SIZE: 10,
  
  /** Number of transactions to fetch per block for optimization */
  BLOCK_FETCH_SIZE: 50,
  
  /** Maximum number of pages to keep in cache */
  MAX_CACHE_SIZE: 50,
  
  /** Maximum number of pages to scan sequentially */
  MAX_SEQUENTIAL_FETCH_PAGES: 20,
  
  /** Maximum items for optimized last page fetch */
  MAX_OPTIMIZED_FETCH_COUNT: 50,
  
  /** Enable block-based pagination optimization */
  ENABLE_BLOCK_OPTIMIZATION: true,
  
  /** Polling interval in milliseconds */
  POLLING_INTERVAL_MS: 30000, // 30 seconds by default, less frequent than before
} as const;

export const API_CONFIG = {
  /** GraphQL endpoint for Subsquid API */
  API_URL: 'https://squid.subsquid.io/reef-explorer/graphql',
  
  /** Whether the API supports offset-based pagination */
  API_SUPPORTS_OFFSET: false,
} as const;

export const CACHE_CONFIG = {
  /** Prefix for regular page cache keys */
  PAGE_CACHE_PREFIX: '',
  
  /** Prefix for UI-sized page cache keys */
  UI_CACHE_PREFIX: 'ui-',
  
  /** Cache key separator */
  CACHE_KEY_SEPARATOR: '-',
} as const;

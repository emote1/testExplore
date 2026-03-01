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

  /** Number of UI pages to load ahead in non-fast mode (ladder/pipeline size) */
  NON_FAST_LADDER_UI_PAGES: 3,

  /** Enable fast mode for deep page jumps using offset/limit window fetches */
  ENABLE_FAST_OFFSET_MODE: true,

  /** Start using fast offset mode when page index is >= this threshold (low for Hasura with fast offset) */
  FAST_OFFSET_MODE_THRESHOLD_PAGES: 2,
  
  /** Maximum items for optimized last page fetch */
  MAX_OPTIMIZED_FETCH_COUNT: 50,
  
  /** Enable block-based pagination optimization */
  ENABLE_BLOCK_OPTIMIZATION: true,
  
  /** Polling interval in milliseconds */
  POLLING_INTERVAL_MS: 30000, // 30 seconds by default, less frequent than before

  /**
   * Use manual cache prepend in subscription instead of refetching the first page.
   * When true, `useTransferSubscription` will update Apollo cache directly via updateQuery,
   * dedupe by id and cap to API_FETCH_PAGE_SIZE. When false, it will refetch the first page.
   */
  SUB_PREPEND_WITHOUT_REFETCH: true,
} as const;

const ENV = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env) ?? {};

export const API_CONFIG = {
  /** GraphQL endpoint for Subsquid API */
  API_URL: ENV.VITE_REEF_EXPLORER_HTTP_URL ?? 'https://squid.subsquid.io/reef-explorer/graphql',
  
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

/**
 * Describes the structure of a single error message from the GraphQL API.
 */
export interface ApiErrorDetail {
  message: string;
  // extensions и другие поля можно добавить при необходимости
}

/**
 * Represents a potential list of errors in a GraphQL API response.
 */
export interface ApiError {
  errors?: ApiErrorDetail[];
}

/**
 * Represents a single account node, typically containing the native Reef address ID.
 * Used in the response for EVM to native address conversion.
 */
export interface ApiAccountNode {
  id: string;
}

/**
 * Contains a list of account nodes from the address conversion query.
 */
export interface ApiAccountData {
  accounts: ApiAccountNode[];
}

/**
 * Represents the full response structure for an EVM to native address conversion query.
 * Extends ApiError to include potential GraphQL errors.
 */
export interface ApiAccountResponse extends ApiError {
  data?: ApiAccountData;
}

/**
 * Contains pagination information for a connection (e.g., transactions list).
 */
export interface ApiPageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

/**
 * Represents a single transaction node as it is received directly from the Reefscan GraphQL API.
 * This is the raw transaction data structure.
 */
export interface GraphQLTransactionNode {
  id: string;
  extrinsicHash?: string;
  extrinsicId: string;
  from: { id: string; evmAddress?: string };
  to: { id: string; evmAddress?: string };
  timestamp: string;
  amount: string;
  success: boolean;
  type: string;
  denom?: string;
  token: ApiToken; // Use the ApiToken interface here
  signedData?: any;
  blockNumber: number;
  name?: string; // Для REEF20_TRANSFER (имя токена)
  contractAddress?: string; // Для REEF20_TRANSFER
  section?: string;
  method?: string;
}

/**
 * Represents an edge in a GraphQL connection, typically for a list of items.
 * Each edge contains a 'node' which holds the actual data (e.g., a transaction).
 */
export interface ApiTransactionEdge {
  node: GraphQLTransactionNode;
}

/**
 * Represents the 'transfersConnection' object from the GraphQL API.
 * It includes a list of transaction edges, pagination information, and the total count of transactions.
 */
export interface ApiTransfersConnection {
  edges: ApiTransactionEdge[];
  pageInfo: ApiPageInfo;
  totalCount: number;
}

/**
 * Represents the 'data' field within a successful GraphQL response for transaction queries.
 * It contains the 'allTransactionsData' (or aliased name) which is an ApiTransfersConnection.
 */
export interface ApiTransactionResponseData {
  allTransactionsData: ApiTransfersConnection; // Используем alias из запроса
}

/**
 * Represents the full Axios response structure for a transaction query.
 * It includes the main 'data' (ApiTransactionResponseData) and extends ApiError for potential GraphQL errors.
 */
export interface ApiFullTransactionResponse extends ApiError {
  data?: ApiTransactionResponseData;
}

/**
 * Represents the 'token' object in the API response
 */
export interface ApiToken {
  id: string;
  name?: string;
  contractData?: any; // Changed from nested contract.contract_data
}

/**
 * Represents a single transaction edge, containing the transaction node itself.
 */
export interface ApiTransactionEdge {
  node: GraphQLTransactionNode;
}

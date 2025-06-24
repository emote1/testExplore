import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
const defaultOptions = {} as const;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  BigInt: { input: any; output: any; }
  DateTime: { input: any; output: any; }
  JSON: { input: any; output: any; }
};

export type Account = {
  __typename?: 'Account';
  active: Scalars['Boolean']['output'];
  availableBalance: Scalars['BigInt']['output'];
  block: Block;
  contracts: Array<Contract>;
  evmAddress?: Maybe<Scalars['String']['output']>;
  evmNonce: Scalars['Int']['output'];
  freeBalance: Scalars['BigInt']['output'];
  /** Native address */
  id: Scalars['String']['output'];
  identity?: Maybe<Scalars['JSON']['output']>;
  lockedBalance: Scalars['BigInt']['output'];
  nonce: Scalars['Int']['output'];
  reservedBalance: Scalars['BigInt']['output'];
  timestamp: Scalars['DateTime']['output'];
  vestedBalance: Scalars['BigInt']['output'];
  votingBalance: Scalars['BigInt']['output'];
};


export type AccountContractsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ContractOrderByInput>>;
  where?: InputMaybe<ContractWhereInput>;
};

export type AccountEdge = {
  __typename?: 'AccountEdge';
  cursor: Scalars['String']['output'];
  node: Account;
};

export type AccountOrderByInput =
  | 'active_ASC'
  | 'active_ASC_NULLS_FIRST'
  | 'active_DESC'
  | 'active_DESC_NULLS_LAST'
  | 'availableBalance_ASC'
  | 'availableBalance_ASC_NULLS_FIRST'
  | 'availableBalance_DESC'
  | 'availableBalance_DESC_NULLS_LAST'
  | 'block_author_ASC'
  | 'block_author_ASC_NULLS_FIRST'
  | 'block_author_DESC'
  | 'block_author_DESC_NULLS_LAST'
  | 'block_extrinsicRoot_ASC'
  | 'block_extrinsicRoot_ASC_NULLS_FIRST'
  | 'block_extrinsicRoot_DESC'
  | 'block_extrinsicRoot_DESC_NULLS_LAST'
  | 'block_finalized_ASC'
  | 'block_finalized_ASC_NULLS_FIRST'
  | 'block_finalized_DESC'
  | 'block_finalized_DESC_NULLS_LAST'
  | 'block_hash_ASC'
  | 'block_hash_ASC_NULLS_FIRST'
  | 'block_hash_DESC'
  | 'block_hash_DESC_NULLS_LAST'
  | 'block_height_ASC'
  | 'block_height_ASC_NULLS_FIRST'
  | 'block_height_DESC'
  | 'block_height_DESC_NULLS_LAST'
  | 'block_id_ASC'
  | 'block_id_ASC_NULLS_FIRST'
  | 'block_id_DESC'
  | 'block_id_DESC_NULLS_LAST'
  | 'block_parentHash_ASC'
  | 'block_parentHash_ASC_NULLS_FIRST'
  | 'block_parentHash_DESC'
  | 'block_parentHash_DESC_NULLS_LAST'
  | 'block_processorTimestamp_ASC'
  | 'block_processorTimestamp_ASC_NULLS_FIRST'
  | 'block_processorTimestamp_DESC'
  | 'block_processorTimestamp_DESC_NULLS_LAST'
  | 'block_stateRoot_ASC'
  | 'block_stateRoot_ASC_NULLS_FIRST'
  | 'block_stateRoot_DESC'
  | 'block_stateRoot_DESC_NULLS_LAST'
  | 'block_timestamp_ASC'
  | 'block_timestamp_ASC_NULLS_FIRST'
  | 'block_timestamp_DESC'
  | 'block_timestamp_DESC_NULLS_LAST'
  | 'evmAddress_ASC'
  | 'evmAddress_ASC_NULLS_FIRST'
  | 'evmAddress_DESC'
  | 'evmAddress_DESC_NULLS_LAST'
  | 'evmNonce_ASC'
  | 'evmNonce_ASC_NULLS_FIRST'
  | 'evmNonce_DESC'
  | 'evmNonce_DESC_NULLS_LAST'
  | 'freeBalance_ASC'
  | 'freeBalance_ASC_NULLS_FIRST'
  | 'freeBalance_DESC'
  | 'freeBalance_DESC_NULLS_LAST'
  | 'id_ASC'
  | 'id_ASC_NULLS_FIRST'
  | 'id_DESC'
  | 'id_DESC_NULLS_LAST'
  | 'lockedBalance_ASC'
  | 'lockedBalance_ASC_NULLS_FIRST'
  | 'lockedBalance_DESC'
  | 'lockedBalance_DESC_NULLS_LAST'
  | 'nonce_ASC'
  | 'nonce_ASC_NULLS_FIRST'
  | 'nonce_DESC'
  | 'nonce_DESC_NULLS_LAST'
  | 'reservedBalance_ASC'
  | 'reservedBalance_ASC_NULLS_FIRST'
  | 'reservedBalance_DESC'
  | 'reservedBalance_DESC_NULLS_LAST'
  | 'timestamp_ASC'
  | 'timestamp_ASC_NULLS_FIRST'
  | 'timestamp_DESC'
  | 'timestamp_DESC_NULLS_LAST'
  | 'vestedBalance_ASC'
  | 'vestedBalance_ASC_NULLS_FIRST'
  | 'vestedBalance_DESC'
  | 'vestedBalance_DESC_NULLS_LAST'
  | 'votingBalance_ASC'
  | 'votingBalance_ASC_NULLS_FIRST'
  | 'votingBalance_DESC'
  | 'votingBalance_DESC_NULLS_LAST';

export type AccountWhereInput = {
  AND?: InputMaybe<Array<AccountWhereInput>>;
  OR?: InputMaybe<Array<AccountWhereInput>>;
  active_eq?: InputMaybe<Scalars['Boolean']['input']>;
  active_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  active_not_eq?: InputMaybe<Scalars['Boolean']['input']>;
  availableBalance_eq?: InputMaybe<Scalars['BigInt']['input']>;
  availableBalance_gt?: InputMaybe<Scalars['BigInt']['input']>;
  availableBalance_gte?: InputMaybe<Scalars['BigInt']['input']>;
  availableBalance_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  availableBalance_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  availableBalance_lt?: InputMaybe<Scalars['BigInt']['input']>;
  availableBalance_lte?: InputMaybe<Scalars['BigInt']['input']>;
  availableBalance_not_eq?: InputMaybe<Scalars['BigInt']['input']>;
  availableBalance_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  block?: InputMaybe<BlockWhereInput>;
  block_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  contracts_every?: InputMaybe<ContractWhereInput>;
  contracts_none?: InputMaybe<ContractWhereInput>;
  contracts_some?: InputMaybe<ContractWhereInput>;
  evmAddress_contains?: InputMaybe<Scalars['String']['input']>;
  evmAddress_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  evmAddress_endsWith?: InputMaybe<Scalars['String']['input']>;
  evmAddress_eq?: InputMaybe<Scalars['String']['input']>;
  evmAddress_gt?: InputMaybe<Scalars['String']['input']>;
  evmAddress_gte?: InputMaybe<Scalars['String']['input']>;
  evmAddress_in?: InputMaybe<Array<Scalars['String']['input']>>;
  evmAddress_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  evmAddress_lt?: InputMaybe<Scalars['String']['input']>;
  evmAddress_lte?: InputMaybe<Scalars['String']['input']>;
  evmAddress_not_contains?: InputMaybe<Scalars['String']['input']>;
  evmAddress_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  evmAddress_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  evmAddress_not_eq?: InputMaybe<Scalars['String']['input']>;
  evmAddress_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  evmAddress_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  evmAddress_startsWith?: InputMaybe<Scalars['String']['input']>;
  evmNonce_eq?: InputMaybe<Scalars['Int']['input']>;
  evmNonce_gt?: InputMaybe<Scalars['Int']['input']>;
  evmNonce_gte?: InputMaybe<Scalars['Int']['input']>;
  evmNonce_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  evmNonce_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  evmNonce_lt?: InputMaybe<Scalars['Int']['input']>;
  evmNonce_lte?: InputMaybe<Scalars['Int']['input']>;
  evmNonce_not_eq?: InputMaybe<Scalars['Int']['input']>;
  evmNonce_not_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  freeBalance_eq?: InputMaybe<Scalars['BigInt']['input']>;
  freeBalance_gt?: InputMaybe<Scalars['BigInt']['input']>;
  freeBalance_gte?: InputMaybe<Scalars['BigInt']['input']>;
  freeBalance_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  freeBalance_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  freeBalance_lt?: InputMaybe<Scalars['BigInt']['input']>;
  freeBalance_lte?: InputMaybe<Scalars['BigInt']['input']>;
  freeBalance_not_eq?: InputMaybe<Scalars['BigInt']['input']>;
  freeBalance_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  id_endsWith?: InputMaybe<Scalars['String']['input']>;
  id_eq?: InputMaybe<Scalars['String']['input']>;
  id_gt?: InputMaybe<Scalars['String']['input']>;
  id_gte?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<Scalars['String']['input']>>;
  id_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  id_lt?: InputMaybe<Scalars['String']['input']>;
  id_lte?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  id_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  id_not_eq?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  id_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  id_startsWith?: InputMaybe<Scalars['String']['input']>;
  identity_eq?: InputMaybe<Scalars['JSON']['input']>;
  identity_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  identity_jsonContains?: InputMaybe<Scalars['JSON']['input']>;
  identity_jsonHasKey?: InputMaybe<Scalars['JSON']['input']>;
  identity_not_eq?: InputMaybe<Scalars['JSON']['input']>;
  lockedBalance_eq?: InputMaybe<Scalars['BigInt']['input']>;
  lockedBalance_gt?: InputMaybe<Scalars['BigInt']['input']>;
  lockedBalance_gte?: InputMaybe<Scalars['BigInt']['input']>;
  lockedBalance_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  lockedBalance_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  lockedBalance_lt?: InputMaybe<Scalars['BigInt']['input']>;
  lockedBalance_lte?: InputMaybe<Scalars['BigInt']['input']>;
  lockedBalance_not_eq?: InputMaybe<Scalars['BigInt']['input']>;
  lockedBalance_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  nonce_eq?: InputMaybe<Scalars['Int']['input']>;
  nonce_gt?: InputMaybe<Scalars['Int']['input']>;
  nonce_gte?: InputMaybe<Scalars['Int']['input']>;
  nonce_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  nonce_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  nonce_lt?: InputMaybe<Scalars['Int']['input']>;
  nonce_lte?: InputMaybe<Scalars['Int']['input']>;
  nonce_not_eq?: InputMaybe<Scalars['Int']['input']>;
  nonce_not_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  reservedBalance_eq?: InputMaybe<Scalars['BigInt']['input']>;
  reservedBalance_gt?: InputMaybe<Scalars['BigInt']['input']>;
  reservedBalance_gte?: InputMaybe<Scalars['BigInt']['input']>;
  reservedBalance_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  reservedBalance_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  reservedBalance_lt?: InputMaybe<Scalars['BigInt']['input']>;
  reservedBalance_lte?: InputMaybe<Scalars['BigInt']['input']>;
  reservedBalance_not_eq?: InputMaybe<Scalars['BigInt']['input']>;
  reservedBalance_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  timestamp_eq?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_gt?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_gte?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_in?: InputMaybe<Array<Scalars['DateTime']['input']>>;
  timestamp_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  timestamp_lt?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_lte?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_not_eq?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_not_in?: InputMaybe<Array<Scalars['DateTime']['input']>>;
  vestedBalance_eq?: InputMaybe<Scalars['BigInt']['input']>;
  vestedBalance_gt?: InputMaybe<Scalars['BigInt']['input']>;
  vestedBalance_gte?: InputMaybe<Scalars['BigInt']['input']>;
  vestedBalance_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  vestedBalance_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  vestedBalance_lt?: InputMaybe<Scalars['BigInt']['input']>;
  vestedBalance_lte?: InputMaybe<Scalars['BigInt']['input']>;
  vestedBalance_not_eq?: InputMaybe<Scalars['BigInt']['input']>;
  vestedBalance_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  votingBalance_eq?: InputMaybe<Scalars['BigInt']['input']>;
  votingBalance_gt?: InputMaybe<Scalars['BigInt']['input']>;
  votingBalance_gte?: InputMaybe<Scalars['BigInt']['input']>;
  votingBalance_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  votingBalance_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  votingBalance_lt?: InputMaybe<Scalars['BigInt']['input']>;
  votingBalance_lte?: InputMaybe<Scalars['BigInt']['input']>;
  votingBalance_not_eq?: InputMaybe<Scalars['BigInt']['input']>;
  votingBalance_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
};

export type AccountsConnection = {
  __typename?: 'AccountsConnection';
  edges: Array<AccountEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type Block = {
  __typename?: 'Block';
  accounts: Array<Account>;
  author: Scalars['String']['output'];
  events: Array<Event>;
  extrinsicRoot: Scalars['String']['output'];
  extrinsics: Array<Extrinsic>;
  finalized: Scalars['Boolean']['output'];
  hash: Scalars['String']['output'];
  height: Scalars['Int']['output'];
  /** 000000..00<blockNum>-<shorthash> */
  id: Scalars['String']['output'];
  parentHash: Scalars['String']['output'];
  processorTimestamp?: Maybe<Scalars['DateTime']['output']>;
  stateRoot: Scalars['String']['output'];
  timestamp: Scalars['DateTime']['output'];
};


export type BlockAccountsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AccountOrderByInput>>;
  where?: InputMaybe<AccountWhereInput>;
};


export type BlockEventsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<EventOrderByInput>>;
  where?: InputMaybe<EventWhereInput>;
};


export type BlockExtrinsicsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ExtrinsicOrderByInput>>;
  where?: InputMaybe<ExtrinsicWhereInput>;
};

export type BlockEdge = {
  __typename?: 'BlockEdge';
  cursor: Scalars['String']['output'];
  node: Block;
};

export type BlockOrderByInput =
  | 'author_ASC'
  | 'author_ASC_NULLS_FIRST'
  | 'author_DESC'
  | 'author_DESC_NULLS_LAST'
  | 'extrinsicRoot_ASC'
  | 'extrinsicRoot_ASC_NULLS_FIRST'
  | 'extrinsicRoot_DESC'
  | 'extrinsicRoot_DESC_NULLS_LAST'
  | 'finalized_ASC'
  | 'finalized_ASC_NULLS_FIRST'
  | 'finalized_DESC'
  | 'finalized_DESC_NULLS_LAST'
  | 'hash_ASC'
  | 'hash_ASC_NULLS_FIRST'
  | 'hash_DESC'
  | 'hash_DESC_NULLS_LAST'
  | 'height_ASC'
  | 'height_ASC_NULLS_FIRST'
  | 'height_DESC'
  | 'height_DESC_NULLS_LAST'
  | 'id_ASC'
  | 'id_ASC_NULLS_FIRST'
  | 'id_DESC'
  | 'id_DESC_NULLS_LAST'
  | 'parentHash_ASC'
  | 'parentHash_ASC_NULLS_FIRST'
  | 'parentHash_DESC'
  | 'parentHash_DESC_NULLS_LAST'
  | 'processorTimestamp_ASC'
  | 'processorTimestamp_ASC_NULLS_FIRST'
  | 'processorTimestamp_DESC'
  | 'processorTimestamp_DESC_NULLS_LAST'
  | 'stateRoot_ASC'
  | 'stateRoot_ASC_NULLS_FIRST'
  | 'stateRoot_DESC'
  | 'stateRoot_DESC_NULLS_LAST'
  | 'timestamp_ASC'
  | 'timestamp_ASC_NULLS_FIRST'
  | 'timestamp_DESC'
  | 'timestamp_DESC_NULLS_LAST';

export type BlockWhereInput = {
  AND?: InputMaybe<Array<BlockWhereInput>>;
  OR?: InputMaybe<Array<BlockWhereInput>>;
  accounts_every?: InputMaybe<AccountWhereInput>;
  accounts_none?: InputMaybe<AccountWhereInput>;
  accounts_some?: InputMaybe<AccountWhereInput>;
  author_contains?: InputMaybe<Scalars['String']['input']>;
  author_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  author_endsWith?: InputMaybe<Scalars['String']['input']>;
  author_eq?: InputMaybe<Scalars['String']['input']>;
  author_gt?: InputMaybe<Scalars['String']['input']>;
  author_gte?: InputMaybe<Scalars['String']['input']>;
  author_in?: InputMaybe<Array<Scalars['String']['input']>>;
  author_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  author_lt?: InputMaybe<Scalars['String']['input']>;
  author_lte?: InputMaybe<Scalars['String']['input']>;
  author_not_contains?: InputMaybe<Scalars['String']['input']>;
  author_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  author_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  author_not_eq?: InputMaybe<Scalars['String']['input']>;
  author_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  author_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  author_startsWith?: InputMaybe<Scalars['String']['input']>;
  events_every?: InputMaybe<EventWhereInput>;
  events_none?: InputMaybe<EventWhereInput>;
  events_some?: InputMaybe<EventWhereInput>;
  extrinsicRoot_contains?: InputMaybe<Scalars['String']['input']>;
  extrinsicRoot_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  extrinsicRoot_endsWith?: InputMaybe<Scalars['String']['input']>;
  extrinsicRoot_eq?: InputMaybe<Scalars['String']['input']>;
  extrinsicRoot_gt?: InputMaybe<Scalars['String']['input']>;
  extrinsicRoot_gte?: InputMaybe<Scalars['String']['input']>;
  extrinsicRoot_in?: InputMaybe<Array<Scalars['String']['input']>>;
  extrinsicRoot_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  extrinsicRoot_lt?: InputMaybe<Scalars['String']['input']>;
  extrinsicRoot_lte?: InputMaybe<Scalars['String']['input']>;
  extrinsicRoot_not_contains?: InputMaybe<Scalars['String']['input']>;
  extrinsicRoot_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  extrinsicRoot_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  extrinsicRoot_not_eq?: InputMaybe<Scalars['String']['input']>;
  extrinsicRoot_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  extrinsicRoot_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  extrinsicRoot_startsWith?: InputMaybe<Scalars['String']['input']>;
  extrinsics_every?: InputMaybe<ExtrinsicWhereInput>;
  extrinsics_none?: InputMaybe<ExtrinsicWhereInput>;
  extrinsics_some?: InputMaybe<ExtrinsicWhereInput>;
  finalized_eq?: InputMaybe<Scalars['Boolean']['input']>;
  finalized_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  finalized_not_eq?: InputMaybe<Scalars['Boolean']['input']>;
  hash_contains?: InputMaybe<Scalars['String']['input']>;
  hash_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  hash_endsWith?: InputMaybe<Scalars['String']['input']>;
  hash_eq?: InputMaybe<Scalars['String']['input']>;
  hash_gt?: InputMaybe<Scalars['String']['input']>;
  hash_gte?: InputMaybe<Scalars['String']['input']>;
  hash_in?: InputMaybe<Array<Scalars['String']['input']>>;
  hash_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  hash_lt?: InputMaybe<Scalars['String']['input']>;
  hash_lte?: InputMaybe<Scalars['String']['input']>;
  hash_not_contains?: InputMaybe<Scalars['String']['input']>;
  hash_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  hash_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  hash_not_eq?: InputMaybe<Scalars['String']['input']>;
  hash_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  hash_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  hash_startsWith?: InputMaybe<Scalars['String']['input']>;
  height_eq?: InputMaybe<Scalars['Int']['input']>;
  height_gt?: InputMaybe<Scalars['Int']['input']>;
  height_gte?: InputMaybe<Scalars['Int']['input']>;
  height_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  height_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  height_lt?: InputMaybe<Scalars['Int']['input']>;
  height_lte?: InputMaybe<Scalars['Int']['input']>;
  height_not_eq?: InputMaybe<Scalars['Int']['input']>;
  height_not_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  id_endsWith?: InputMaybe<Scalars['String']['input']>;
  id_eq?: InputMaybe<Scalars['String']['input']>;
  id_gt?: InputMaybe<Scalars['String']['input']>;
  id_gte?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<Scalars['String']['input']>>;
  id_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  id_lt?: InputMaybe<Scalars['String']['input']>;
  id_lte?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  id_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  id_not_eq?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  id_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  id_startsWith?: InputMaybe<Scalars['String']['input']>;
  parentHash_contains?: InputMaybe<Scalars['String']['input']>;
  parentHash_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  parentHash_endsWith?: InputMaybe<Scalars['String']['input']>;
  parentHash_eq?: InputMaybe<Scalars['String']['input']>;
  parentHash_gt?: InputMaybe<Scalars['String']['input']>;
  parentHash_gte?: InputMaybe<Scalars['String']['input']>;
  parentHash_in?: InputMaybe<Array<Scalars['String']['input']>>;
  parentHash_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  parentHash_lt?: InputMaybe<Scalars['String']['input']>;
  parentHash_lte?: InputMaybe<Scalars['String']['input']>;
  parentHash_not_contains?: InputMaybe<Scalars['String']['input']>;
  parentHash_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  parentHash_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  parentHash_not_eq?: InputMaybe<Scalars['String']['input']>;
  parentHash_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  parentHash_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  parentHash_startsWith?: InputMaybe<Scalars['String']['input']>;
  processorTimestamp_eq?: InputMaybe<Scalars['DateTime']['input']>;
  processorTimestamp_gt?: InputMaybe<Scalars['DateTime']['input']>;
  processorTimestamp_gte?: InputMaybe<Scalars['DateTime']['input']>;
  processorTimestamp_in?: InputMaybe<Array<Scalars['DateTime']['input']>>;
  processorTimestamp_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  processorTimestamp_lt?: InputMaybe<Scalars['DateTime']['input']>;
  processorTimestamp_lte?: InputMaybe<Scalars['DateTime']['input']>;
  processorTimestamp_not_eq?: InputMaybe<Scalars['DateTime']['input']>;
  processorTimestamp_not_in?: InputMaybe<Array<Scalars['DateTime']['input']>>;
  stateRoot_contains?: InputMaybe<Scalars['String']['input']>;
  stateRoot_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  stateRoot_endsWith?: InputMaybe<Scalars['String']['input']>;
  stateRoot_eq?: InputMaybe<Scalars['String']['input']>;
  stateRoot_gt?: InputMaybe<Scalars['String']['input']>;
  stateRoot_gte?: InputMaybe<Scalars['String']['input']>;
  stateRoot_in?: InputMaybe<Array<Scalars['String']['input']>>;
  stateRoot_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  stateRoot_lt?: InputMaybe<Scalars['String']['input']>;
  stateRoot_lte?: InputMaybe<Scalars['String']['input']>;
  stateRoot_not_contains?: InputMaybe<Scalars['String']['input']>;
  stateRoot_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  stateRoot_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  stateRoot_not_eq?: InputMaybe<Scalars['String']['input']>;
  stateRoot_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  stateRoot_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  stateRoot_startsWith?: InputMaybe<Scalars['String']['input']>;
  timestamp_eq?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_gt?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_gte?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_in?: InputMaybe<Array<Scalars['DateTime']['input']>>;
  timestamp_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  timestamp_lt?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_lte?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_not_eq?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_not_in?: InputMaybe<Array<Scalars['DateTime']['input']>>;
};

export type BlocksConnection = {
  __typename?: 'BlocksConnection';
  edges: Array<BlockEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type ChainInfo = {
  __typename?: 'ChainInfo';
  count: Scalars['Int']['output'];
  /** Name */
  id: Scalars['String']['output'];
};

export type ChainInfoEdge = {
  __typename?: 'ChainInfoEdge';
  cursor: Scalars['String']['output'];
  node: ChainInfo;
};

export type ChainInfoOrderByInput =
  | 'count_ASC'
  | 'count_ASC_NULLS_FIRST'
  | 'count_DESC'
  | 'count_DESC_NULLS_LAST'
  | 'id_ASC'
  | 'id_ASC_NULLS_FIRST'
  | 'id_DESC'
  | 'id_DESC_NULLS_LAST';

export type ChainInfoWhereInput = {
  AND?: InputMaybe<Array<ChainInfoWhereInput>>;
  OR?: InputMaybe<Array<ChainInfoWhereInput>>;
  count_eq?: InputMaybe<Scalars['Int']['input']>;
  count_gt?: InputMaybe<Scalars['Int']['input']>;
  count_gte?: InputMaybe<Scalars['Int']['input']>;
  count_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  count_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  count_lt?: InputMaybe<Scalars['Int']['input']>;
  count_lte?: InputMaybe<Scalars['Int']['input']>;
  count_not_eq?: InputMaybe<Scalars['Int']['input']>;
  count_not_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  id_endsWith?: InputMaybe<Scalars['String']['input']>;
  id_eq?: InputMaybe<Scalars['String']['input']>;
  id_gt?: InputMaybe<Scalars['String']['input']>;
  id_gte?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<Scalars['String']['input']>>;
  id_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  id_lt?: InputMaybe<Scalars['String']['input']>;
  id_lte?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  id_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  id_not_eq?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  id_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  id_startsWith?: InputMaybe<Scalars['String']['input']>;
};

export type ChainInfosConnection = {
  __typename?: 'ChainInfosConnection';
  edges: Array<ChainInfoEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type Contract = {
  __typename?: 'Contract';
  bytecode: Scalars['String']['output'];
  bytecodeArguments: Scalars['String']['output'];
  bytecodeContext: Scalars['String']['output'];
  extrinsic: Extrinsic;
  gasLimit: Scalars['BigInt']['output'];
  /** Address */
  id: Scalars['String']['output'];
  signer: Account;
  storageLimit: Scalars['BigInt']['output'];
  timestamp: Scalars['DateTime']['output'];
};

export type ContractEdge = {
  __typename?: 'ContractEdge';
  cursor: Scalars['String']['output'];
  node: Contract;
};

export type ContractEntity = {
  __typename?: 'ContractEntity';
  address: Scalars['String']['output'];
  args?: Maybe<Scalars['JSON']['output']>;
  bytecode: Scalars['String']['output'];
  compiledData?: Maybe<Scalars['JSON']['output']>;
  filename?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  source?: Maybe<Scalars['JSON']['output']>;
};

export type ContractOrderByInput =
  | 'bytecodeArguments_ASC'
  | 'bytecodeArguments_ASC_NULLS_FIRST'
  | 'bytecodeArguments_DESC'
  | 'bytecodeArguments_DESC_NULLS_LAST'
  | 'bytecodeContext_ASC'
  | 'bytecodeContext_ASC_NULLS_FIRST'
  | 'bytecodeContext_DESC'
  | 'bytecodeContext_DESC_NULLS_LAST'
  | 'bytecode_ASC'
  | 'bytecode_ASC_NULLS_FIRST'
  | 'bytecode_DESC'
  | 'bytecode_DESC_NULLS_LAST'
  | 'extrinsic_docs_ASC'
  | 'extrinsic_docs_ASC_NULLS_FIRST'
  | 'extrinsic_docs_DESC'
  | 'extrinsic_docs_DESC_NULLS_LAST'
  | 'extrinsic_errorMessage_ASC'
  | 'extrinsic_errorMessage_ASC_NULLS_FIRST'
  | 'extrinsic_errorMessage_DESC'
  | 'extrinsic_errorMessage_DESC_NULLS_LAST'
  | 'extrinsic_hash_ASC'
  | 'extrinsic_hash_ASC_NULLS_FIRST'
  | 'extrinsic_hash_DESC'
  | 'extrinsic_hash_DESC_NULLS_LAST'
  | 'extrinsic_id_ASC'
  | 'extrinsic_id_ASC_NULLS_FIRST'
  | 'extrinsic_id_DESC'
  | 'extrinsic_id_DESC_NULLS_LAST'
  | 'extrinsic_index_ASC'
  | 'extrinsic_index_ASC_NULLS_FIRST'
  | 'extrinsic_index_DESC'
  | 'extrinsic_index_DESC_NULLS_LAST'
  | 'extrinsic_method_ASC'
  | 'extrinsic_method_ASC_NULLS_FIRST'
  | 'extrinsic_method_DESC'
  | 'extrinsic_method_DESC_NULLS_LAST'
  | 'extrinsic_section_ASC'
  | 'extrinsic_section_ASC_NULLS_FIRST'
  | 'extrinsic_section_DESC'
  | 'extrinsic_section_DESC_NULLS_LAST'
  | 'extrinsic_signer_ASC'
  | 'extrinsic_signer_ASC_NULLS_FIRST'
  | 'extrinsic_signer_DESC'
  | 'extrinsic_signer_DESC_NULLS_LAST'
  | 'extrinsic_status_ASC'
  | 'extrinsic_status_ASC_NULLS_FIRST'
  | 'extrinsic_status_DESC'
  | 'extrinsic_status_DESC_NULLS_LAST'
  | 'extrinsic_timestamp_ASC'
  | 'extrinsic_timestamp_ASC_NULLS_FIRST'
  | 'extrinsic_timestamp_DESC'
  | 'extrinsic_timestamp_DESC_NULLS_LAST'
  | 'extrinsic_type_ASC'
  | 'extrinsic_type_ASC_NULLS_FIRST'
  | 'extrinsic_type_DESC'
  | 'extrinsic_type_DESC_NULLS_LAST'
  | 'gasLimit_ASC'
  | 'gasLimit_ASC_NULLS_FIRST'
  | 'gasLimit_DESC'
  | 'gasLimit_DESC_NULLS_LAST'
  | 'id_ASC'
  | 'id_ASC_NULLS_FIRST'
  | 'id_DESC'
  | 'id_DESC_NULLS_LAST'
  | 'signer_active_ASC'
  | 'signer_active_ASC_NULLS_FIRST'
  | 'signer_active_DESC'
  | 'signer_active_DESC_NULLS_LAST'
  | 'signer_availableBalance_ASC'
  | 'signer_availableBalance_ASC_NULLS_FIRST'
  | 'signer_availableBalance_DESC'
  | 'signer_availableBalance_DESC_NULLS_LAST'
  | 'signer_evmAddress_ASC'
  | 'signer_evmAddress_ASC_NULLS_FIRST'
  | 'signer_evmAddress_DESC'
  | 'signer_evmAddress_DESC_NULLS_LAST'
  | 'signer_evmNonce_ASC'
  | 'signer_evmNonce_ASC_NULLS_FIRST'
  | 'signer_evmNonce_DESC'
  | 'signer_evmNonce_DESC_NULLS_LAST'
  | 'signer_freeBalance_ASC'
  | 'signer_freeBalance_ASC_NULLS_FIRST'
  | 'signer_freeBalance_DESC'
  | 'signer_freeBalance_DESC_NULLS_LAST'
  | 'signer_id_ASC'
  | 'signer_id_ASC_NULLS_FIRST'
  | 'signer_id_DESC'
  | 'signer_id_DESC_NULLS_LAST'
  | 'signer_lockedBalance_ASC'
  | 'signer_lockedBalance_ASC_NULLS_FIRST'
  | 'signer_lockedBalance_DESC'
  | 'signer_lockedBalance_DESC_NULLS_LAST'
  | 'signer_nonce_ASC'
  | 'signer_nonce_ASC_NULLS_FIRST'
  | 'signer_nonce_DESC'
  | 'signer_nonce_DESC_NULLS_LAST'
  | 'signer_reservedBalance_ASC'
  | 'signer_reservedBalance_ASC_NULLS_FIRST'
  | 'signer_reservedBalance_DESC'
  | 'signer_reservedBalance_DESC_NULLS_LAST'
  | 'signer_timestamp_ASC'
  | 'signer_timestamp_ASC_NULLS_FIRST'
  | 'signer_timestamp_DESC'
  | 'signer_timestamp_DESC_NULLS_LAST'
  | 'signer_vestedBalance_ASC'
  | 'signer_vestedBalance_ASC_NULLS_FIRST'
  | 'signer_vestedBalance_DESC'
  | 'signer_vestedBalance_DESC_NULLS_LAST'
  | 'signer_votingBalance_ASC'
  | 'signer_votingBalance_ASC_NULLS_FIRST'
  | 'signer_votingBalance_DESC'
  | 'signer_votingBalance_DESC_NULLS_LAST'
  | 'storageLimit_ASC'
  | 'storageLimit_ASC_NULLS_FIRST'
  | 'storageLimit_DESC'
  | 'storageLimit_DESC_NULLS_LAST'
  | 'timestamp_ASC'
  | 'timestamp_ASC_NULLS_FIRST'
  | 'timestamp_DESC'
  | 'timestamp_DESC_NULLS_LAST';

export type ContractType =
  | 'ERC20'
  | 'ERC721'
  | 'ERC1155'
  | 'other';

export type ContractWhereInput = {
  AND?: InputMaybe<Array<ContractWhereInput>>;
  OR?: InputMaybe<Array<ContractWhereInput>>;
  bytecodeArguments_contains?: InputMaybe<Scalars['String']['input']>;
  bytecodeArguments_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  bytecodeArguments_endsWith?: InputMaybe<Scalars['String']['input']>;
  bytecodeArguments_eq?: InputMaybe<Scalars['String']['input']>;
  bytecodeArguments_gt?: InputMaybe<Scalars['String']['input']>;
  bytecodeArguments_gte?: InputMaybe<Scalars['String']['input']>;
  bytecodeArguments_in?: InputMaybe<Array<Scalars['String']['input']>>;
  bytecodeArguments_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  bytecodeArguments_lt?: InputMaybe<Scalars['String']['input']>;
  bytecodeArguments_lte?: InputMaybe<Scalars['String']['input']>;
  bytecodeArguments_not_contains?: InputMaybe<Scalars['String']['input']>;
  bytecodeArguments_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  bytecodeArguments_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  bytecodeArguments_not_eq?: InputMaybe<Scalars['String']['input']>;
  bytecodeArguments_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  bytecodeArguments_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  bytecodeArguments_startsWith?: InputMaybe<Scalars['String']['input']>;
  bytecodeContext_contains?: InputMaybe<Scalars['String']['input']>;
  bytecodeContext_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  bytecodeContext_endsWith?: InputMaybe<Scalars['String']['input']>;
  bytecodeContext_eq?: InputMaybe<Scalars['String']['input']>;
  bytecodeContext_gt?: InputMaybe<Scalars['String']['input']>;
  bytecodeContext_gte?: InputMaybe<Scalars['String']['input']>;
  bytecodeContext_in?: InputMaybe<Array<Scalars['String']['input']>>;
  bytecodeContext_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  bytecodeContext_lt?: InputMaybe<Scalars['String']['input']>;
  bytecodeContext_lte?: InputMaybe<Scalars['String']['input']>;
  bytecodeContext_not_contains?: InputMaybe<Scalars['String']['input']>;
  bytecodeContext_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  bytecodeContext_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  bytecodeContext_not_eq?: InputMaybe<Scalars['String']['input']>;
  bytecodeContext_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  bytecodeContext_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  bytecodeContext_startsWith?: InputMaybe<Scalars['String']['input']>;
  bytecode_contains?: InputMaybe<Scalars['String']['input']>;
  bytecode_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  bytecode_endsWith?: InputMaybe<Scalars['String']['input']>;
  bytecode_eq?: InputMaybe<Scalars['String']['input']>;
  bytecode_gt?: InputMaybe<Scalars['String']['input']>;
  bytecode_gte?: InputMaybe<Scalars['String']['input']>;
  bytecode_in?: InputMaybe<Array<Scalars['String']['input']>>;
  bytecode_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  bytecode_lt?: InputMaybe<Scalars['String']['input']>;
  bytecode_lte?: InputMaybe<Scalars['String']['input']>;
  bytecode_not_contains?: InputMaybe<Scalars['String']['input']>;
  bytecode_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  bytecode_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  bytecode_not_eq?: InputMaybe<Scalars['String']['input']>;
  bytecode_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  bytecode_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  bytecode_startsWith?: InputMaybe<Scalars['String']['input']>;
  extrinsic?: InputMaybe<ExtrinsicWhereInput>;
  extrinsic_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  gasLimit_eq?: InputMaybe<Scalars['BigInt']['input']>;
  gasLimit_gt?: InputMaybe<Scalars['BigInt']['input']>;
  gasLimit_gte?: InputMaybe<Scalars['BigInt']['input']>;
  gasLimit_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  gasLimit_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  gasLimit_lt?: InputMaybe<Scalars['BigInt']['input']>;
  gasLimit_lte?: InputMaybe<Scalars['BigInt']['input']>;
  gasLimit_not_eq?: InputMaybe<Scalars['BigInt']['input']>;
  gasLimit_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  id_endsWith?: InputMaybe<Scalars['String']['input']>;
  id_eq?: InputMaybe<Scalars['String']['input']>;
  id_gt?: InputMaybe<Scalars['String']['input']>;
  id_gte?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<Scalars['String']['input']>>;
  id_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  id_lt?: InputMaybe<Scalars['String']['input']>;
  id_lte?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  id_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  id_not_eq?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  id_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  id_startsWith?: InputMaybe<Scalars['String']['input']>;
  signer?: InputMaybe<AccountWhereInput>;
  signer_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  storageLimit_eq?: InputMaybe<Scalars['BigInt']['input']>;
  storageLimit_gt?: InputMaybe<Scalars['BigInt']['input']>;
  storageLimit_gte?: InputMaybe<Scalars['BigInt']['input']>;
  storageLimit_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  storageLimit_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  storageLimit_lt?: InputMaybe<Scalars['BigInt']['input']>;
  storageLimit_lte?: InputMaybe<Scalars['BigInt']['input']>;
  storageLimit_not_eq?: InputMaybe<Scalars['BigInt']['input']>;
  storageLimit_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  timestamp_eq?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_gt?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_gte?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_in?: InputMaybe<Array<Scalars['DateTime']['input']>>;
  timestamp_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  timestamp_lt?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_lte?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_not_eq?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_not_in?: InputMaybe<Array<Scalars['DateTime']['input']>>;
};

export type ContractsConnection = {
  __typename?: 'ContractsConnection';
  edges: Array<ContractEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type EraValidatorInfo = {
  __typename?: 'EraValidatorInfo';
  address: Scalars['String']['output'];
  era: Scalars['Int']['output'];
  /** <eventId>-<address> */
  id: Scalars['String']['output'];
  others: Array<Maybe<IndividualExposure>>;
  othersWho: Scalars['String']['output'];
  own: Scalars['BigInt']['output'];
  total: Scalars['BigInt']['output'];
};

export type EraValidatorInfoEdge = {
  __typename?: 'EraValidatorInfoEdge';
  cursor: Scalars['String']['output'];
  node: EraValidatorInfo;
};

export type EraValidatorInfoOrderByInput =
  | 'address_ASC'
  | 'address_ASC_NULLS_FIRST'
  | 'address_DESC'
  | 'address_DESC_NULLS_LAST'
  | 'era_ASC'
  | 'era_ASC_NULLS_FIRST'
  | 'era_DESC'
  | 'era_DESC_NULLS_LAST'
  | 'id_ASC'
  | 'id_ASC_NULLS_FIRST'
  | 'id_DESC'
  | 'id_DESC_NULLS_LAST'
  | 'othersWho_ASC'
  | 'othersWho_ASC_NULLS_FIRST'
  | 'othersWho_DESC'
  | 'othersWho_DESC_NULLS_LAST'
  | 'own_ASC'
  | 'own_ASC_NULLS_FIRST'
  | 'own_DESC'
  | 'own_DESC_NULLS_LAST'
  | 'total_ASC'
  | 'total_ASC_NULLS_FIRST'
  | 'total_DESC'
  | 'total_DESC_NULLS_LAST';

export type EraValidatorInfoWhereInput = {
  AND?: InputMaybe<Array<EraValidatorInfoWhereInput>>;
  OR?: InputMaybe<Array<EraValidatorInfoWhereInput>>;
  address_contains?: InputMaybe<Scalars['String']['input']>;
  address_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  address_endsWith?: InputMaybe<Scalars['String']['input']>;
  address_eq?: InputMaybe<Scalars['String']['input']>;
  address_gt?: InputMaybe<Scalars['String']['input']>;
  address_gte?: InputMaybe<Scalars['String']['input']>;
  address_in?: InputMaybe<Array<Scalars['String']['input']>>;
  address_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  address_lt?: InputMaybe<Scalars['String']['input']>;
  address_lte?: InputMaybe<Scalars['String']['input']>;
  address_not_contains?: InputMaybe<Scalars['String']['input']>;
  address_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  address_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  address_not_eq?: InputMaybe<Scalars['String']['input']>;
  address_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  address_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  address_startsWith?: InputMaybe<Scalars['String']['input']>;
  era_eq?: InputMaybe<Scalars['Int']['input']>;
  era_gt?: InputMaybe<Scalars['Int']['input']>;
  era_gte?: InputMaybe<Scalars['Int']['input']>;
  era_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  era_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  era_lt?: InputMaybe<Scalars['Int']['input']>;
  era_lte?: InputMaybe<Scalars['Int']['input']>;
  era_not_eq?: InputMaybe<Scalars['Int']['input']>;
  era_not_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  id_endsWith?: InputMaybe<Scalars['String']['input']>;
  id_eq?: InputMaybe<Scalars['String']['input']>;
  id_gt?: InputMaybe<Scalars['String']['input']>;
  id_gte?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<Scalars['String']['input']>>;
  id_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  id_lt?: InputMaybe<Scalars['String']['input']>;
  id_lte?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  id_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  id_not_eq?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  id_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  id_startsWith?: InputMaybe<Scalars['String']['input']>;
  othersWho_contains?: InputMaybe<Scalars['String']['input']>;
  othersWho_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  othersWho_endsWith?: InputMaybe<Scalars['String']['input']>;
  othersWho_eq?: InputMaybe<Scalars['String']['input']>;
  othersWho_gt?: InputMaybe<Scalars['String']['input']>;
  othersWho_gte?: InputMaybe<Scalars['String']['input']>;
  othersWho_in?: InputMaybe<Array<Scalars['String']['input']>>;
  othersWho_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  othersWho_lt?: InputMaybe<Scalars['String']['input']>;
  othersWho_lte?: InputMaybe<Scalars['String']['input']>;
  othersWho_not_contains?: InputMaybe<Scalars['String']['input']>;
  othersWho_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  othersWho_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  othersWho_not_eq?: InputMaybe<Scalars['String']['input']>;
  othersWho_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  othersWho_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  othersWho_startsWith?: InputMaybe<Scalars['String']['input']>;
  others_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  own_eq?: InputMaybe<Scalars['BigInt']['input']>;
  own_gt?: InputMaybe<Scalars['BigInt']['input']>;
  own_gte?: InputMaybe<Scalars['BigInt']['input']>;
  own_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  own_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  own_lt?: InputMaybe<Scalars['BigInt']['input']>;
  own_lte?: InputMaybe<Scalars['BigInt']['input']>;
  own_not_eq?: InputMaybe<Scalars['BigInt']['input']>;
  own_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  total_eq?: InputMaybe<Scalars['BigInt']['input']>;
  total_gt?: InputMaybe<Scalars['BigInt']['input']>;
  total_gte?: InputMaybe<Scalars['BigInt']['input']>;
  total_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  total_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  total_lt?: InputMaybe<Scalars['BigInt']['input']>;
  total_lte?: InputMaybe<Scalars['BigInt']['input']>;
  total_not_eq?: InputMaybe<Scalars['BigInt']['input']>;
  total_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
};

export type EraValidatorInfosConnection = {
  __typename?: 'EraValidatorInfosConnection';
  edges: Array<EraValidatorInfoEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type Event = {
  __typename?: 'Event';
  block: Block;
  data: Scalars['JSON']['output'];
  extrinsic: Extrinsic;
  /** 000000..00<blockNum>-<shorthash>-000<index> */
  id: Scalars['String']['output'];
  index: Scalars['Int']['output'];
  method: Scalars['String']['output'];
  phase: Scalars['String']['output'];
  section: Scalars['String']['output'];
  timestamp: Scalars['DateTime']['output'];
};

export type EventEdge = {
  __typename?: 'EventEdge';
  cursor: Scalars['String']['output'];
  node: Event;
};

export type EventOrderByInput =
  | 'block_author_ASC'
  | 'block_author_ASC_NULLS_FIRST'
  | 'block_author_DESC'
  | 'block_author_DESC_NULLS_LAST'
  | 'block_extrinsicRoot_ASC'
  | 'block_extrinsicRoot_ASC_NULLS_FIRST'
  | 'block_extrinsicRoot_DESC'
  | 'block_extrinsicRoot_DESC_NULLS_LAST'
  | 'block_finalized_ASC'
  | 'block_finalized_ASC_NULLS_FIRST'
  | 'block_finalized_DESC'
  | 'block_finalized_DESC_NULLS_LAST'
  | 'block_hash_ASC'
  | 'block_hash_ASC_NULLS_FIRST'
  | 'block_hash_DESC'
  | 'block_hash_DESC_NULLS_LAST'
  | 'block_height_ASC'
  | 'block_height_ASC_NULLS_FIRST'
  | 'block_height_DESC'
  | 'block_height_DESC_NULLS_LAST'
  | 'block_id_ASC'
  | 'block_id_ASC_NULLS_FIRST'
  | 'block_id_DESC'
  | 'block_id_DESC_NULLS_LAST'
  | 'block_parentHash_ASC'
  | 'block_parentHash_ASC_NULLS_FIRST'
  | 'block_parentHash_DESC'
  | 'block_parentHash_DESC_NULLS_LAST'
  | 'block_processorTimestamp_ASC'
  | 'block_processorTimestamp_ASC_NULLS_FIRST'
  | 'block_processorTimestamp_DESC'
  | 'block_processorTimestamp_DESC_NULLS_LAST'
  | 'block_stateRoot_ASC'
  | 'block_stateRoot_ASC_NULLS_FIRST'
  | 'block_stateRoot_DESC'
  | 'block_stateRoot_DESC_NULLS_LAST'
  | 'block_timestamp_ASC'
  | 'block_timestamp_ASC_NULLS_FIRST'
  | 'block_timestamp_DESC'
  | 'block_timestamp_DESC_NULLS_LAST'
  | 'extrinsic_docs_ASC'
  | 'extrinsic_docs_ASC_NULLS_FIRST'
  | 'extrinsic_docs_DESC'
  | 'extrinsic_docs_DESC_NULLS_LAST'
  | 'extrinsic_errorMessage_ASC'
  | 'extrinsic_errorMessage_ASC_NULLS_FIRST'
  | 'extrinsic_errorMessage_DESC'
  | 'extrinsic_errorMessage_DESC_NULLS_LAST'
  | 'extrinsic_hash_ASC'
  | 'extrinsic_hash_ASC_NULLS_FIRST'
  | 'extrinsic_hash_DESC'
  | 'extrinsic_hash_DESC_NULLS_LAST'
  | 'extrinsic_id_ASC'
  | 'extrinsic_id_ASC_NULLS_FIRST'
  | 'extrinsic_id_DESC'
  | 'extrinsic_id_DESC_NULLS_LAST'
  | 'extrinsic_index_ASC'
  | 'extrinsic_index_ASC_NULLS_FIRST'
  | 'extrinsic_index_DESC'
  | 'extrinsic_index_DESC_NULLS_LAST'
  | 'extrinsic_method_ASC'
  | 'extrinsic_method_ASC_NULLS_FIRST'
  | 'extrinsic_method_DESC'
  | 'extrinsic_method_DESC_NULLS_LAST'
  | 'extrinsic_section_ASC'
  | 'extrinsic_section_ASC_NULLS_FIRST'
  | 'extrinsic_section_DESC'
  | 'extrinsic_section_DESC_NULLS_LAST'
  | 'extrinsic_signer_ASC'
  | 'extrinsic_signer_ASC_NULLS_FIRST'
  | 'extrinsic_signer_DESC'
  | 'extrinsic_signer_DESC_NULLS_LAST'
  | 'extrinsic_status_ASC'
  | 'extrinsic_status_ASC_NULLS_FIRST'
  | 'extrinsic_status_DESC'
  | 'extrinsic_status_DESC_NULLS_LAST'
  | 'extrinsic_timestamp_ASC'
  | 'extrinsic_timestamp_ASC_NULLS_FIRST'
  | 'extrinsic_timestamp_DESC'
  | 'extrinsic_timestamp_DESC_NULLS_LAST'
  | 'extrinsic_type_ASC'
  | 'extrinsic_type_ASC_NULLS_FIRST'
  | 'extrinsic_type_DESC'
  | 'extrinsic_type_DESC_NULLS_LAST'
  | 'id_ASC'
  | 'id_ASC_NULLS_FIRST'
  | 'id_DESC'
  | 'id_DESC_NULLS_LAST'
  | 'index_ASC'
  | 'index_ASC_NULLS_FIRST'
  | 'index_DESC'
  | 'index_DESC_NULLS_LAST'
  | 'method_ASC'
  | 'method_ASC_NULLS_FIRST'
  | 'method_DESC'
  | 'method_DESC_NULLS_LAST'
  | 'phase_ASC'
  | 'phase_ASC_NULLS_FIRST'
  | 'phase_DESC'
  | 'phase_DESC_NULLS_LAST'
  | 'section_ASC'
  | 'section_ASC_NULLS_FIRST'
  | 'section_DESC'
  | 'section_DESC_NULLS_LAST'
  | 'timestamp_ASC'
  | 'timestamp_ASC_NULLS_FIRST'
  | 'timestamp_DESC'
  | 'timestamp_DESC_NULLS_LAST';

export type EventWhereInput = {
  AND?: InputMaybe<Array<EventWhereInput>>;
  OR?: InputMaybe<Array<EventWhereInput>>;
  block?: InputMaybe<BlockWhereInput>;
  block_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  data_eq?: InputMaybe<Scalars['JSON']['input']>;
  data_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  data_jsonContains?: InputMaybe<Scalars['JSON']['input']>;
  data_jsonHasKey?: InputMaybe<Scalars['JSON']['input']>;
  data_not_eq?: InputMaybe<Scalars['JSON']['input']>;
  extrinsic?: InputMaybe<ExtrinsicWhereInput>;
  extrinsic_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  id_endsWith?: InputMaybe<Scalars['String']['input']>;
  id_eq?: InputMaybe<Scalars['String']['input']>;
  id_gt?: InputMaybe<Scalars['String']['input']>;
  id_gte?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<Scalars['String']['input']>>;
  id_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  id_lt?: InputMaybe<Scalars['String']['input']>;
  id_lte?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  id_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  id_not_eq?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  id_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  id_startsWith?: InputMaybe<Scalars['String']['input']>;
  index_eq?: InputMaybe<Scalars['Int']['input']>;
  index_gt?: InputMaybe<Scalars['Int']['input']>;
  index_gte?: InputMaybe<Scalars['Int']['input']>;
  index_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  index_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  index_lt?: InputMaybe<Scalars['Int']['input']>;
  index_lte?: InputMaybe<Scalars['Int']['input']>;
  index_not_eq?: InputMaybe<Scalars['Int']['input']>;
  index_not_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  method_contains?: InputMaybe<Scalars['String']['input']>;
  method_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  method_endsWith?: InputMaybe<Scalars['String']['input']>;
  method_eq?: InputMaybe<Scalars['String']['input']>;
  method_gt?: InputMaybe<Scalars['String']['input']>;
  method_gte?: InputMaybe<Scalars['String']['input']>;
  method_in?: InputMaybe<Array<Scalars['String']['input']>>;
  method_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  method_lt?: InputMaybe<Scalars['String']['input']>;
  method_lte?: InputMaybe<Scalars['String']['input']>;
  method_not_contains?: InputMaybe<Scalars['String']['input']>;
  method_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  method_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  method_not_eq?: InputMaybe<Scalars['String']['input']>;
  method_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  method_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  method_startsWith?: InputMaybe<Scalars['String']['input']>;
  phase_contains?: InputMaybe<Scalars['String']['input']>;
  phase_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  phase_endsWith?: InputMaybe<Scalars['String']['input']>;
  phase_eq?: InputMaybe<Scalars['String']['input']>;
  phase_gt?: InputMaybe<Scalars['String']['input']>;
  phase_gte?: InputMaybe<Scalars['String']['input']>;
  phase_in?: InputMaybe<Array<Scalars['String']['input']>>;
  phase_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  phase_lt?: InputMaybe<Scalars['String']['input']>;
  phase_lte?: InputMaybe<Scalars['String']['input']>;
  phase_not_contains?: InputMaybe<Scalars['String']['input']>;
  phase_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  phase_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  phase_not_eq?: InputMaybe<Scalars['String']['input']>;
  phase_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  phase_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  phase_startsWith?: InputMaybe<Scalars['String']['input']>;
  section_contains?: InputMaybe<Scalars['String']['input']>;
  section_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  section_endsWith?: InputMaybe<Scalars['String']['input']>;
  section_eq?: InputMaybe<Scalars['String']['input']>;
  section_gt?: InputMaybe<Scalars['String']['input']>;
  section_gte?: InputMaybe<Scalars['String']['input']>;
  section_in?: InputMaybe<Array<Scalars['String']['input']>>;
  section_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  section_lt?: InputMaybe<Scalars['String']['input']>;
  section_lte?: InputMaybe<Scalars['String']['input']>;
  section_not_contains?: InputMaybe<Scalars['String']['input']>;
  section_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  section_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  section_not_eq?: InputMaybe<Scalars['String']['input']>;
  section_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  section_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  section_startsWith?: InputMaybe<Scalars['String']['input']>;
  timestamp_eq?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_gt?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_gte?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_in?: InputMaybe<Array<Scalars['DateTime']['input']>>;
  timestamp_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  timestamp_lt?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_lte?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_not_eq?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_not_in?: InputMaybe<Array<Scalars['DateTime']['input']>>;
};

export type EventsConnection = {
  __typename?: 'EventsConnection';
  edges: Array<EventEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type EvmEvent = {
  __typename?: 'EvmEvent';
  blockHash: Scalars['String']['output'];
  blockHeight: Scalars['Int']['output'];
  contractAddress: Scalars['String']['output'];
  dataParsed: Scalars['JSON']['output'];
  dataRaw: Scalars['JSON']['output'];
  eventIndex: Scalars['Int']['output'];
  extrinsicHash: Scalars['String']['output'];
  extrinsicIndex: Scalars['Int']['output'];
  finalized: Scalars['Boolean']['output'];
  /** 000000..00<blockNum>-<shorthash>-000<index> */
  id: Scalars['String']['output'];
  method: Scalars['String']['output'];
  status: EvmEventStatus;
  timestamp: Scalars['DateTime']['output'];
  topic0?: Maybe<Scalars['String']['output']>;
  topic1?: Maybe<Scalars['String']['output']>;
  topic2?: Maybe<Scalars['String']['output']>;
  topic3?: Maybe<Scalars['String']['output']>;
  type: EvmEventType;
};

export type EvmEventDataParsedInput = {
  dataParsed: Scalars['String']['input'];
  id: Scalars['String']['input'];
};

export type EvmEventEdge = {
  __typename?: 'EvmEventEdge';
  cursor: Scalars['String']['output'];
  node: EvmEvent;
};

export type EvmEventEntity = {
  __typename?: 'EvmEventEntity';
  blockHash: Scalars['String']['output'];
  blockHeight: Scalars['Int']['output'];
  extrinsicHash: Scalars['String']['output'];
  extrinsicId: Scalars['String']['output'];
  extrinsicIndex: Scalars['Int']['output'];
  finalized: Scalars['Boolean']['output'];
  id: Scalars['String']['output'];
  rawData: Scalars['JSON']['output'];
  signedData?: Maybe<Scalars['JSON']['output']>;
  timestamp: Scalars['DateTime']['output'];
};

export type EvmEventOrderByInput =
  | 'blockHash_ASC'
  | 'blockHash_ASC_NULLS_FIRST'
  | 'blockHash_DESC'
  | 'blockHash_DESC_NULLS_LAST'
  | 'blockHeight_ASC'
  | 'blockHeight_ASC_NULLS_FIRST'
  | 'blockHeight_DESC'
  | 'blockHeight_DESC_NULLS_LAST'
  | 'contractAddress_ASC'
  | 'contractAddress_ASC_NULLS_FIRST'
  | 'contractAddress_DESC'
  | 'contractAddress_DESC_NULLS_LAST'
  | 'eventIndex_ASC'
  | 'eventIndex_ASC_NULLS_FIRST'
  | 'eventIndex_DESC'
  | 'eventIndex_DESC_NULLS_LAST'
  | 'extrinsicHash_ASC'
  | 'extrinsicHash_ASC_NULLS_FIRST'
  | 'extrinsicHash_DESC'
  | 'extrinsicHash_DESC_NULLS_LAST'
  | 'extrinsicIndex_ASC'
  | 'extrinsicIndex_ASC_NULLS_FIRST'
  | 'extrinsicIndex_DESC'
  | 'extrinsicIndex_DESC_NULLS_LAST'
  | 'finalized_ASC'
  | 'finalized_ASC_NULLS_FIRST'
  | 'finalized_DESC'
  | 'finalized_DESC_NULLS_LAST'
  | 'id_ASC'
  | 'id_ASC_NULLS_FIRST'
  | 'id_DESC'
  | 'id_DESC_NULLS_LAST'
  | 'method_ASC'
  | 'method_ASC_NULLS_FIRST'
  | 'method_DESC'
  | 'method_DESC_NULLS_LAST'
  | 'status_ASC'
  | 'status_ASC_NULLS_FIRST'
  | 'status_DESC'
  | 'status_DESC_NULLS_LAST'
  | 'timestamp_ASC'
  | 'timestamp_ASC_NULLS_FIRST'
  | 'timestamp_DESC'
  | 'timestamp_DESC_NULLS_LAST'
  | 'topic0_ASC'
  | 'topic0_ASC_NULLS_FIRST'
  | 'topic0_DESC'
  | 'topic0_DESC_NULLS_LAST'
  | 'topic1_ASC'
  | 'topic1_ASC_NULLS_FIRST'
  | 'topic1_DESC'
  | 'topic1_DESC_NULLS_LAST'
  | 'topic2_ASC'
  | 'topic2_ASC_NULLS_FIRST'
  | 'topic2_DESC'
  | 'topic2_DESC_NULLS_LAST'
  | 'topic3_ASC'
  | 'topic3_ASC_NULLS_FIRST'
  | 'topic3_DESC'
  | 'topic3_DESC_NULLS_LAST'
  | 'type_ASC'
  | 'type_ASC_NULLS_FIRST'
  | 'type_DESC'
  | 'type_DESC_NULLS_LAST';

export type EvmEventStatus =
  | 'Error'
  | 'Success';

export type EvmEventType =
  | 'Unverified'
  | 'Verified';

export type EvmEventWhereInput = {
  AND?: InputMaybe<Array<EvmEventWhereInput>>;
  OR?: InputMaybe<Array<EvmEventWhereInput>>;
  blockHash_contains?: InputMaybe<Scalars['String']['input']>;
  blockHash_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  blockHash_endsWith?: InputMaybe<Scalars['String']['input']>;
  blockHash_eq?: InputMaybe<Scalars['String']['input']>;
  blockHash_gt?: InputMaybe<Scalars['String']['input']>;
  blockHash_gte?: InputMaybe<Scalars['String']['input']>;
  blockHash_in?: InputMaybe<Array<Scalars['String']['input']>>;
  blockHash_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  blockHash_lt?: InputMaybe<Scalars['String']['input']>;
  blockHash_lte?: InputMaybe<Scalars['String']['input']>;
  blockHash_not_contains?: InputMaybe<Scalars['String']['input']>;
  blockHash_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  blockHash_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  blockHash_not_eq?: InputMaybe<Scalars['String']['input']>;
  blockHash_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  blockHash_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  blockHash_startsWith?: InputMaybe<Scalars['String']['input']>;
  blockHeight_eq?: InputMaybe<Scalars['Int']['input']>;
  blockHeight_gt?: InputMaybe<Scalars['Int']['input']>;
  blockHeight_gte?: InputMaybe<Scalars['Int']['input']>;
  blockHeight_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  blockHeight_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  blockHeight_lt?: InputMaybe<Scalars['Int']['input']>;
  blockHeight_lte?: InputMaybe<Scalars['Int']['input']>;
  blockHeight_not_eq?: InputMaybe<Scalars['Int']['input']>;
  blockHeight_not_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  contractAddress_contains?: InputMaybe<Scalars['String']['input']>;
  contractAddress_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  contractAddress_endsWith?: InputMaybe<Scalars['String']['input']>;
  contractAddress_eq?: InputMaybe<Scalars['String']['input']>;
  contractAddress_gt?: InputMaybe<Scalars['String']['input']>;
  contractAddress_gte?: InputMaybe<Scalars['String']['input']>;
  contractAddress_in?: InputMaybe<Array<Scalars['String']['input']>>;
  contractAddress_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  contractAddress_lt?: InputMaybe<Scalars['String']['input']>;
  contractAddress_lte?: InputMaybe<Scalars['String']['input']>;
  contractAddress_not_contains?: InputMaybe<Scalars['String']['input']>;
  contractAddress_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  contractAddress_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  contractAddress_not_eq?: InputMaybe<Scalars['String']['input']>;
  contractAddress_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  contractAddress_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  contractAddress_startsWith?: InputMaybe<Scalars['String']['input']>;
  dataParsed_eq?: InputMaybe<Scalars['JSON']['input']>;
  dataParsed_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  dataParsed_jsonContains?: InputMaybe<Scalars['JSON']['input']>;
  dataParsed_jsonHasKey?: InputMaybe<Scalars['JSON']['input']>;
  dataParsed_not_eq?: InputMaybe<Scalars['JSON']['input']>;
  dataRaw_eq?: InputMaybe<Scalars['JSON']['input']>;
  dataRaw_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  dataRaw_jsonContains?: InputMaybe<Scalars['JSON']['input']>;
  dataRaw_jsonHasKey?: InputMaybe<Scalars['JSON']['input']>;
  dataRaw_not_eq?: InputMaybe<Scalars['JSON']['input']>;
  eventIndex_eq?: InputMaybe<Scalars['Int']['input']>;
  eventIndex_gt?: InputMaybe<Scalars['Int']['input']>;
  eventIndex_gte?: InputMaybe<Scalars['Int']['input']>;
  eventIndex_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  eventIndex_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  eventIndex_lt?: InputMaybe<Scalars['Int']['input']>;
  eventIndex_lte?: InputMaybe<Scalars['Int']['input']>;
  eventIndex_not_eq?: InputMaybe<Scalars['Int']['input']>;
  eventIndex_not_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  extrinsicHash_contains?: InputMaybe<Scalars['String']['input']>;
  extrinsicHash_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  extrinsicHash_endsWith?: InputMaybe<Scalars['String']['input']>;
  extrinsicHash_eq?: InputMaybe<Scalars['String']['input']>;
  extrinsicHash_gt?: InputMaybe<Scalars['String']['input']>;
  extrinsicHash_gte?: InputMaybe<Scalars['String']['input']>;
  extrinsicHash_in?: InputMaybe<Array<Scalars['String']['input']>>;
  extrinsicHash_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  extrinsicHash_lt?: InputMaybe<Scalars['String']['input']>;
  extrinsicHash_lte?: InputMaybe<Scalars['String']['input']>;
  extrinsicHash_not_contains?: InputMaybe<Scalars['String']['input']>;
  extrinsicHash_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  extrinsicHash_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  extrinsicHash_not_eq?: InputMaybe<Scalars['String']['input']>;
  extrinsicHash_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  extrinsicHash_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  extrinsicHash_startsWith?: InputMaybe<Scalars['String']['input']>;
  extrinsicIndex_eq?: InputMaybe<Scalars['Int']['input']>;
  extrinsicIndex_gt?: InputMaybe<Scalars['Int']['input']>;
  extrinsicIndex_gte?: InputMaybe<Scalars['Int']['input']>;
  extrinsicIndex_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  extrinsicIndex_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  extrinsicIndex_lt?: InputMaybe<Scalars['Int']['input']>;
  extrinsicIndex_lte?: InputMaybe<Scalars['Int']['input']>;
  extrinsicIndex_not_eq?: InputMaybe<Scalars['Int']['input']>;
  extrinsicIndex_not_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  finalized_eq?: InputMaybe<Scalars['Boolean']['input']>;
  finalized_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  finalized_not_eq?: InputMaybe<Scalars['Boolean']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  id_endsWith?: InputMaybe<Scalars['String']['input']>;
  id_eq?: InputMaybe<Scalars['String']['input']>;
  id_gt?: InputMaybe<Scalars['String']['input']>;
  id_gte?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<Scalars['String']['input']>>;
  id_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  id_lt?: InputMaybe<Scalars['String']['input']>;
  id_lte?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  id_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  id_not_eq?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  id_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  id_startsWith?: InputMaybe<Scalars['String']['input']>;
  method_contains?: InputMaybe<Scalars['String']['input']>;
  method_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  method_endsWith?: InputMaybe<Scalars['String']['input']>;
  method_eq?: InputMaybe<Scalars['String']['input']>;
  method_gt?: InputMaybe<Scalars['String']['input']>;
  method_gte?: InputMaybe<Scalars['String']['input']>;
  method_in?: InputMaybe<Array<Scalars['String']['input']>>;
  method_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  method_lt?: InputMaybe<Scalars['String']['input']>;
  method_lte?: InputMaybe<Scalars['String']['input']>;
  method_not_contains?: InputMaybe<Scalars['String']['input']>;
  method_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  method_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  method_not_eq?: InputMaybe<Scalars['String']['input']>;
  method_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  method_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  method_startsWith?: InputMaybe<Scalars['String']['input']>;
  status_eq?: InputMaybe<EvmEventStatus>;
  status_in?: InputMaybe<Array<EvmEventStatus>>;
  status_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  status_not_eq?: InputMaybe<EvmEventStatus>;
  status_not_in?: InputMaybe<Array<EvmEventStatus>>;
  timestamp_eq?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_gt?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_gte?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_in?: InputMaybe<Array<Scalars['DateTime']['input']>>;
  timestamp_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  timestamp_lt?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_lte?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_not_eq?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_not_in?: InputMaybe<Array<Scalars['DateTime']['input']>>;
  topic0_contains?: InputMaybe<Scalars['String']['input']>;
  topic0_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  topic0_endsWith?: InputMaybe<Scalars['String']['input']>;
  topic0_eq?: InputMaybe<Scalars['String']['input']>;
  topic0_gt?: InputMaybe<Scalars['String']['input']>;
  topic0_gte?: InputMaybe<Scalars['String']['input']>;
  topic0_in?: InputMaybe<Array<Scalars['String']['input']>>;
  topic0_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  topic0_lt?: InputMaybe<Scalars['String']['input']>;
  topic0_lte?: InputMaybe<Scalars['String']['input']>;
  topic0_not_contains?: InputMaybe<Scalars['String']['input']>;
  topic0_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  topic0_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  topic0_not_eq?: InputMaybe<Scalars['String']['input']>;
  topic0_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  topic0_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  topic0_startsWith?: InputMaybe<Scalars['String']['input']>;
  topic1_contains?: InputMaybe<Scalars['String']['input']>;
  topic1_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  topic1_endsWith?: InputMaybe<Scalars['String']['input']>;
  topic1_eq?: InputMaybe<Scalars['String']['input']>;
  topic1_gt?: InputMaybe<Scalars['String']['input']>;
  topic1_gte?: InputMaybe<Scalars['String']['input']>;
  topic1_in?: InputMaybe<Array<Scalars['String']['input']>>;
  topic1_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  topic1_lt?: InputMaybe<Scalars['String']['input']>;
  topic1_lte?: InputMaybe<Scalars['String']['input']>;
  topic1_not_contains?: InputMaybe<Scalars['String']['input']>;
  topic1_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  topic1_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  topic1_not_eq?: InputMaybe<Scalars['String']['input']>;
  topic1_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  topic1_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  topic1_startsWith?: InputMaybe<Scalars['String']['input']>;
  topic2_contains?: InputMaybe<Scalars['String']['input']>;
  topic2_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  topic2_endsWith?: InputMaybe<Scalars['String']['input']>;
  topic2_eq?: InputMaybe<Scalars['String']['input']>;
  topic2_gt?: InputMaybe<Scalars['String']['input']>;
  topic2_gte?: InputMaybe<Scalars['String']['input']>;
  topic2_in?: InputMaybe<Array<Scalars['String']['input']>>;
  topic2_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  topic2_lt?: InputMaybe<Scalars['String']['input']>;
  topic2_lte?: InputMaybe<Scalars['String']['input']>;
  topic2_not_contains?: InputMaybe<Scalars['String']['input']>;
  topic2_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  topic2_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  topic2_not_eq?: InputMaybe<Scalars['String']['input']>;
  topic2_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  topic2_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  topic2_startsWith?: InputMaybe<Scalars['String']['input']>;
  topic3_contains?: InputMaybe<Scalars['String']['input']>;
  topic3_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  topic3_endsWith?: InputMaybe<Scalars['String']['input']>;
  topic3_eq?: InputMaybe<Scalars['String']['input']>;
  topic3_gt?: InputMaybe<Scalars['String']['input']>;
  topic3_gte?: InputMaybe<Scalars['String']['input']>;
  topic3_in?: InputMaybe<Array<Scalars['String']['input']>>;
  topic3_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  topic3_lt?: InputMaybe<Scalars['String']['input']>;
  topic3_lte?: InputMaybe<Scalars['String']['input']>;
  topic3_not_contains?: InputMaybe<Scalars['String']['input']>;
  topic3_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  topic3_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  topic3_not_eq?: InputMaybe<Scalars['String']['input']>;
  topic3_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  topic3_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  topic3_startsWith?: InputMaybe<Scalars['String']['input']>;
  type_eq?: InputMaybe<EvmEventType>;
  type_in?: InputMaybe<Array<EvmEventType>>;
  type_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  type_not_eq?: InputMaybe<EvmEventType>;
  type_not_in?: InputMaybe<Array<EvmEventType>>;
};

export type EvmEventsConnection = {
  __typename?: 'EvmEventsConnection';
  edges: Array<EvmEventEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type Extrinsic = {
  __typename?: 'Extrinsic';
  args: Scalars['JSON']['output'];
  block: Block;
  contracts: Array<Contract>;
  docs: Scalars['String']['output'];
  errorMessage?: Maybe<Scalars['String']['output']>;
  events: Array<Event>;
  hash: Scalars['String']['output'];
  /** 000000..00<blockNum>-<shorthash>-000<index> */
  id: Scalars['String']['output'];
  index: Scalars['Int']['output'];
  method: Scalars['String']['output'];
  section: Scalars['String']['output'];
  signedData?: Maybe<Scalars['JSON']['output']>;
  signer: Scalars['String']['output'];
  status: ExtrinsicStatus;
  timestamp: Scalars['DateTime']['output'];
  type: ExtrinsicType;
};


export type ExtrinsicContractsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ContractOrderByInput>>;
  where?: InputMaybe<ContractWhereInput>;
};


export type ExtrinsicEventsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<EventOrderByInput>>;
  where?: InputMaybe<EventWhereInput>;
};

export type ExtrinsicEdge = {
  __typename?: 'ExtrinsicEdge';
  cursor: Scalars['String']['output'];
  node: Extrinsic;
};

export type ExtrinsicOrderByInput =
  | 'block_author_ASC'
  | 'block_author_ASC_NULLS_FIRST'
  | 'block_author_DESC'
  | 'block_author_DESC_NULLS_LAST'
  | 'block_extrinsicRoot_ASC'
  | 'block_extrinsicRoot_ASC_NULLS_FIRST'
  | 'block_extrinsicRoot_DESC'
  | 'block_extrinsicRoot_DESC_NULLS_LAST'
  | 'block_finalized_ASC'
  | 'block_finalized_ASC_NULLS_FIRST'
  | 'block_finalized_DESC'
  | 'block_finalized_DESC_NULLS_LAST'
  | 'block_hash_ASC'
  | 'block_hash_ASC_NULLS_FIRST'
  | 'block_hash_DESC'
  | 'block_hash_DESC_NULLS_LAST'
  | 'block_height_ASC'
  | 'block_height_ASC_NULLS_FIRST'
  | 'block_height_DESC'
  | 'block_height_DESC_NULLS_LAST'
  | 'block_id_ASC'
  | 'block_id_ASC_NULLS_FIRST'
  | 'block_id_DESC'
  | 'block_id_DESC_NULLS_LAST'
  | 'block_parentHash_ASC'
  | 'block_parentHash_ASC_NULLS_FIRST'
  | 'block_parentHash_DESC'
  | 'block_parentHash_DESC_NULLS_LAST'
  | 'block_processorTimestamp_ASC'
  | 'block_processorTimestamp_ASC_NULLS_FIRST'
  | 'block_processorTimestamp_DESC'
  | 'block_processorTimestamp_DESC_NULLS_LAST'
  | 'block_stateRoot_ASC'
  | 'block_stateRoot_ASC_NULLS_FIRST'
  | 'block_stateRoot_DESC'
  | 'block_stateRoot_DESC_NULLS_LAST'
  | 'block_timestamp_ASC'
  | 'block_timestamp_ASC_NULLS_FIRST'
  | 'block_timestamp_DESC'
  | 'block_timestamp_DESC_NULLS_LAST'
  | 'docs_ASC'
  | 'docs_ASC_NULLS_FIRST'
  | 'docs_DESC'
  | 'docs_DESC_NULLS_LAST'
  | 'errorMessage_ASC'
  | 'errorMessage_ASC_NULLS_FIRST'
  | 'errorMessage_DESC'
  | 'errorMessage_DESC_NULLS_LAST'
  | 'hash_ASC'
  | 'hash_ASC_NULLS_FIRST'
  | 'hash_DESC'
  | 'hash_DESC_NULLS_LAST'
  | 'id_ASC'
  | 'id_ASC_NULLS_FIRST'
  | 'id_DESC'
  | 'id_DESC_NULLS_LAST'
  | 'index_ASC'
  | 'index_ASC_NULLS_FIRST'
  | 'index_DESC'
  | 'index_DESC_NULLS_LAST'
  | 'method_ASC'
  | 'method_ASC_NULLS_FIRST'
  | 'method_DESC'
  | 'method_DESC_NULLS_LAST'
  | 'section_ASC'
  | 'section_ASC_NULLS_FIRST'
  | 'section_DESC'
  | 'section_DESC_NULLS_LAST'
  | 'signer_ASC'
  | 'signer_ASC_NULLS_FIRST'
  | 'signer_DESC'
  | 'signer_DESC_NULLS_LAST'
  | 'status_ASC'
  | 'status_ASC_NULLS_FIRST'
  | 'status_DESC'
  | 'status_DESC_NULLS_LAST'
  | 'timestamp_ASC'
  | 'timestamp_ASC_NULLS_FIRST'
  | 'timestamp_DESC'
  | 'timestamp_DESC_NULLS_LAST'
  | 'type_ASC'
  | 'type_ASC_NULLS_FIRST'
  | 'type_DESC'
  | 'type_DESC_NULLS_LAST';

export type ExtrinsicStatus =
  | 'error'
  | 'success'
  | 'unknown';

export type ExtrinsicType =
  | 'inherent'
  | 'signed'
  | 'unsigned';

export type ExtrinsicWhereInput = {
  AND?: InputMaybe<Array<ExtrinsicWhereInput>>;
  OR?: InputMaybe<Array<ExtrinsicWhereInput>>;
  args_eq?: InputMaybe<Scalars['JSON']['input']>;
  args_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  args_jsonContains?: InputMaybe<Scalars['JSON']['input']>;
  args_jsonHasKey?: InputMaybe<Scalars['JSON']['input']>;
  args_not_eq?: InputMaybe<Scalars['JSON']['input']>;
  block?: InputMaybe<BlockWhereInput>;
  block_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  contracts_every?: InputMaybe<ContractWhereInput>;
  contracts_none?: InputMaybe<ContractWhereInput>;
  contracts_some?: InputMaybe<ContractWhereInput>;
  docs_contains?: InputMaybe<Scalars['String']['input']>;
  docs_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  docs_endsWith?: InputMaybe<Scalars['String']['input']>;
  docs_eq?: InputMaybe<Scalars['String']['input']>;
  docs_gt?: InputMaybe<Scalars['String']['input']>;
  docs_gte?: InputMaybe<Scalars['String']['input']>;
  docs_in?: InputMaybe<Array<Scalars['String']['input']>>;
  docs_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  docs_lt?: InputMaybe<Scalars['String']['input']>;
  docs_lte?: InputMaybe<Scalars['String']['input']>;
  docs_not_contains?: InputMaybe<Scalars['String']['input']>;
  docs_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  docs_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  docs_not_eq?: InputMaybe<Scalars['String']['input']>;
  docs_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  docs_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  docs_startsWith?: InputMaybe<Scalars['String']['input']>;
  errorMessage_contains?: InputMaybe<Scalars['String']['input']>;
  errorMessage_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  errorMessage_endsWith?: InputMaybe<Scalars['String']['input']>;
  errorMessage_eq?: InputMaybe<Scalars['String']['input']>;
  errorMessage_gt?: InputMaybe<Scalars['String']['input']>;
  errorMessage_gte?: InputMaybe<Scalars['String']['input']>;
  errorMessage_in?: InputMaybe<Array<Scalars['String']['input']>>;
  errorMessage_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  errorMessage_lt?: InputMaybe<Scalars['String']['input']>;
  errorMessage_lte?: InputMaybe<Scalars['String']['input']>;
  errorMessage_not_contains?: InputMaybe<Scalars['String']['input']>;
  errorMessage_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  errorMessage_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  errorMessage_not_eq?: InputMaybe<Scalars['String']['input']>;
  errorMessage_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  errorMessage_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  errorMessage_startsWith?: InputMaybe<Scalars['String']['input']>;
  events_every?: InputMaybe<EventWhereInput>;
  events_none?: InputMaybe<EventWhereInput>;
  events_some?: InputMaybe<EventWhereInput>;
  hash_contains?: InputMaybe<Scalars['String']['input']>;
  hash_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  hash_endsWith?: InputMaybe<Scalars['String']['input']>;
  hash_eq?: InputMaybe<Scalars['String']['input']>;
  hash_gt?: InputMaybe<Scalars['String']['input']>;
  hash_gte?: InputMaybe<Scalars['String']['input']>;
  hash_in?: InputMaybe<Array<Scalars['String']['input']>>;
  hash_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  hash_lt?: InputMaybe<Scalars['String']['input']>;
  hash_lte?: InputMaybe<Scalars['String']['input']>;
  hash_not_contains?: InputMaybe<Scalars['String']['input']>;
  hash_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  hash_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  hash_not_eq?: InputMaybe<Scalars['String']['input']>;
  hash_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  hash_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  hash_startsWith?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  id_endsWith?: InputMaybe<Scalars['String']['input']>;
  id_eq?: InputMaybe<Scalars['String']['input']>;
  id_gt?: InputMaybe<Scalars['String']['input']>;
  id_gte?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<Scalars['String']['input']>>;
  id_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  id_lt?: InputMaybe<Scalars['String']['input']>;
  id_lte?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  id_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  id_not_eq?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  id_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  id_startsWith?: InputMaybe<Scalars['String']['input']>;
  index_eq?: InputMaybe<Scalars['Int']['input']>;
  index_gt?: InputMaybe<Scalars['Int']['input']>;
  index_gte?: InputMaybe<Scalars['Int']['input']>;
  index_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  index_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  index_lt?: InputMaybe<Scalars['Int']['input']>;
  index_lte?: InputMaybe<Scalars['Int']['input']>;
  index_not_eq?: InputMaybe<Scalars['Int']['input']>;
  index_not_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  method_contains?: InputMaybe<Scalars['String']['input']>;
  method_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  method_endsWith?: InputMaybe<Scalars['String']['input']>;
  method_eq?: InputMaybe<Scalars['String']['input']>;
  method_gt?: InputMaybe<Scalars['String']['input']>;
  method_gte?: InputMaybe<Scalars['String']['input']>;
  method_in?: InputMaybe<Array<Scalars['String']['input']>>;
  method_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  method_lt?: InputMaybe<Scalars['String']['input']>;
  method_lte?: InputMaybe<Scalars['String']['input']>;
  method_not_contains?: InputMaybe<Scalars['String']['input']>;
  method_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  method_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  method_not_eq?: InputMaybe<Scalars['String']['input']>;
  method_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  method_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  method_startsWith?: InputMaybe<Scalars['String']['input']>;
  section_contains?: InputMaybe<Scalars['String']['input']>;
  section_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  section_endsWith?: InputMaybe<Scalars['String']['input']>;
  section_eq?: InputMaybe<Scalars['String']['input']>;
  section_gt?: InputMaybe<Scalars['String']['input']>;
  section_gte?: InputMaybe<Scalars['String']['input']>;
  section_in?: InputMaybe<Array<Scalars['String']['input']>>;
  section_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  section_lt?: InputMaybe<Scalars['String']['input']>;
  section_lte?: InputMaybe<Scalars['String']['input']>;
  section_not_contains?: InputMaybe<Scalars['String']['input']>;
  section_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  section_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  section_not_eq?: InputMaybe<Scalars['String']['input']>;
  section_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  section_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  section_startsWith?: InputMaybe<Scalars['String']['input']>;
  signedData_eq?: InputMaybe<Scalars['JSON']['input']>;
  signedData_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  signedData_jsonContains?: InputMaybe<Scalars['JSON']['input']>;
  signedData_jsonHasKey?: InputMaybe<Scalars['JSON']['input']>;
  signedData_not_eq?: InputMaybe<Scalars['JSON']['input']>;
  signer_contains?: InputMaybe<Scalars['String']['input']>;
  signer_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  signer_endsWith?: InputMaybe<Scalars['String']['input']>;
  signer_eq?: InputMaybe<Scalars['String']['input']>;
  signer_gt?: InputMaybe<Scalars['String']['input']>;
  signer_gte?: InputMaybe<Scalars['String']['input']>;
  signer_in?: InputMaybe<Array<Scalars['String']['input']>>;
  signer_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  signer_lt?: InputMaybe<Scalars['String']['input']>;
  signer_lte?: InputMaybe<Scalars['String']['input']>;
  signer_not_contains?: InputMaybe<Scalars['String']['input']>;
  signer_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  signer_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  signer_not_eq?: InputMaybe<Scalars['String']['input']>;
  signer_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  signer_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  signer_startsWith?: InputMaybe<Scalars['String']['input']>;
  status_eq?: InputMaybe<ExtrinsicStatus>;
  status_in?: InputMaybe<Array<ExtrinsicStatus>>;
  status_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  status_not_eq?: InputMaybe<ExtrinsicStatus>;
  status_not_in?: InputMaybe<Array<ExtrinsicStatus>>;
  timestamp_eq?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_gt?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_gte?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_in?: InputMaybe<Array<Scalars['DateTime']['input']>>;
  timestamp_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  timestamp_lt?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_lte?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_not_eq?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_not_in?: InputMaybe<Array<Scalars['DateTime']['input']>>;
  type_eq?: InputMaybe<ExtrinsicType>;
  type_in?: InputMaybe<Array<ExtrinsicType>>;
  type_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  type_not_eq?: InputMaybe<ExtrinsicType>;
  type_not_in?: InputMaybe<Array<ExtrinsicType>>;
};

export type ExtrinsicsConnection = {
  __typename?: 'ExtrinsicsConnection';
  edges: Array<ExtrinsicEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type IndividualExposure = {
  __typename?: 'IndividualExposure';
  value: Scalars['String']['output'];
  who: Scalars['String']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  deleteNewlyVerifiedContractQueue: Scalars['Boolean']['output'];
  newFinalizedBlock: Scalars['Boolean']['output'];
  saveContract: Scalars['Boolean']['output'];
  saveTokenHolders: Scalars['Boolean']['output'];
  saveTransfers: Scalars['Boolean']['output'];
  saveVerificationRequest: Scalars['Boolean']['output'];
  saveVerifiedContract: Scalars['Boolean']['output'];
  updateEvmEventsDataParsed: Scalars['Boolean']['output'];
  updateVerifiedContractApproved: Scalars['Boolean']['output'];
  updateVerifiedContractData: Scalars['Boolean']['output'];
};


export type MutationDeleteNewlyVerifiedContractQueueArgs = {
  id: Scalars['String']['input'];
};


export type MutationNewFinalizedBlockArgs = {
  height: Scalars['Float']['input'];
};


export type MutationSaveContractArgs = {
  bytecode: Scalars['String']['input'];
  bytecodeArguments: Scalars['String']['input'];
  bytecodeContext: Scalars['String']['input'];
  extrinsicId: Scalars['String']['input'];
  gasLimit: Scalars['String']['input'];
  id: Scalars['String']['input'];
  signerAddress: Scalars['String']['input'];
  storageLimit: Scalars['String']['input'];
  timestamp: Scalars['Float']['input'];
};


export type MutationSaveTokenHoldersArgs = {
  tokenHolders: Array<TokenHolderInput>;
};


export type MutationSaveTransfersArgs = {
  transfers: Array<TransferInput>;
};


export type MutationSaveVerificationRequestArgs = {
  args: Scalars['String']['input'];
  compilerVersion: Scalars['String']['input'];
  filename: Scalars['String']['input'];
  id: Scalars['String']['input'];
  license: Scalars['String']['input'];
  message: Scalars['String']['input'];
  name: Scalars['String']['input'];
  optimization: Scalars['Boolean']['input'];
  runs: Scalars['Float']['input'];
  source: Scalars['String']['input'];
  success: Scalars['Boolean']['input'];
  target: Scalars['String']['input'];
  timestamp: Scalars['Float']['input'];
};


export type MutationSaveVerifiedContractArgs = {
  approved: Scalars['Boolean']['input'];
  args: Scalars['String']['input'];
  compiledData: Scalars['String']['input'];
  compilerVersion: Scalars['String']['input'];
  contractData: Scalars['String']['input'];
  filename: Scalars['String']['input'];
  id: Scalars['String']['input'];
  license: Scalars['String']['input'];
  name: Scalars['String']['input'];
  optimization: Scalars['Boolean']['input'];
  runs: Scalars['Float']['input'];
  source: Scalars['String']['input'];
  target: Scalars['String']['input'];
  timestamp: Scalars['Float']['input'];
  type: Scalars['String']['input'];
};


export type MutationUpdateEvmEventsDataParsedArgs = {
  evmEvents: Array<EvmEventDataParsedInput>;
};


export type MutationUpdateVerifiedContractApprovedArgs = {
  approved: Scalars['Boolean']['input'];
  id: Scalars['String']['input'];
};


export type MutationUpdateVerifiedContractDataArgs = {
  contractData: Scalars['String']['input'];
  id: Scalars['String']['input'];
};

export type NewlyVerifiedContractQueue = {
  __typename?: 'NewlyVerifiedContractQueue';
  id: Scalars['String']['output'];
};

export type NewlyVerifiedContractQueueEdge = {
  __typename?: 'NewlyVerifiedContractQueueEdge';
  cursor: Scalars['String']['output'];
  node: NewlyVerifiedContractQueue;
};

export type NewlyVerifiedContractQueueOrderByInput =
  | 'id_ASC'
  | 'id_ASC_NULLS_FIRST'
  | 'id_DESC'
  | 'id_DESC_NULLS_LAST';

export type NewlyVerifiedContractQueueWhereInput = {
  AND?: InputMaybe<Array<NewlyVerifiedContractQueueWhereInput>>;
  OR?: InputMaybe<Array<NewlyVerifiedContractQueueWhereInput>>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  id_endsWith?: InputMaybe<Scalars['String']['input']>;
  id_eq?: InputMaybe<Scalars['String']['input']>;
  id_gt?: InputMaybe<Scalars['String']['input']>;
  id_gte?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<Scalars['String']['input']>>;
  id_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  id_lt?: InputMaybe<Scalars['String']['input']>;
  id_lte?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  id_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  id_not_eq?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  id_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  id_startsWith?: InputMaybe<Scalars['String']['input']>;
};

export type NewlyVerifiedContractQueuesConnection = {
  __typename?: 'NewlyVerifiedContractQueuesConnection';
  edges: Array<NewlyVerifiedContractQueueEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type PageInfo = {
  __typename?: 'PageInfo';
  endCursor: Scalars['String']['output'];
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  startCursor: Scalars['String']['output'];
};

export type Ping = {
  __typename?: 'Ping';
  message: Scalars['String']['output'];
};

export type Query = {
  __typename?: 'Query';
  accountById?: Maybe<Account>;
  /** @deprecated Use accountById */
  accountByUniqueInput?: Maybe<Account>;
  accounts: Array<Account>;
  accountsConnection: AccountsConnection;
  blockById?: Maybe<Block>;
  /** @deprecated Use blockById */
  blockByUniqueInput?: Maybe<Block>;
  blocks: Array<Block>;
  blocksConnection: BlocksConnection;
  chainInfoById?: Maybe<ChainInfo>;
  /** @deprecated Use chainInfoById */
  chainInfoByUniqueInput?: Maybe<ChainInfo>;
  chainInfos: Array<ChainInfo>;
  chainInfosConnection: ChainInfosConnection;
  contractById?: Maybe<Contract>;
  /** @deprecated Use contractById */
  contractByUniqueInput?: Maybe<Contract>;
  contracts: Array<Contract>;
  contractsConnection: ContractsConnection;
  eraValidatorInfoById?: Maybe<EraValidatorInfo>;
  /** @deprecated Use eraValidatorInfoById */
  eraValidatorInfoByUniqueInput?: Maybe<EraValidatorInfo>;
  eraValidatorInfos: Array<EraValidatorInfo>;
  eraValidatorInfosConnection: EraValidatorInfosConnection;
  eventById?: Maybe<Event>;
  /** @deprecated Use eventById */
  eventByUniqueInput?: Maybe<Event>;
  events: Array<Event>;
  eventsConnection: EventsConnection;
  evmEventById?: Maybe<EvmEvent>;
  /** @deprecated Use evmEventById */
  evmEventByUniqueInput?: Maybe<EvmEvent>;
  evmEvents: Array<EvmEvent>;
  evmEventsConnection: EvmEventsConnection;
  extrinsicById?: Maybe<Extrinsic>;
  /** @deprecated Use extrinsicById */
  extrinsicByUniqueInput?: Maybe<Extrinsic>;
  extrinsics: Array<Extrinsic>;
  extrinsicsConnection: ExtrinsicsConnection;
  findBacktrackingEvmEvents: Array<EvmEventEntity>;
  findContract: Array<ContractEntity>;
  newlyVerifiedContractQueueById?: Maybe<NewlyVerifiedContractQueue>;
  /** @deprecated Use newlyVerifiedContractQueueById */
  newlyVerifiedContractQueueByUniqueInput?: Maybe<NewlyVerifiedContractQueue>;
  newlyVerifiedContractQueues: Array<NewlyVerifiedContractQueue>;
  newlyVerifiedContractQueuesConnection: NewlyVerifiedContractQueuesConnection;
  ping: Ping;
  squidStatus?: Maybe<SquidStatus>;
  stakingById?: Maybe<Staking>;
  /** @deprecated Use stakingById */
  stakingByUniqueInput?: Maybe<Staking>;
  stakings: Array<Staking>;
  stakingsConnection: StakingsConnection;
  tokenHolderById?: Maybe<TokenHolder>;
  /** @deprecated Use tokenHolderById */
  tokenHolderByUniqueInput?: Maybe<TokenHolder>;
  tokenHolders: Array<TokenHolder>;
  tokenHoldersConnection: TokenHoldersConnection;
  tokenHoldersCount: TokenHolderCount;
  transferById?: Maybe<Transfer>;
  /** @deprecated Use transferById */
  transferByUniqueInput?: Maybe<Transfer>;
  transfers: Array<Transfer>;
  transfersConnection: TransfersConnection;
  verificationRequestById?: Maybe<VerificationRequest>;
  /** @deprecated Use verificationRequestById */
  verificationRequestByUniqueInput?: Maybe<VerificationRequest>;
  verificationRequests: Array<VerificationRequest>;
  verificationRequestsConnection: VerificationRequestsConnection;
  verifiedContractById?: Maybe<VerifiedContract>;
  /** @deprecated Use verifiedContractById */
  verifiedContractByUniqueInput?: Maybe<VerifiedContract>;
  verifiedContracts: Array<VerifiedContract>;
  verifiedContractsConnection: VerifiedContractsConnection;
};


export type QueryAccountByIdArgs = {
  id: Scalars['String']['input'];
};


export type QueryAccountByUniqueInputArgs = {
  where: WhereIdInput;
};


export type QueryAccountsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AccountOrderByInput>>;
  where?: InputMaybe<AccountWhereInput>;
};


export type QueryAccountsConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy: Array<AccountOrderByInput>;
  where?: InputMaybe<AccountWhereInput>;
};


export type QueryBlockByIdArgs = {
  id: Scalars['String']['input'];
};


export type QueryBlockByUniqueInputArgs = {
  where: WhereIdInput;
};


export type QueryBlocksArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<BlockOrderByInput>>;
  where?: InputMaybe<BlockWhereInput>;
};


export type QueryBlocksConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy: Array<BlockOrderByInput>;
  where?: InputMaybe<BlockWhereInput>;
};


export type QueryChainInfoByIdArgs = {
  id: Scalars['String']['input'];
};


export type QueryChainInfoByUniqueInputArgs = {
  where: WhereIdInput;
};


export type QueryChainInfosArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ChainInfoOrderByInput>>;
  where?: InputMaybe<ChainInfoWhereInput>;
};


export type QueryChainInfosConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy: Array<ChainInfoOrderByInput>;
  where?: InputMaybe<ChainInfoWhereInput>;
};


export type QueryContractByIdArgs = {
  id: Scalars['String']['input'];
};


export type QueryContractByUniqueInputArgs = {
  where: WhereIdInput;
};


export type QueryContractsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ContractOrderByInput>>;
  where?: InputMaybe<ContractWhereInput>;
};


export type QueryContractsConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy: Array<ContractOrderByInput>;
  where?: InputMaybe<ContractWhereInput>;
};


export type QueryEraValidatorInfoByIdArgs = {
  id: Scalars['String']['input'];
};


export type QueryEraValidatorInfoByUniqueInputArgs = {
  where: WhereIdInput;
};


export type QueryEraValidatorInfosArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<EraValidatorInfoOrderByInput>>;
  where?: InputMaybe<EraValidatorInfoWhereInput>;
};


export type QueryEraValidatorInfosConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy: Array<EraValidatorInfoOrderByInput>;
  where?: InputMaybe<EraValidatorInfoWhereInput>;
};


export type QueryEventByIdArgs = {
  id: Scalars['String']['input'];
};


export type QueryEventByUniqueInputArgs = {
  where: WhereIdInput;
};


export type QueryEventsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<EventOrderByInput>>;
  where?: InputMaybe<EventWhereInput>;
};


export type QueryEventsConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy: Array<EventOrderByInput>;
  where?: InputMaybe<EventWhereInput>;
};


export type QueryEvmEventByIdArgs = {
  id: Scalars['String']['input'];
};


export type QueryEvmEventByUniqueInputArgs = {
  where: WhereIdInput;
};


export type QueryEvmEventsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<EvmEventOrderByInput>>;
  where?: InputMaybe<EvmEventWhereInput>;
};


export type QueryEvmEventsConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy: Array<EvmEventOrderByInput>;
  where?: InputMaybe<EvmEventWhereInput>;
};


export type QueryExtrinsicByIdArgs = {
  id: Scalars['String']['input'];
};


export type QueryExtrinsicByUniqueInputArgs = {
  where: WhereIdInput;
};


export type QueryExtrinsicsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ExtrinsicOrderByInput>>;
  where?: InputMaybe<ExtrinsicWhereInput>;
};


export type QueryExtrinsicsConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy: Array<ExtrinsicOrderByInput>;
  where?: InputMaybe<ExtrinsicWhereInput>;
};


export type QueryFindBacktrackingEvmEventsArgs = {
  id: Scalars['String']['input'];
};


export type QueryFindContractArgs = {
  id: Scalars['String']['input'];
};


export type QueryNewlyVerifiedContractQueueByIdArgs = {
  id: Scalars['String']['input'];
};


export type QueryNewlyVerifiedContractQueueByUniqueInputArgs = {
  where: WhereIdInput;
};


export type QueryNewlyVerifiedContractQueuesArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<NewlyVerifiedContractQueueOrderByInput>>;
  where?: InputMaybe<NewlyVerifiedContractQueueWhereInput>;
};


export type QueryNewlyVerifiedContractQueuesConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy: Array<NewlyVerifiedContractQueueOrderByInput>;
  where?: InputMaybe<NewlyVerifiedContractQueueWhereInput>;
};


export type QueryStakingByIdArgs = {
  id: Scalars['String']['input'];
};


export type QueryStakingByUniqueInputArgs = {
  where: WhereIdInput;
};


export type QueryStakingsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<StakingOrderByInput>>;
  where?: InputMaybe<StakingWhereInput>;
};


export type QueryStakingsConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy: Array<StakingOrderByInput>;
  where?: InputMaybe<StakingWhereInput>;
};


export type QueryTokenHolderByIdArgs = {
  id: Scalars['String']['input'];
};


export type QueryTokenHolderByUniqueInputArgs = {
  where: WhereIdInput;
};


export type QueryTokenHoldersArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TokenHolderOrderByInput>>;
  where?: InputMaybe<TokenHolderWhereInput>;
};


export type QueryTokenHoldersConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy: Array<TokenHolderOrderByInput>;
  where?: InputMaybe<TokenHolderWhereInput>;
};


export type QueryTokenHoldersCountArgs = {
  tokenId: Scalars['String']['input'];
};


export type QueryTransferByIdArgs = {
  id: Scalars['String']['input'];
};


export type QueryTransferByUniqueInputArgs = {
  where: WhereIdInput;
};


export type QueryTransfersArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TransferOrderByInput>>;
  where?: InputMaybe<TransferWhereInput>;
};


export type QueryTransfersConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy: Array<TransferOrderByInput>;
  where?: InputMaybe<TransferWhereInput>;
};


export type QueryVerificationRequestByIdArgs = {
  id: Scalars['String']['input'];
};


export type QueryVerificationRequestByUniqueInputArgs = {
  where: WhereIdInput;
};


export type QueryVerificationRequestsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<VerificationRequestOrderByInput>>;
  where?: InputMaybe<VerificationRequestWhereInput>;
};


export type QueryVerificationRequestsConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy: Array<VerificationRequestOrderByInput>;
  where?: InputMaybe<VerificationRequestWhereInput>;
};


export type QueryVerifiedContractByIdArgs = {
  id: Scalars['String']['input'];
};


export type QueryVerifiedContractByUniqueInputArgs = {
  where: WhereIdInput;
};


export type QueryVerifiedContractsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<VerifiedContractOrderByInput>>;
  where?: InputMaybe<VerifiedContractWhereInput>;
};


export type QueryVerifiedContractsConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy: Array<VerifiedContractOrderByInput>;
  where?: InputMaybe<VerifiedContractWhereInput>;
};

export type ReefswapAction =
  | 'AddLiquidity'
  | 'RemoveLiquidity'
  | 'Swap';

export type SquidStatus = {
  __typename?: 'SquidStatus';
  /** The height of the processed part of the chain */
  height?: Maybe<Scalars['Int']['output']>;
};

export type Staking = {
  __typename?: 'Staking';
  amount: Scalars['BigInt']['output'];
  event?: Maybe<Event>;
  id: Scalars['String']['output'];
  signer?: Maybe<Account>;
  timestamp: Scalars['DateTime']['output'];
  type: StakingType;
};

export type StakingEdge = {
  __typename?: 'StakingEdge';
  cursor: Scalars['String']['output'];
  node: Staking;
};

export type StakingOrderByInput =
  | 'amount_ASC'
  | 'amount_ASC_NULLS_FIRST'
  | 'amount_DESC'
  | 'amount_DESC_NULLS_LAST'
  | 'event_id_ASC'
  | 'event_id_ASC_NULLS_FIRST'
  | 'event_id_DESC'
  | 'event_id_DESC_NULLS_LAST'
  | 'event_index_ASC'
  | 'event_index_ASC_NULLS_FIRST'
  | 'event_index_DESC'
  | 'event_index_DESC_NULLS_LAST'
  | 'event_method_ASC'
  | 'event_method_ASC_NULLS_FIRST'
  | 'event_method_DESC'
  | 'event_method_DESC_NULLS_LAST'
  | 'event_phase_ASC'
  | 'event_phase_ASC_NULLS_FIRST'
  | 'event_phase_DESC'
  | 'event_phase_DESC_NULLS_LAST'
  | 'event_section_ASC'
  | 'event_section_ASC_NULLS_FIRST'
  | 'event_section_DESC'
  | 'event_section_DESC_NULLS_LAST'
  | 'event_timestamp_ASC'
  | 'event_timestamp_ASC_NULLS_FIRST'
  | 'event_timestamp_DESC'
  | 'event_timestamp_DESC_NULLS_LAST'
  | 'id_ASC'
  | 'id_ASC_NULLS_FIRST'
  | 'id_DESC'
  | 'id_DESC_NULLS_LAST'
  | 'signer_active_ASC'
  | 'signer_active_ASC_NULLS_FIRST'
  | 'signer_active_DESC'
  | 'signer_active_DESC_NULLS_LAST'
  | 'signer_availableBalance_ASC'
  | 'signer_availableBalance_ASC_NULLS_FIRST'
  | 'signer_availableBalance_DESC'
  | 'signer_availableBalance_DESC_NULLS_LAST'
  | 'signer_evmAddress_ASC'
  | 'signer_evmAddress_ASC_NULLS_FIRST'
  | 'signer_evmAddress_DESC'
  | 'signer_evmAddress_DESC_NULLS_LAST'
  | 'signer_evmNonce_ASC'
  | 'signer_evmNonce_ASC_NULLS_FIRST'
  | 'signer_evmNonce_DESC'
  | 'signer_evmNonce_DESC_NULLS_LAST'
  | 'signer_freeBalance_ASC'
  | 'signer_freeBalance_ASC_NULLS_FIRST'
  | 'signer_freeBalance_DESC'
  | 'signer_freeBalance_DESC_NULLS_LAST'
  | 'signer_id_ASC'
  | 'signer_id_ASC_NULLS_FIRST'
  | 'signer_id_DESC'
  | 'signer_id_DESC_NULLS_LAST'
  | 'signer_lockedBalance_ASC'
  | 'signer_lockedBalance_ASC_NULLS_FIRST'
  | 'signer_lockedBalance_DESC'
  | 'signer_lockedBalance_DESC_NULLS_LAST'
  | 'signer_nonce_ASC'
  | 'signer_nonce_ASC_NULLS_FIRST'
  | 'signer_nonce_DESC'
  | 'signer_nonce_DESC_NULLS_LAST'
  | 'signer_reservedBalance_ASC'
  | 'signer_reservedBalance_ASC_NULLS_FIRST'
  | 'signer_reservedBalance_DESC'
  | 'signer_reservedBalance_DESC_NULLS_LAST'
  | 'signer_timestamp_ASC'
  | 'signer_timestamp_ASC_NULLS_FIRST'
  | 'signer_timestamp_DESC'
  | 'signer_timestamp_DESC_NULLS_LAST'
  | 'signer_vestedBalance_ASC'
  | 'signer_vestedBalance_ASC_NULLS_FIRST'
  | 'signer_vestedBalance_DESC'
  | 'signer_vestedBalance_DESC_NULLS_LAST'
  | 'signer_votingBalance_ASC'
  | 'signer_votingBalance_ASC_NULLS_FIRST'
  | 'signer_votingBalance_DESC'
  | 'signer_votingBalance_DESC_NULLS_LAST'
  | 'timestamp_ASC'
  | 'timestamp_ASC_NULLS_FIRST'
  | 'timestamp_DESC'
  | 'timestamp_DESC_NULLS_LAST'
  | 'type_ASC'
  | 'type_ASC_NULLS_FIRST'
  | 'type_DESC'
  | 'type_DESC_NULLS_LAST';

export type StakingType =
  | 'Reward'
  | 'Slash';

export type StakingWhereInput = {
  AND?: InputMaybe<Array<StakingWhereInput>>;
  OR?: InputMaybe<Array<StakingWhereInput>>;
  amount_eq?: InputMaybe<Scalars['BigInt']['input']>;
  amount_gt?: InputMaybe<Scalars['BigInt']['input']>;
  amount_gte?: InputMaybe<Scalars['BigInt']['input']>;
  amount_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  amount_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  amount_lt?: InputMaybe<Scalars['BigInt']['input']>;
  amount_lte?: InputMaybe<Scalars['BigInt']['input']>;
  amount_not_eq?: InputMaybe<Scalars['BigInt']['input']>;
  amount_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  event?: InputMaybe<EventWhereInput>;
  event_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  id_endsWith?: InputMaybe<Scalars['String']['input']>;
  id_eq?: InputMaybe<Scalars['String']['input']>;
  id_gt?: InputMaybe<Scalars['String']['input']>;
  id_gte?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<Scalars['String']['input']>>;
  id_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  id_lt?: InputMaybe<Scalars['String']['input']>;
  id_lte?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  id_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  id_not_eq?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  id_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  id_startsWith?: InputMaybe<Scalars['String']['input']>;
  signer?: InputMaybe<AccountWhereInput>;
  signer_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  timestamp_eq?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_gt?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_gte?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_in?: InputMaybe<Array<Scalars['DateTime']['input']>>;
  timestamp_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  timestamp_lt?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_lte?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_not_eq?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_not_in?: InputMaybe<Array<Scalars['DateTime']['input']>>;
  type_eq?: InputMaybe<StakingType>;
  type_in?: InputMaybe<Array<StakingType>>;
  type_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  type_not_eq?: InputMaybe<StakingType>;
  type_not_in?: InputMaybe<Array<StakingType>>;
};

export type StakingsConnection = {
  __typename?: 'StakingsConnection';
  edges: Array<StakingEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type Subscription = {
  __typename?: 'Subscription';
  accountById?: Maybe<Account>;
  accounts: Array<Account>;
  blockById?: Maybe<Block>;
  blocks: Array<Block>;
  chainInfoById?: Maybe<ChainInfo>;
  chainInfos: Array<ChainInfo>;
  contractById?: Maybe<Contract>;
  contracts: Array<Contract>;
  eraValidatorInfoById?: Maybe<EraValidatorInfo>;
  eraValidatorInfos: Array<EraValidatorInfo>;
  eventById?: Maybe<Event>;
  events: Array<Event>;
  evmEventById?: Maybe<EvmEvent>;
  evmEvents: Array<EvmEvent>;
  extrinsicById?: Maybe<Extrinsic>;
  extrinsics: Array<Extrinsic>;
  newlyVerifiedContractQueueById?: Maybe<NewlyVerifiedContractQueue>;
  newlyVerifiedContractQueues: Array<NewlyVerifiedContractQueue>;
  stakingById?: Maybe<Staking>;
  stakings: Array<Staking>;
  tokenHolderById?: Maybe<TokenHolder>;
  tokenHolders: Array<TokenHolder>;
  transferById?: Maybe<Transfer>;
  transfers: Array<Transfer>;
  verificationRequestById?: Maybe<VerificationRequest>;
  verificationRequests: Array<VerificationRequest>;
  verifiedContractById?: Maybe<VerifiedContract>;
  verifiedContracts: Array<VerifiedContract>;
};


export type SubscriptionAccountByIdArgs = {
  id: Scalars['String']['input'];
};


export type SubscriptionAccountsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AccountOrderByInput>>;
  where?: InputMaybe<AccountWhereInput>;
};


export type SubscriptionBlockByIdArgs = {
  id: Scalars['String']['input'];
};


export type SubscriptionBlocksArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<BlockOrderByInput>>;
  where?: InputMaybe<BlockWhereInput>;
};


export type SubscriptionChainInfoByIdArgs = {
  id: Scalars['String']['input'];
};


export type SubscriptionChainInfosArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ChainInfoOrderByInput>>;
  where?: InputMaybe<ChainInfoWhereInput>;
};


export type SubscriptionContractByIdArgs = {
  id: Scalars['String']['input'];
};


export type SubscriptionContractsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ContractOrderByInput>>;
  where?: InputMaybe<ContractWhereInput>;
};


export type SubscriptionEraValidatorInfoByIdArgs = {
  id: Scalars['String']['input'];
};


export type SubscriptionEraValidatorInfosArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<EraValidatorInfoOrderByInput>>;
  where?: InputMaybe<EraValidatorInfoWhereInput>;
};


export type SubscriptionEventByIdArgs = {
  id: Scalars['String']['input'];
};


export type SubscriptionEventsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<EventOrderByInput>>;
  where?: InputMaybe<EventWhereInput>;
};


export type SubscriptionEvmEventByIdArgs = {
  id: Scalars['String']['input'];
};


export type SubscriptionEvmEventsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<EvmEventOrderByInput>>;
  where?: InputMaybe<EvmEventWhereInput>;
};


export type SubscriptionExtrinsicByIdArgs = {
  id: Scalars['String']['input'];
};


export type SubscriptionExtrinsicsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ExtrinsicOrderByInput>>;
  where?: InputMaybe<ExtrinsicWhereInput>;
};


export type SubscriptionNewlyVerifiedContractQueueByIdArgs = {
  id: Scalars['String']['input'];
};


export type SubscriptionNewlyVerifiedContractQueuesArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<NewlyVerifiedContractQueueOrderByInput>>;
  where?: InputMaybe<NewlyVerifiedContractQueueWhereInput>;
};


export type SubscriptionStakingByIdArgs = {
  id: Scalars['String']['input'];
};


export type SubscriptionStakingsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<StakingOrderByInput>>;
  where?: InputMaybe<StakingWhereInput>;
};


export type SubscriptionTokenHolderByIdArgs = {
  id: Scalars['String']['input'];
};


export type SubscriptionTokenHoldersArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TokenHolderOrderByInput>>;
  where?: InputMaybe<TokenHolderWhereInput>;
};


export type SubscriptionTransferByIdArgs = {
  id: Scalars['String']['input'];
};


export type SubscriptionTransfersArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TransferOrderByInput>>;
  where?: InputMaybe<TransferWhereInput>;
};


export type SubscriptionVerificationRequestByIdArgs = {
  id: Scalars['String']['input'];
};


export type SubscriptionVerificationRequestsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<VerificationRequestOrderByInput>>;
  where?: InputMaybe<VerificationRequestWhereInput>;
};


export type SubscriptionVerifiedContractByIdArgs = {
  id: Scalars['String']['input'];
};


export type SubscriptionVerifiedContractsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<VerifiedContractOrderByInput>>;
  where?: InputMaybe<VerifiedContractWhereInput>;
};

export type TokenHolder = {
  __typename?: 'TokenHolder';
  balance: Scalars['BigInt']['output'];
  evmAddress?: Maybe<Scalars['String']['output']>;
  /** <tokenAddress>-<signerAddress>-<nftId> */
  id: Scalars['String']['output'];
  nftId?: Maybe<Scalars['BigInt']['output']>;
  signer?: Maybe<Account>;
  timestamp: Scalars['DateTime']['output'];
  token: VerifiedContract;
  type: TokenHolderType;
};

export type TokenHolderCount = {
  __typename?: 'TokenHolderCount';
  count: Scalars['Int']['output'];
};

export type TokenHolderEdge = {
  __typename?: 'TokenHolderEdge';
  cursor: Scalars['String']['output'];
  node: TokenHolder;
};

export type TokenHolderInput = {
  balance: Scalars['BigInt']['input'];
  evmAddress?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['String']['input'];
  nftId?: InputMaybe<Scalars['BigInt']['input']>;
  signerId?: InputMaybe<Scalars['String']['input']>;
  timestamp: Scalars['BigInt']['input'];
  tokenId: Scalars['String']['input'];
  type: Scalars['String']['input'];
};

export type TokenHolderOrderByInput =
  | 'balance_ASC'
  | 'balance_ASC_NULLS_FIRST'
  | 'balance_DESC'
  | 'balance_DESC_NULLS_LAST'
  | 'evmAddress_ASC'
  | 'evmAddress_ASC_NULLS_FIRST'
  | 'evmAddress_DESC'
  | 'evmAddress_DESC_NULLS_LAST'
  | 'id_ASC'
  | 'id_ASC_NULLS_FIRST'
  | 'id_DESC'
  | 'id_DESC_NULLS_LAST'
  | 'nftId_ASC'
  | 'nftId_ASC_NULLS_FIRST'
  | 'nftId_DESC'
  | 'nftId_DESC_NULLS_LAST'
  | 'signer_active_ASC'
  | 'signer_active_ASC_NULLS_FIRST'
  | 'signer_active_DESC'
  | 'signer_active_DESC_NULLS_LAST'
  | 'signer_availableBalance_ASC'
  | 'signer_availableBalance_ASC_NULLS_FIRST'
  | 'signer_availableBalance_DESC'
  | 'signer_availableBalance_DESC_NULLS_LAST'
  | 'signer_evmAddress_ASC'
  | 'signer_evmAddress_ASC_NULLS_FIRST'
  | 'signer_evmAddress_DESC'
  | 'signer_evmAddress_DESC_NULLS_LAST'
  | 'signer_evmNonce_ASC'
  | 'signer_evmNonce_ASC_NULLS_FIRST'
  | 'signer_evmNonce_DESC'
  | 'signer_evmNonce_DESC_NULLS_LAST'
  | 'signer_freeBalance_ASC'
  | 'signer_freeBalance_ASC_NULLS_FIRST'
  | 'signer_freeBalance_DESC'
  | 'signer_freeBalance_DESC_NULLS_LAST'
  | 'signer_id_ASC'
  | 'signer_id_ASC_NULLS_FIRST'
  | 'signer_id_DESC'
  | 'signer_id_DESC_NULLS_LAST'
  | 'signer_lockedBalance_ASC'
  | 'signer_lockedBalance_ASC_NULLS_FIRST'
  | 'signer_lockedBalance_DESC'
  | 'signer_lockedBalance_DESC_NULLS_LAST'
  | 'signer_nonce_ASC'
  | 'signer_nonce_ASC_NULLS_FIRST'
  | 'signer_nonce_DESC'
  | 'signer_nonce_DESC_NULLS_LAST'
  | 'signer_reservedBalance_ASC'
  | 'signer_reservedBalance_ASC_NULLS_FIRST'
  | 'signer_reservedBalance_DESC'
  | 'signer_reservedBalance_DESC_NULLS_LAST'
  | 'signer_timestamp_ASC'
  | 'signer_timestamp_ASC_NULLS_FIRST'
  | 'signer_timestamp_DESC'
  | 'signer_timestamp_DESC_NULLS_LAST'
  | 'signer_vestedBalance_ASC'
  | 'signer_vestedBalance_ASC_NULLS_FIRST'
  | 'signer_vestedBalance_DESC'
  | 'signer_vestedBalance_DESC_NULLS_LAST'
  | 'signer_votingBalance_ASC'
  | 'signer_votingBalance_ASC_NULLS_FIRST'
  | 'signer_votingBalance_DESC'
  | 'signer_votingBalance_DESC_NULLS_LAST'
  | 'timestamp_ASC'
  | 'timestamp_ASC_NULLS_FIRST'
  | 'timestamp_DESC'
  | 'timestamp_DESC_NULLS_LAST'
  | 'token_approved_ASC'
  | 'token_approved_ASC_NULLS_FIRST'
  | 'token_approved_DESC'
  | 'token_approved_DESC_NULLS_LAST'
  | 'token_compilerVersion_ASC'
  | 'token_compilerVersion_ASC_NULLS_FIRST'
  | 'token_compilerVersion_DESC'
  | 'token_compilerVersion_DESC_NULLS_LAST'
  | 'token_filename_ASC'
  | 'token_filename_ASC_NULLS_FIRST'
  | 'token_filename_DESC'
  | 'token_filename_DESC_NULLS_LAST'
  | 'token_id_ASC'
  | 'token_id_ASC_NULLS_FIRST'
  | 'token_id_DESC'
  | 'token_id_DESC_NULLS_LAST'
  | 'token_license_ASC'
  | 'token_license_ASC_NULLS_FIRST'
  | 'token_license_DESC'
  | 'token_license_DESC_NULLS_LAST'
  | 'token_name_ASC'
  | 'token_name_ASC_NULLS_FIRST'
  | 'token_name_DESC'
  | 'token_name_DESC_NULLS_LAST'
  | 'token_optimization_ASC'
  | 'token_optimization_ASC_NULLS_FIRST'
  | 'token_optimization_DESC'
  | 'token_optimization_DESC_NULLS_LAST'
  | 'token_runs_ASC'
  | 'token_runs_ASC_NULLS_FIRST'
  | 'token_runs_DESC'
  | 'token_runs_DESC_NULLS_LAST'
  | 'token_target_ASC'
  | 'token_target_ASC_NULLS_FIRST'
  | 'token_target_DESC'
  | 'token_target_DESC_NULLS_LAST'
  | 'token_timestamp_ASC'
  | 'token_timestamp_ASC_NULLS_FIRST'
  | 'token_timestamp_DESC'
  | 'token_timestamp_DESC_NULLS_LAST'
  | 'token_type_ASC'
  | 'token_type_ASC_NULLS_FIRST'
  | 'token_type_DESC'
  | 'token_type_DESC_NULLS_LAST'
  | 'type_ASC'
  | 'type_ASC_NULLS_FIRST'
  | 'type_DESC'
  | 'type_DESC_NULLS_LAST';

export type TokenHolderType =
  | 'Account'
  | 'Contract';

export type TokenHolderWhereInput = {
  AND?: InputMaybe<Array<TokenHolderWhereInput>>;
  OR?: InputMaybe<Array<TokenHolderWhereInput>>;
  balance_eq?: InputMaybe<Scalars['BigInt']['input']>;
  balance_gt?: InputMaybe<Scalars['BigInt']['input']>;
  balance_gte?: InputMaybe<Scalars['BigInt']['input']>;
  balance_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  balance_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  balance_lt?: InputMaybe<Scalars['BigInt']['input']>;
  balance_lte?: InputMaybe<Scalars['BigInt']['input']>;
  balance_not_eq?: InputMaybe<Scalars['BigInt']['input']>;
  balance_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  evmAddress_contains?: InputMaybe<Scalars['String']['input']>;
  evmAddress_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  evmAddress_endsWith?: InputMaybe<Scalars['String']['input']>;
  evmAddress_eq?: InputMaybe<Scalars['String']['input']>;
  evmAddress_gt?: InputMaybe<Scalars['String']['input']>;
  evmAddress_gte?: InputMaybe<Scalars['String']['input']>;
  evmAddress_in?: InputMaybe<Array<Scalars['String']['input']>>;
  evmAddress_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  evmAddress_lt?: InputMaybe<Scalars['String']['input']>;
  evmAddress_lte?: InputMaybe<Scalars['String']['input']>;
  evmAddress_not_contains?: InputMaybe<Scalars['String']['input']>;
  evmAddress_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  evmAddress_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  evmAddress_not_eq?: InputMaybe<Scalars['String']['input']>;
  evmAddress_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  evmAddress_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  evmAddress_startsWith?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  id_endsWith?: InputMaybe<Scalars['String']['input']>;
  id_eq?: InputMaybe<Scalars['String']['input']>;
  id_gt?: InputMaybe<Scalars['String']['input']>;
  id_gte?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<Scalars['String']['input']>>;
  id_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  id_lt?: InputMaybe<Scalars['String']['input']>;
  id_lte?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  id_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  id_not_eq?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  id_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  id_startsWith?: InputMaybe<Scalars['String']['input']>;
  nftId_eq?: InputMaybe<Scalars['BigInt']['input']>;
  nftId_gt?: InputMaybe<Scalars['BigInt']['input']>;
  nftId_gte?: InputMaybe<Scalars['BigInt']['input']>;
  nftId_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  nftId_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  nftId_lt?: InputMaybe<Scalars['BigInt']['input']>;
  nftId_lte?: InputMaybe<Scalars['BigInt']['input']>;
  nftId_not_eq?: InputMaybe<Scalars['BigInt']['input']>;
  nftId_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  signer?: InputMaybe<AccountWhereInput>;
  signer_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  timestamp_eq?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_gt?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_gte?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_in?: InputMaybe<Array<Scalars['DateTime']['input']>>;
  timestamp_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  timestamp_lt?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_lte?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_not_eq?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_not_in?: InputMaybe<Array<Scalars['DateTime']['input']>>;
  token?: InputMaybe<VerifiedContractWhereInput>;
  token_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  type_eq?: InputMaybe<TokenHolderType>;
  type_in?: InputMaybe<Array<TokenHolderType>>;
  type_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  type_not_eq?: InputMaybe<TokenHolderType>;
  type_not_in?: InputMaybe<Array<TokenHolderType>>;
};

export type TokenHoldersConnection = {
  __typename?: 'TokenHoldersConnection';
  edges: Array<TokenHolderEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type Transfer = {
  __typename?: 'Transfer';
  amount: Scalars['BigInt']['output'];
  blockHash: Scalars['String']['output'];
  blockHeight: Scalars['Int']['output'];
  denom?: Maybe<Scalars['String']['output']>;
  errorMessage?: Maybe<Scalars['String']['output']>;
  eventIndex: Scalars['Int']['output'];
  extrinsicHash?: Maybe<Scalars['String']['output']>;
  extrinsicId?: Maybe<Scalars['String']['output']>;
  extrinsicIndex: Scalars['Int']['output'];
  finalized: Scalars['Boolean']['output'];
  from: Account;
  fromEvmAddress?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  nftId?: Maybe<Scalars['BigInt']['output']>;
  reefswapAction?: Maybe<ReefswapAction>;
  signedData?: Maybe<Scalars['JSON']['output']>;
  success: Scalars['Boolean']['output'];
  timestamp: Scalars['DateTime']['output'];
  to: Account;
  toEvmAddress?: Maybe<Scalars['String']['output']>;
  token: VerifiedContract;
  type: TransferType;
};

export type TransferEdge = {
  __typename?: 'TransferEdge';
  cursor: Scalars['String']['output'];
  node: Transfer;
};

export type TransferInput = {
  amount: Scalars['BigInt']['input'];
  blockHash?: InputMaybe<Scalars['String']['input']>;
  blockHeight?: InputMaybe<Scalars['Int']['input']>;
  denom?: InputMaybe<Scalars['String']['input']>;
  errorMessage?: InputMaybe<Scalars['String']['input']>;
  extrinsicHash?: InputMaybe<Scalars['String']['input']>;
  extrinsicId?: InputMaybe<Scalars['String']['input']>;
  extrinsicIndex?: InputMaybe<Scalars['Int']['input']>;
  finalized: Scalars['Boolean']['input'];
  fromEvmAddress?: InputMaybe<Scalars['String']['input']>;
  fromId?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['String']['input'];
  nftId?: InputMaybe<Scalars['BigInt']['input']>;
  signedData?: InputMaybe<Scalars['String']['input']>;
  success: Scalars['Boolean']['input'];
  timestamp: Scalars['BigInt']['input'];
  toEvmAddress?: InputMaybe<Scalars['String']['input']>;
  toId?: InputMaybe<Scalars['String']['input']>;
  tokenId?: InputMaybe<Scalars['String']['input']>;
  type: Scalars['String']['input'];
};

export type TransferOrderByInput =
  | 'amount_ASC'
  | 'amount_ASC_NULLS_FIRST'
  | 'amount_DESC'
  | 'amount_DESC_NULLS_LAST'
  | 'blockHash_ASC'
  | 'blockHash_ASC_NULLS_FIRST'
  | 'blockHash_DESC'
  | 'blockHash_DESC_NULLS_LAST'
  | 'blockHeight_ASC'
  | 'blockHeight_ASC_NULLS_FIRST'
  | 'blockHeight_DESC'
  | 'blockHeight_DESC_NULLS_LAST'
  | 'denom_ASC'
  | 'denom_ASC_NULLS_FIRST'
  | 'denom_DESC'
  | 'denom_DESC_NULLS_LAST'
  | 'errorMessage_ASC'
  | 'errorMessage_ASC_NULLS_FIRST'
  | 'errorMessage_DESC'
  | 'errorMessage_DESC_NULLS_LAST'
  | 'eventIndex_ASC'
  | 'eventIndex_ASC_NULLS_FIRST'
  | 'eventIndex_DESC'
  | 'eventIndex_DESC_NULLS_LAST'
  | 'extrinsicHash_ASC'
  | 'extrinsicHash_ASC_NULLS_FIRST'
  | 'extrinsicHash_DESC'
  | 'extrinsicHash_DESC_NULLS_LAST'
  | 'extrinsicId_ASC'
  | 'extrinsicId_ASC_NULLS_FIRST'
  | 'extrinsicId_DESC'
  | 'extrinsicId_DESC_NULLS_LAST'
  | 'extrinsicIndex_ASC'
  | 'extrinsicIndex_ASC_NULLS_FIRST'
  | 'extrinsicIndex_DESC'
  | 'extrinsicIndex_DESC_NULLS_LAST'
  | 'finalized_ASC'
  | 'finalized_ASC_NULLS_FIRST'
  | 'finalized_DESC'
  | 'finalized_DESC_NULLS_LAST'
  | 'fromEvmAddress_ASC'
  | 'fromEvmAddress_ASC_NULLS_FIRST'
  | 'fromEvmAddress_DESC'
  | 'fromEvmAddress_DESC_NULLS_LAST'
  | 'from_active_ASC'
  | 'from_active_ASC_NULLS_FIRST'
  | 'from_active_DESC'
  | 'from_active_DESC_NULLS_LAST'
  | 'from_availableBalance_ASC'
  | 'from_availableBalance_ASC_NULLS_FIRST'
  | 'from_availableBalance_DESC'
  | 'from_availableBalance_DESC_NULLS_LAST'
  | 'from_evmAddress_ASC'
  | 'from_evmAddress_ASC_NULLS_FIRST'
  | 'from_evmAddress_DESC'
  | 'from_evmAddress_DESC_NULLS_LAST'
  | 'from_evmNonce_ASC'
  | 'from_evmNonce_ASC_NULLS_FIRST'
  | 'from_evmNonce_DESC'
  | 'from_evmNonce_DESC_NULLS_LAST'
  | 'from_freeBalance_ASC'
  | 'from_freeBalance_ASC_NULLS_FIRST'
  | 'from_freeBalance_DESC'
  | 'from_freeBalance_DESC_NULLS_LAST'
  | 'from_id_ASC'
  | 'from_id_ASC_NULLS_FIRST'
  | 'from_id_DESC'
  | 'from_id_DESC_NULLS_LAST'
  | 'from_lockedBalance_ASC'
  | 'from_lockedBalance_ASC_NULLS_FIRST'
  | 'from_lockedBalance_DESC'
  | 'from_lockedBalance_DESC_NULLS_LAST'
  | 'from_nonce_ASC'
  | 'from_nonce_ASC_NULLS_FIRST'
  | 'from_nonce_DESC'
  | 'from_nonce_DESC_NULLS_LAST'
  | 'from_reservedBalance_ASC'
  | 'from_reservedBalance_ASC_NULLS_FIRST'
  | 'from_reservedBalance_DESC'
  | 'from_reservedBalance_DESC_NULLS_LAST'
  | 'from_timestamp_ASC'
  | 'from_timestamp_ASC_NULLS_FIRST'
  | 'from_timestamp_DESC'
  | 'from_timestamp_DESC_NULLS_LAST'
  | 'from_vestedBalance_ASC'
  | 'from_vestedBalance_ASC_NULLS_FIRST'
  | 'from_vestedBalance_DESC'
  | 'from_vestedBalance_DESC_NULLS_LAST'
  | 'from_votingBalance_ASC'
  | 'from_votingBalance_ASC_NULLS_FIRST'
  | 'from_votingBalance_DESC'
  | 'from_votingBalance_DESC_NULLS_LAST'
  | 'id_ASC'
  | 'id_ASC_NULLS_FIRST'
  | 'id_DESC'
  | 'id_DESC_NULLS_LAST'
  | 'nftId_ASC'
  | 'nftId_ASC_NULLS_FIRST'
  | 'nftId_DESC'
  | 'nftId_DESC_NULLS_LAST'
  | 'reefswapAction_ASC'
  | 'reefswapAction_ASC_NULLS_FIRST'
  | 'reefswapAction_DESC'
  | 'reefswapAction_DESC_NULLS_LAST'
  | 'success_ASC'
  | 'success_ASC_NULLS_FIRST'
  | 'success_DESC'
  | 'success_DESC_NULLS_LAST'
  | 'timestamp_ASC'
  | 'timestamp_ASC_NULLS_FIRST'
  | 'timestamp_DESC'
  | 'timestamp_DESC_NULLS_LAST'
  | 'toEvmAddress_ASC'
  | 'toEvmAddress_ASC_NULLS_FIRST'
  | 'toEvmAddress_DESC'
  | 'toEvmAddress_DESC_NULLS_LAST'
  | 'to_active_ASC'
  | 'to_active_ASC_NULLS_FIRST'
  | 'to_active_DESC'
  | 'to_active_DESC_NULLS_LAST'
  | 'to_availableBalance_ASC'
  | 'to_availableBalance_ASC_NULLS_FIRST'
  | 'to_availableBalance_DESC'
  | 'to_availableBalance_DESC_NULLS_LAST'
  | 'to_evmAddress_ASC'
  | 'to_evmAddress_ASC_NULLS_FIRST'
  | 'to_evmAddress_DESC'
  | 'to_evmAddress_DESC_NULLS_LAST'
  | 'to_evmNonce_ASC'
  | 'to_evmNonce_ASC_NULLS_FIRST'
  | 'to_evmNonce_DESC'
  | 'to_evmNonce_DESC_NULLS_LAST'
  | 'to_freeBalance_ASC'
  | 'to_freeBalance_ASC_NULLS_FIRST'
  | 'to_freeBalance_DESC'
  | 'to_freeBalance_DESC_NULLS_LAST'
  | 'to_id_ASC'
  | 'to_id_ASC_NULLS_FIRST'
  | 'to_id_DESC'
  | 'to_id_DESC_NULLS_LAST'
  | 'to_lockedBalance_ASC'
  | 'to_lockedBalance_ASC_NULLS_FIRST'
  | 'to_lockedBalance_DESC'
  | 'to_lockedBalance_DESC_NULLS_LAST'
  | 'to_nonce_ASC'
  | 'to_nonce_ASC_NULLS_FIRST'
  | 'to_nonce_DESC'
  | 'to_nonce_DESC_NULLS_LAST'
  | 'to_reservedBalance_ASC'
  | 'to_reservedBalance_ASC_NULLS_FIRST'
  | 'to_reservedBalance_DESC'
  | 'to_reservedBalance_DESC_NULLS_LAST'
  | 'to_timestamp_ASC'
  | 'to_timestamp_ASC_NULLS_FIRST'
  | 'to_timestamp_DESC'
  | 'to_timestamp_DESC_NULLS_LAST'
  | 'to_vestedBalance_ASC'
  | 'to_vestedBalance_ASC_NULLS_FIRST'
  | 'to_vestedBalance_DESC'
  | 'to_vestedBalance_DESC_NULLS_LAST'
  | 'to_votingBalance_ASC'
  | 'to_votingBalance_ASC_NULLS_FIRST'
  | 'to_votingBalance_DESC'
  | 'to_votingBalance_DESC_NULLS_LAST'
  | 'token_approved_ASC'
  | 'token_approved_ASC_NULLS_FIRST'
  | 'token_approved_DESC'
  | 'token_approved_DESC_NULLS_LAST'
  | 'token_compilerVersion_ASC'
  | 'token_compilerVersion_ASC_NULLS_FIRST'
  | 'token_compilerVersion_DESC'
  | 'token_compilerVersion_DESC_NULLS_LAST'
  | 'token_filename_ASC'
  | 'token_filename_ASC_NULLS_FIRST'
  | 'token_filename_DESC'
  | 'token_filename_DESC_NULLS_LAST'
  | 'token_id_ASC'
  | 'token_id_ASC_NULLS_FIRST'
  | 'token_id_DESC'
  | 'token_id_DESC_NULLS_LAST'
  | 'token_license_ASC'
  | 'token_license_ASC_NULLS_FIRST'
  | 'token_license_DESC'
  | 'token_license_DESC_NULLS_LAST'
  | 'token_name_ASC'
  | 'token_name_ASC_NULLS_FIRST'
  | 'token_name_DESC'
  | 'token_name_DESC_NULLS_LAST'
  | 'token_optimization_ASC'
  | 'token_optimization_ASC_NULLS_FIRST'
  | 'token_optimization_DESC'
  | 'token_optimization_DESC_NULLS_LAST'
  | 'token_runs_ASC'
  | 'token_runs_ASC_NULLS_FIRST'
  | 'token_runs_DESC'
  | 'token_runs_DESC_NULLS_LAST'
  | 'token_target_ASC'
  | 'token_target_ASC_NULLS_FIRST'
  | 'token_target_DESC'
  | 'token_target_DESC_NULLS_LAST'
  | 'token_timestamp_ASC'
  | 'token_timestamp_ASC_NULLS_FIRST'
  | 'token_timestamp_DESC'
  | 'token_timestamp_DESC_NULLS_LAST'
  | 'token_type_ASC'
  | 'token_type_ASC_NULLS_FIRST'
  | 'token_type_DESC'
  | 'token_type_DESC_NULLS_LAST'
  | 'type_ASC'
  | 'type_ASC_NULLS_FIRST'
  | 'type_DESC'
  | 'type_DESC_NULLS_LAST';

export type TransferType =
  | 'ERC20'
  | 'ERC721'
  | 'ERC1155'
  | 'Native';

export type TransferWhereInput = {
  AND?: InputMaybe<Array<TransferWhereInput>>;
  OR?: InputMaybe<Array<TransferWhereInput>>;
  amount_eq?: InputMaybe<Scalars['BigInt']['input']>;
  amount_gt?: InputMaybe<Scalars['BigInt']['input']>;
  amount_gte?: InputMaybe<Scalars['BigInt']['input']>;
  amount_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  amount_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  amount_lt?: InputMaybe<Scalars['BigInt']['input']>;
  amount_lte?: InputMaybe<Scalars['BigInt']['input']>;
  amount_not_eq?: InputMaybe<Scalars['BigInt']['input']>;
  amount_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  blockHash_contains?: InputMaybe<Scalars['String']['input']>;
  blockHash_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  blockHash_endsWith?: InputMaybe<Scalars['String']['input']>;
  blockHash_eq?: InputMaybe<Scalars['String']['input']>;
  blockHash_gt?: InputMaybe<Scalars['String']['input']>;
  blockHash_gte?: InputMaybe<Scalars['String']['input']>;
  blockHash_in?: InputMaybe<Array<Scalars['String']['input']>>;
  blockHash_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  blockHash_lt?: InputMaybe<Scalars['String']['input']>;
  blockHash_lte?: InputMaybe<Scalars['String']['input']>;
  blockHash_not_contains?: InputMaybe<Scalars['String']['input']>;
  blockHash_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  blockHash_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  blockHash_not_eq?: InputMaybe<Scalars['String']['input']>;
  blockHash_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  blockHash_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  blockHash_startsWith?: InputMaybe<Scalars['String']['input']>;
  blockHeight_eq?: InputMaybe<Scalars['Int']['input']>;
  blockHeight_gt?: InputMaybe<Scalars['Int']['input']>;
  blockHeight_gte?: InputMaybe<Scalars['Int']['input']>;
  blockHeight_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  blockHeight_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  blockHeight_lt?: InputMaybe<Scalars['Int']['input']>;
  blockHeight_lte?: InputMaybe<Scalars['Int']['input']>;
  blockHeight_not_eq?: InputMaybe<Scalars['Int']['input']>;
  blockHeight_not_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  denom_contains?: InputMaybe<Scalars['String']['input']>;
  denom_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  denom_endsWith?: InputMaybe<Scalars['String']['input']>;
  denom_eq?: InputMaybe<Scalars['String']['input']>;
  denom_gt?: InputMaybe<Scalars['String']['input']>;
  denom_gte?: InputMaybe<Scalars['String']['input']>;
  denom_in?: InputMaybe<Array<Scalars['String']['input']>>;
  denom_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  denom_lt?: InputMaybe<Scalars['String']['input']>;
  denom_lte?: InputMaybe<Scalars['String']['input']>;
  denom_not_contains?: InputMaybe<Scalars['String']['input']>;
  denom_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  denom_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  denom_not_eq?: InputMaybe<Scalars['String']['input']>;
  denom_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  denom_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  denom_startsWith?: InputMaybe<Scalars['String']['input']>;
  errorMessage_contains?: InputMaybe<Scalars['String']['input']>;
  errorMessage_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  errorMessage_endsWith?: InputMaybe<Scalars['String']['input']>;
  errorMessage_eq?: InputMaybe<Scalars['String']['input']>;
  errorMessage_gt?: InputMaybe<Scalars['String']['input']>;
  errorMessage_gte?: InputMaybe<Scalars['String']['input']>;
  errorMessage_in?: InputMaybe<Array<Scalars['String']['input']>>;
  errorMessage_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  errorMessage_lt?: InputMaybe<Scalars['String']['input']>;
  errorMessage_lte?: InputMaybe<Scalars['String']['input']>;
  errorMessage_not_contains?: InputMaybe<Scalars['String']['input']>;
  errorMessage_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  errorMessage_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  errorMessage_not_eq?: InputMaybe<Scalars['String']['input']>;
  errorMessage_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  errorMessage_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  errorMessage_startsWith?: InputMaybe<Scalars['String']['input']>;
  eventIndex_eq?: InputMaybe<Scalars['Int']['input']>;
  eventIndex_gt?: InputMaybe<Scalars['Int']['input']>;
  eventIndex_gte?: InputMaybe<Scalars['Int']['input']>;
  eventIndex_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  eventIndex_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  eventIndex_lt?: InputMaybe<Scalars['Int']['input']>;
  eventIndex_lte?: InputMaybe<Scalars['Int']['input']>;
  eventIndex_not_eq?: InputMaybe<Scalars['Int']['input']>;
  eventIndex_not_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  extrinsicHash_contains?: InputMaybe<Scalars['String']['input']>;
  extrinsicHash_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  extrinsicHash_endsWith?: InputMaybe<Scalars['String']['input']>;
  extrinsicHash_eq?: InputMaybe<Scalars['String']['input']>;
  extrinsicHash_gt?: InputMaybe<Scalars['String']['input']>;
  extrinsicHash_gte?: InputMaybe<Scalars['String']['input']>;
  extrinsicHash_in?: InputMaybe<Array<Scalars['String']['input']>>;
  extrinsicHash_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  extrinsicHash_lt?: InputMaybe<Scalars['String']['input']>;
  extrinsicHash_lte?: InputMaybe<Scalars['String']['input']>;
  extrinsicHash_not_contains?: InputMaybe<Scalars['String']['input']>;
  extrinsicHash_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  extrinsicHash_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  extrinsicHash_not_eq?: InputMaybe<Scalars['String']['input']>;
  extrinsicHash_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  extrinsicHash_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  extrinsicHash_startsWith?: InputMaybe<Scalars['String']['input']>;
  extrinsicId_contains?: InputMaybe<Scalars['String']['input']>;
  extrinsicId_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  extrinsicId_endsWith?: InputMaybe<Scalars['String']['input']>;
  extrinsicId_eq?: InputMaybe<Scalars['String']['input']>;
  extrinsicId_gt?: InputMaybe<Scalars['String']['input']>;
  extrinsicId_gte?: InputMaybe<Scalars['String']['input']>;
  extrinsicId_in?: InputMaybe<Array<Scalars['String']['input']>>;
  extrinsicId_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  extrinsicId_lt?: InputMaybe<Scalars['String']['input']>;
  extrinsicId_lte?: InputMaybe<Scalars['String']['input']>;
  extrinsicId_not_contains?: InputMaybe<Scalars['String']['input']>;
  extrinsicId_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  extrinsicId_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  extrinsicId_not_eq?: InputMaybe<Scalars['String']['input']>;
  extrinsicId_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  extrinsicId_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  extrinsicId_startsWith?: InputMaybe<Scalars['String']['input']>;
  extrinsicIndex_eq?: InputMaybe<Scalars['Int']['input']>;
  extrinsicIndex_gt?: InputMaybe<Scalars['Int']['input']>;
  extrinsicIndex_gte?: InputMaybe<Scalars['Int']['input']>;
  extrinsicIndex_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  extrinsicIndex_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  extrinsicIndex_lt?: InputMaybe<Scalars['Int']['input']>;
  extrinsicIndex_lte?: InputMaybe<Scalars['Int']['input']>;
  extrinsicIndex_not_eq?: InputMaybe<Scalars['Int']['input']>;
  extrinsicIndex_not_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  finalized_eq?: InputMaybe<Scalars['Boolean']['input']>;
  finalized_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  finalized_not_eq?: InputMaybe<Scalars['Boolean']['input']>;
  from?: InputMaybe<AccountWhereInput>;
  fromEvmAddress_contains?: InputMaybe<Scalars['String']['input']>;
  fromEvmAddress_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  fromEvmAddress_endsWith?: InputMaybe<Scalars['String']['input']>;
  fromEvmAddress_eq?: InputMaybe<Scalars['String']['input']>;
  fromEvmAddress_gt?: InputMaybe<Scalars['String']['input']>;
  fromEvmAddress_gte?: InputMaybe<Scalars['String']['input']>;
  fromEvmAddress_in?: InputMaybe<Array<Scalars['String']['input']>>;
  fromEvmAddress_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  fromEvmAddress_lt?: InputMaybe<Scalars['String']['input']>;
  fromEvmAddress_lte?: InputMaybe<Scalars['String']['input']>;
  fromEvmAddress_not_contains?: InputMaybe<Scalars['String']['input']>;
  fromEvmAddress_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  fromEvmAddress_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  fromEvmAddress_not_eq?: InputMaybe<Scalars['String']['input']>;
  fromEvmAddress_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  fromEvmAddress_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  fromEvmAddress_startsWith?: InputMaybe<Scalars['String']['input']>;
  from_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  id_endsWith?: InputMaybe<Scalars['String']['input']>;
  id_eq?: InputMaybe<Scalars['String']['input']>;
  id_gt?: InputMaybe<Scalars['String']['input']>;
  id_gte?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<Scalars['String']['input']>>;
  id_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  id_lt?: InputMaybe<Scalars['String']['input']>;
  id_lte?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  id_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  id_not_eq?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  id_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  id_startsWith?: InputMaybe<Scalars['String']['input']>;
  nftId_eq?: InputMaybe<Scalars['BigInt']['input']>;
  nftId_gt?: InputMaybe<Scalars['BigInt']['input']>;
  nftId_gte?: InputMaybe<Scalars['BigInt']['input']>;
  nftId_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  nftId_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  nftId_lt?: InputMaybe<Scalars['BigInt']['input']>;
  nftId_lte?: InputMaybe<Scalars['BigInt']['input']>;
  nftId_not_eq?: InputMaybe<Scalars['BigInt']['input']>;
  nftId_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  reefswapAction_eq?: InputMaybe<ReefswapAction>;
  reefswapAction_in?: InputMaybe<Array<ReefswapAction>>;
  reefswapAction_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  reefswapAction_not_eq?: InputMaybe<ReefswapAction>;
  reefswapAction_not_in?: InputMaybe<Array<ReefswapAction>>;
  signedData_eq?: InputMaybe<Scalars['JSON']['input']>;
  signedData_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  signedData_jsonContains?: InputMaybe<Scalars['JSON']['input']>;
  signedData_jsonHasKey?: InputMaybe<Scalars['JSON']['input']>;
  signedData_not_eq?: InputMaybe<Scalars['JSON']['input']>;
  success_eq?: InputMaybe<Scalars['Boolean']['input']>;
  success_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  success_not_eq?: InputMaybe<Scalars['Boolean']['input']>;
  timestamp_eq?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_gt?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_gte?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_in?: InputMaybe<Array<Scalars['DateTime']['input']>>;
  timestamp_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  timestamp_lt?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_lte?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_not_eq?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_not_in?: InputMaybe<Array<Scalars['DateTime']['input']>>;
  to?: InputMaybe<AccountWhereInput>;
  toEvmAddress_contains?: InputMaybe<Scalars['String']['input']>;
  toEvmAddress_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  toEvmAddress_endsWith?: InputMaybe<Scalars['String']['input']>;
  toEvmAddress_eq?: InputMaybe<Scalars['String']['input']>;
  toEvmAddress_gt?: InputMaybe<Scalars['String']['input']>;
  toEvmAddress_gte?: InputMaybe<Scalars['String']['input']>;
  toEvmAddress_in?: InputMaybe<Array<Scalars['String']['input']>>;
  toEvmAddress_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  toEvmAddress_lt?: InputMaybe<Scalars['String']['input']>;
  toEvmAddress_lte?: InputMaybe<Scalars['String']['input']>;
  toEvmAddress_not_contains?: InputMaybe<Scalars['String']['input']>;
  toEvmAddress_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  toEvmAddress_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  toEvmAddress_not_eq?: InputMaybe<Scalars['String']['input']>;
  toEvmAddress_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  toEvmAddress_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  toEvmAddress_startsWith?: InputMaybe<Scalars['String']['input']>;
  to_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  token?: InputMaybe<VerifiedContractWhereInput>;
  token_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  type_eq?: InputMaybe<TransferType>;
  type_in?: InputMaybe<Array<TransferType>>;
  type_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  type_not_eq?: InputMaybe<TransferType>;
  type_not_in?: InputMaybe<Array<TransferType>>;
};

export type TransfersConnection = {
  __typename?: 'TransfersConnection';
  edges: Array<TransferEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type VerificationRequest = {
  __typename?: 'VerificationRequest';
  args: Scalars['JSON']['output'];
  compilerVersion: Scalars['String']['output'];
  filename?: Maybe<Scalars['String']['output']>;
  /** Address */
  id: Scalars['String']['output'];
  license?: Maybe<Scalars['String']['output']>;
  message?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  optimization: Scalars['Boolean']['output'];
  runs: Scalars['Int']['output'];
  source: Scalars['JSON']['output'];
  success: Scalars['Boolean']['output'];
  target: Scalars['String']['output'];
  timestamp?: Maybe<Scalars['DateTime']['output']>;
};

export type VerificationRequestEdge = {
  __typename?: 'VerificationRequestEdge';
  cursor: Scalars['String']['output'];
  node: VerificationRequest;
};

export type VerificationRequestOrderByInput =
  | 'compilerVersion_ASC'
  | 'compilerVersion_ASC_NULLS_FIRST'
  | 'compilerVersion_DESC'
  | 'compilerVersion_DESC_NULLS_LAST'
  | 'filename_ASC'
  | 'filename_ASC_NULLS_FIRST'
  | 'filename_DESC'
  | 'filename_DESC_NULLS_LAST'
  | 'id_ASC'
  | 'id_ASC_NULLS_FIRST'
  | 'id_DESC'
  | 'id_DESC_NULLS_LAST'
  | 'license_ASC'
  | 'license_ASC_NULLS_FIRST'
  | 'license_DESC'
  | 'license_DESC_NULLS_LAST'
  | 'message_ASC'
  | 'message_ASC_NULLS_FIRST'
  | 'message_DESC'
  | 'message_DESC_NULLS_LAST'
  | 'name_ASC'
  | 'name_ASC_NULLS_FIRST'
  | 'name_DESC'
  | 'name_DESC_NULLS_LAST'
  | 'optimization_ASC'
  | 'optimization_ASC_NULLS_FIRST'
  | 'optimization_DESC'
  | 'optimization_DESC_NULLS_LAST'
  | 'runs_ASC'
  | 'runs_ASC_NULLS_FIRST'
  | 'runs_DESC'
  | 'runs_DESC_NULLS_LAST'
  | 'success_ASC'
  | 'success_ASC_NULLS_FIRST'
  | 'success_DESC'
  | 'success_DESC_NULLS_LAST'
  | 'target_ASC'
  | 'target_ASC_NULLS_FIRST'
  | 'target_DESC'
  | 'target_DESC_NULLS_LAST'
  | 'timestamp_ASC'
  | 'timestamp_ASC_NULLS_FIRST'
  | 'timestamp_DESC'
  | 'timestamp_DESC_NULLS_LAST';

export type VerificationRequestWhereInput = {
  AND?: InputMaybe<Array<VerificationRequestWhereInput>>;
  OR?: InputMaybe<Array<VerificationRequestWhereInput>>;
  args_eq?: InputMaybe<Scalars['JSON']['input']>;
  args_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  args_jsonContains?: InputMaybe<Scalars['JSON']['input']>;
  args_jsonHasKey?: InputMaybe<Scalars['JSON']['input']>;
  args_not_eq?: InputMaybe<Scalars['JSON']['input']>;
  compilerVersion_contains?: InputMaybe<Scalars['String']['input']>;
  compilerVersion_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  compilerVersion_endsWith?: InputMaybe<Scalars['String']['input']>;
  compilerVersion_eq?: InputMaybe<Scalars['String']['input']>;
  compilerVersion_gt?: InputMaybe<Scalars['String']['input']>;
  compilerVersion_gte?: InputMaybe<Scalars['String']['input']>;
  compilerVersion_in?: InputMaybe<Array<Scalars['String']['input']>>;
  compilerVersion_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  compilerVersion_lt?: InputMaybe<Scalars['String']['input']>;
  compilerVersion_lte?: InputMaybe<Scalars['String']['input']>;
  compilerVersion_not_contains?: InputMaybe<Scalars['String']['input']>;
  compilerVersion_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  compilerVersion_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  compilerVersion_not_eq?: InputMaybe<Scalars['String']['input']>;
  compilerVersion_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  compilerVersion_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  compilerVersion_startsWith?: InputMaybe<Scalars['String']['input']>;
  filename_contains?: InputMaybe<Scalars['String']['input']>;
  filename_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  filename_endsWith?: InputMaybe<Scalars['String']['input']>;
  filename_eq?: InputMaybe<Scalars['String']['input']>;
  filename_gt?: InputMaybe<Scalars['String']['input']>;
  filename_gte?: InputMaybe<Scalars['String']['input']>;
  filename_in?: InputMaybe<Array<Scalars['String']['input']>>;
  filename_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  filename_lt?: InputMaybe<Scalars['String']['input']>;
  filename_lte?: InputMaybe<Scalars['String']['input']>;
  filename_not_contains?: InputMaybe<Scalars['String']['input']>;
  filename_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  filename_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  filename_not_eq?: InputMaybe<Scalars['String']['input']>;
  filename_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  filename_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  filename_startsWith?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  id_endsWith?: InputMaybe<Scalars['String']['input']>;
  id_eq?: InputMaybe<Scalars['String']['input']>;
  id_gt?: InputMaybe<Scalars['String']['input']>;
  id_gte?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<Scalars['String']['input']>>;
  id_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  id_lt?: InputMaybe<Scalars['String']['input']>;
  id_lte?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  id_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  id_not_eq?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  id_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  id_startsWith?: InputMaybe<Scalars['String']['input']>;
  license_contains?: InputMaybe<Scalars['String']['input']>;
  license_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  license_endsWith?: InputMaybe<Scalars['String']['input']>;
  license_eq?: InputMaybe<Scalars['String']['input']>;
  license_gt?: InputMaybe<Scalars['String']['input']>;
  license_gte?: InputMaybe<Scalars['String']['input']>;
  license_in?: InputMaybe<Array<Scalars['String']['input']>>;
  license_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  license_lt?: InputMaybe<Scalars['String']['input']>;
  license_lte?: InputMaybe<Scalars['String']['input']>;
  license_not_contains?: InputMaybe<Scalars['String']['input']>;
  license_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  license_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  license_not_eq?: InputMaybe<Scalars['String']['input']>;
  license_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  license_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  license_startsWith?: InputMaybe<Scalars['String']['input']>;
  message_contains?: InputMaybe<Scalars['String']['input']>;
  message_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  message_endsWith?: InputMaybe<Scalars['String']['input']>;
  message_eq?: InputMaybe<Scalars['String']['input']>;
  message_gt?: InputMaybe<Scalars['String']['input']>;
  message_gte?: InputMaybe<Scalars['String']['input']>;
  message_in?: InputMaybe<Array<Scalars['String']['input']>>;
  message_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  message_lt?: InputMaybe<Scalars['String']['input']>;
  message_lte?: InputMaybe<Scalars['String']['input']>;
  message_not_contains?: InputMaybe<Scalars['String']['input']>;
  message_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  message_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  message_not_eq?: InputMaybe<Scalars['String']['input']>;
  message_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  message_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  message_startsWith?: InputMaybe<Scalars['String']['input']>;
  name_contains?: InputMaybe<Scalars['String']['input']>;
  name_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  name_endsWith?: InputMaybe<Scalars['String']['input']>;
  name_eq?: InputMaybe<Scalars['String']['input']>;
  name_gt?: InputMaybe<Scalars['String']['input']>;
  name_gte?: InputMaybe<Scalars['String']['input']>;
  name_in?: InputMaybe<Array<Scalars['String']['input']>>;
  name_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  name_lt?: InputMaybe<Scalars['String']['input']>;
  name_lte?: InputMaybe<Scalars['String']['input']>;
  name_not_contains?: InputMaybe<Scalars['String']['input']>;
  name_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  name_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  name_not_eq?: InputMaybe<Scalars['String']['input']>;
  name_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  name_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  name_startsWith?: InputMaybe<Scalars['String']['input']>;
  optimization_eq?: InputMaybe<Scalars['Boolean']['input']>;
  optimization_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  optimization_not_eq?: InputMaybe<Scalars['Boolean']['input']>;
  runs_eq?: InputMaybe<Scalars['Int']['input']>;
  runs_gt?: InputMaybe<Scalars['Int']['input']>;
  runs_gte?: InputMaybe<Scalars['Int']['input']>;
  runs_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  runs_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  runs_lt?: InputMaybe<Scalars['Int']['input']>;
  runs_lte?: InputMaybe<Scalars['Int']['input']>;
  runs_not_eq?: InputMaybe<Scalars['Int']['input']>;
  runs_not_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  source_eq?: InputMaybe<Scalars['JSON']['input']>;
  source_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  source_jsonContains?: InputMaybe<Scalars['JSON']['input']>;
  source_jsonHasKey?: InputMaybe<Scalars['JSON']['input']>;
  source_not_eq?: InputMaybe<Scalars['JSON']['input']>;
  success_eq?: InputMaybe<Scalars['Boolean']['input']>;
  success_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  success_not_eq?: InputMaybe<Scalars['Boolean']['input']>;
  target_contains?: InputMaybe<Scalars['String']['input']>;
  target_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  target_endsWith?: InputMaybe<Scalars['String']['input']>;
  target_eq?: InputMaybe<Scalars['String']['input']>;
  target_gt?: InputMaybe<Scalars['String']['input']>;
  target_gte?: InputMaybe<Scalars['String']['input']>;
  target_in?: InputMaybe<Array<Scalars['String']['input']>>;
  target_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  target_lt?: InputMaybe<Scalars['String']['input']>;
  target_lte?: InputMaybe<Scalars['String']['input']>;
  target_not_contains?: InputMaybe<Scalars['String']['input']>;
  target_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  target_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  target_not_eq?: InputMaybe<Scalars['String']['input']>;
  target_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  target_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  target_startsWith?: InputMaybe<Scalars['String']['input']>;
  timestamp_eq?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_gt?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_gte?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_in?: InputMaybe<Array<Scalars['DateTime']['input']>>;
  timestamp_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  timestamp_lt?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_lte?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_not_eq?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_not_in?: InputMaybe<Array<Scalars['DateTime']['input']>>;
};

export type VerificationRequestsConnection = {
  __typename?: 'VerificationRequestsConnection';
  edges: Array<VerificationRequestEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type VerifiedContract = {
  __typename?: 'VerifiedContract';
  approved?: Maybe<Scalars['Boolean']['output']>;
  args: Scalars['JSON']['output'];
  compiledData: Scalars['JSON']['output'];
  compilerVersion: Scalars['String']['output'];
  contract: Contract;
  contractData?: Maybe<Scalars['JSON']['output']>;
  filename?: Maybe<Scalars['String']['output']>;
  /** Address */
  id: Scalars['String']['output'];
  license?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  optimization: Scalars['Boolean']['output'];
  runs: Scalars['Int']['output'];
  source: Scalars['JSON']['output'];
  target: Scalars['String']['output'];
  timestamp?: Maybe<Scalars['DateTime']['output']>;
  type?: Maybe<ContractType>;
};

export type VerifiedContractEdge = {
  __typename?: 'VerifiedContractEdge';
  cursor: Scalars['String']['output'];
  node: VerifiedContract;
};

export type VerifiedContractOrderByInput =
  | 'approved_ASC'
  | 'approved_ASC_NULLS_FIRST'
  | 'approved_DESC'
  | 'approved_DESC_NULLS_LAST'
  | 'compilerVersion_ASC'
  | 'compilerVersion_ASC_NULLS_FIRST'
  | 'compilerVersion_DESC'
  | 'compilerVersion_DESC_NULLS_LAST'
  | 'contract_bytecodeArguments_ASC'
  | 'contract_bytecodeArguments_ASC_NULLS_FIRST'
  | 'contract_bytecodeArguments_DESC'
  | 'contract_bytecodeArguments_DESC_NULLS_LAST'
  | 'contract_bytecodeContext_ASC'
  | 'contract_bytecodeContext_ASC_NULLS_FIRST'
  | 'contract_bytecodeContext_DESC'
  | 'contract_bytecodeContext_DESC_NULLS_LAST'
  | 'contract_bytecode_ASC'
  | 'contract_bytecode_ASC_NULLS_FIRST'
  | 'contract_bytecode_DESC'
  | 'contract_bytecode_DESC_NULLS_LAST'
  | 'contract_gasLimit_ASC'
  | 'contract_gasLimit_ASC_NULLS_FIRST'
  | 'contract_gasLimit_DESC'
  | 'contract_gasLimit_DESC_NULLS_LAST'
  | 'contract_id_ASC'
  | 'contract_id_ASC_NULLS_FIRST'
  | 'contract_id_DESC'
  | 'contract_id_DESC_NULLS_LAST'
  | 'contract_storageLimit_ASC'
  | 'contract_storageLimit_ASC_NULLS_FIRST'
  | 'contract_storageLimit_DESC'
  | 'contract_storageLimit_DESC_NULLS_LAST'
  | 'contract_timestamp_ASC'
  | 'contract_timestamp_ASC_NULLS_FIRST'
  | 'contract_timestamp_DESC'
  | 'contract_timestamp_DESC_NULLS_LAST'
  | 'filename_ASC'
  | 'filename_ASC_NULLS_FIRST'
  | 'filename_DESC'
  | 'filename_DESC_NULLS_LAST'
  | 'id_ASC'
  | 'id_ASC_NULLS_FIRST'
  | 'id_DESC'
  | 'id_DESC_NULLS_LAST'
  | 'license_ASC'
  | 'license_ASC_NULLS_FIRST'
  | 'license_DESC'
  | 'license_DESC_NULLS_LAST'
  | 'name_ASC'
  | 'name_ASC_NULLS_FIRST'
  | 'name_DESC'
  | 'name_DESC_NULLS_LAST'
  | 'optimization_ASC'
  | 'optimization_ASC_NULLS_FIRST'
  | 'optimization_DESC'
  | 'optimization_DESC_NULLS_LAST'
  | 'runs_ASC'
  | 'runs_ASC_NULLS_FIRST'
  | 'runs_DESC'
  | 'runs_DESC_NULLS_LAST'
  | 'target_ASC'
  | 'target_ASC_NULLS_FIRST'
  | 'target_DESC'
  | 'target_DESC_NULLS_LAST'
  | 'timestamp_ASC'
  | 'timestamp_ASC_NULLS_FIRST'
  | 'timestamp_DESC'
  | 'timestamp_DESC_NULLS_LAST'
  | 'type_ASC'
  | 'type_ASC_NULLS_FIRST'
  | 'type_DESC'
  | 'type_DESC_NULLS_LAST';

export type VerifiedContractWhereInput = {
  AND?: InputMaybe<Array<VerifiedContractWhereInput>>;
  OR?: InputMaybe<Array<VerifiedContractWhereInput>>;
  approved_eq?: InputMaybe<Scalars['Boolean']['input']>;
  approved_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  approved_not_eq?: InputMaybe<Scalars['Boolean']['input']>;
  args_eq?: InputMaybe<Scalars['JSON']['input']>;
  args_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  args_jsonContains?: InputMaybe<Scalars['JSON']['input']>;
  args_jsonHasKey?: InputMaybe<Scalars['JSON']['input']>;
  args_not_eq?: InputMaybe<Scalars['JSON']['input']>;
  compiledData_eq?: InputMaybe<Scalars['JSON']['input']>;
  compiledData_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  compiledData_jsonContains?: InputMaybe<Scalars['JSON']['input']>;
  compiledData_jsonHasKey?: InputMaybe<Scalars['JSON']['input']>;
  compiledData_not_eq?: InputMaybe<Scalars['JSON']['input']>;
  compilerVersion_contains?: InputMaybe<Scalars['String']['input']>;
  compilerVersion_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  compilerVersion_endsWith?: InputMaybe<Scalars['String']['input']>;
  compilerVersion_eq?: InputMaybe<Scalars['String']['input']>;
  compilerVersion_gt?: InputMaybe<Scalars['String']['input']>;
  compilerVersion_gte?: InputMaybe<Scalars['String']['input']>;
  compilerVersion_in?: InputMaybe<Array<Scalars['String']['input']>>;
  compilerVersion_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  compilerVersion_lt?: InputMaybe<Scalars['String']['input']>;
  compilerVersion_lte?: InputMaybe<Scalars['String']['input']>;
  compilerVersion_not_contains?: InputMaybe<Scalars['String']['input']>;
  compilerVersion_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  compilerVersion_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  compilerVersion_not_eq?: InputMaybe<Scalars['String']['input']>;
  compilerVersion_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  compilerVersion_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  compilerVersion_startsWith?: InputMaybe<Scalars['String']['input']>;
  contract?: InputMaybe<ContractWhereInput>;
  contractData_eq?: InputMaybe<Scalars['JSON']['input']>;
  contractData_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  contractData_jsonContains?: InputMaybe<Scalars['JSON']['input']>;
  contractData_jsonHasKey?: InputMaybe<Scalars['JSON']['input']>;
  contractData_not_eq?: InputMaybe<Scalars['JSON']['input']>;
  contract_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  filename_contains?: InputMaybe<Scalars['String']['input']>;
  filename_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  filename_endsWith?: InputMaybe<Scalars['String']['input']>;
  filename_eq?: InputMaybe<Scalars['String']['input']>;
  filename_gt?: InputMaybe<Scalars['String']['input']>;
  filename_gte?: InputMaybe<Scalars['String']['input']>;
  filename_in?: InputMaybe<Array<Scalars['String']['input']>>;
  filename_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  filename_lt?: InputMaybe<Scalars['String']['input']>;
  filename_lte?: InputMaybe<Scalars['String']['input']>;
  filename_not_contains?: InputMaybe<Scalars['String']['input']>;
  filename_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  filename_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  filename_not_eq?: InputMaybe<Scalars['String']['input']>;
  filename_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  filename_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  filename_startsWith?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  id_endsWith?: InputMaybe<Scalars['String']['input']>;
  id_eq?: InputMaybe<Scalars['String']['input']>;
  id_gt?: InputMaybe<Scalars['String']['input']>;
  id_gte?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<Scalars['String']['input']>>;
  id_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  id_lt?: InputMaybe<Scalars['String']['input']>;
  id_lte?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  id_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  id_not_eq?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  id_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  id_startsWith?: InputMaybe<Scalars['String']['input']>;
  license_contains?: InputMaybe<Scalars['String']['input']>;
  license_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  license_endsWith?: InputMaybe<Scalars['String']['input']>;
  license_eq?: InputMaybe<Scalars['String']['input']>;
  license_gt?: InputMaybe<Scalars['String']['input']>;
  license_gte?: InputMaybe<Scalars['String']['input']>;
  license_in?: InputMaybe<Array<Scalars['String']['input']>>;
  license_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  license_lt?: InputMaybe<Scalars['String']['input']>;
  license_lte?: InputMaybe<Scalars['String']['input']>;
  license_not_contains?: InputMaybe<Scalars['String']['input']>;
  license_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  license_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  license_not_eq?: InputMaybe<Scalars['String']['input']>;
  license_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  license_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  license_startsWith?: InputMaybe<Scalars['String']['input']>;
  name_contains?: InputMaybe<Scalars['String']['input']>;
  name_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  name_endsWith?: InputMaybe<Scalars['String']['input']>;
  name_eq?: InputMaybe<Scalars['String']['input']>;
  name_gt?: InputMaybe<Scalars['String']['input']>;
  name_gte?: InputMaybe<Scalars['String']['input']>;
  name_in?: InputMaybe<Array<Scalars['String']['input']>>;
  name_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  name_lt?: InputMaybe<Scalars['String']['input']>;
  name_lte?: InputMaybe<Scalars['String']['input']>;
  name_not_contains?: InputMaybe<Scalars['String']['input']>;
  name_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  name_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  name_not_eq?: InputMaybe<Scalars['String']['input']>;
  name_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  name_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  name_startsWith?: InputMaybe<Scalars['String']['input']>;
  optimization_eq?: InputMaybe<Scalars['Boolean']['input']>;
  optimization_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  optimization_not_eq?: InputMaybe<Scalars['Boolean']['input']>;
  runs_eq?: InputMaybe<Scalars['Int']['input']>;
  runs_gt?: InputMaybe<Scalars['Int']['input']>;
  runs_gte?: InputMaybe<Scalars['Int']['input']>;
  runs_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  runs_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  runs_lt?: InputMaybe<Scalars['Int']['input']>;
  runs_lte?: InputMaybe<Scalars['Int']['input']>;
  runs_not_eq?: InputMaybe<Scalars['Int']['input']>;
  runs_not_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  source_eq?: InputMaybe<Scalars['JSON']['input']>;
  source_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  source_jsonContains?: InputMaybe<Scalars['JSON']['input']>;
  source_jsonHasKey?: InputMaybe<Scalars['JSON']['input']>;
  source_not_eq?: InputMaybe<Scalars['JSON']['input']>;
  target_contains?: InputMaybe<Scalars['String']['input']>;
  target_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  target_endsWith?: InputMaybe<Scalars['String']['input']>;
  target_eq?: InputMaybe<Scalars['String']['input']>;
  target_gt?: InputMaybe<Scalars['String']['input']>;
  target_gte?: InputMaybe<Scalars['String']['input']>;
  target_in?: InputMaybe<Array<Scalars['String']['input']>>;
  target_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  target_lt?: InputMaybe<Scalars['String']['input']>;
  target_lte?: InputMaybe<Scalars['String']['input']>;
  target_not_contains?: InputMaybe<Scalars['String']['input']>;
  target_not_containsInsensitive?: InputMaybe<Scalars['String']['input']>;
  target_not_endsWith?: InputMaybe<Scalars['String']['input']>;
  target_not_eq?: InputMaybe<Scalars['String']['input']>;
  target_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  target_not_startsWith?: InputMaybe<Scalars['String']['input']>;
  target_startsWith?: InputMaybe<Scalars['String']['input']>;
  timestamp_eq?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_gt?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_gte?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_in?: InputMaybe<Array<Scalars['DateTime']['input']>>;
  timestamp_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  timestamp_lt?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_lte?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_not_eq?: InputMaybe<Scalars['DateTime']['input']>;
  timestamp_not_in?: InputMaybe<Array<Scalars['DateTime']['input']>>;
  type_eq?: InputMaybe<ContractType>;
  type_in?: InputMaybe<Array<ContractType>>;
  type_isNull?: InputMaybe<Scalars['Boolean']['input']>;
  type_not_eq?: InputMaybe<ContractType>;
  type_not_in?: InputMaybe<Array<ContractType>>;
};

export type VerifiedContractsConnection = {
  __typename?: 'VerifiedContractsConnection';
  edges: Array<VerifiedContractEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type WhereIdInput = {
  id: Scalars['String']['input'];
};

export type TransfersQueryQueryVariables = Exact<{
  first: Scalars['Int']['input'];
  after?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<TransferWhereInput>;
  orderBy: Array<TransferOrderByInput> | TransferOrderByInput;
}>;


export type TransfersQueryQuery = { __typename?: 'Query', transfersConnection: { __typename?: 'TransfersConnection', totalCount: number, edges: Array<{ __typename?: 'TransferEdge', node: { __typename?: 'Transfer', id: string, amount: any, timestamp: any, success: boolean, type: TransferType, extrinsicHash?: string | null, from: { __typename?: 'Account', id: string }, to: { __typename?: 'Account', id: string }, token: { __typename?: 'VerifiedContract', id: string, name: string } } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor: string } } };

export type FeeEventsQueryQueryVariables = Exact<{
  where?: InputMaybe<EventWhereInput>;
  orderBy: Array<EventOrderByInput> | EventOrderByInput;
}>;


export type FeeEventsQueryQuery = { __typename?: 'Query', eventsConnection: { __typename?: 'EventsConnection', edges: Array<{ __typename?: 'EventEdge', node: { __typename?: 'Event', id: string, data: any, extrinsic: { __typename?: 'Extrinsic', id: string, hash: string } } }> } };

export type DiagnosticTransfersQueryQueryVariables = Exact<{
  orderBy: Array<TransferOrderByInput> | TransferOrderByInput;
}>;


export type DiagnosticTransfersQueryQuery = { __typename?: 'Query', transfersConnection: { __typename?: 'TransfersConnection', totalCount: number, edges: Array<{ __typename?: 'TransferEdge', node: { __typename?: 'Transfer', id: string, amount: any, timestamp: any, type: TransferType, from: { __typename?: 'Account', id: string }, to: { __typename?: 'Account', id: string } } }> } };

export type TransfersSubscriptionSubscriptionVariables = Exact<{
  where?: InputMaybe<TransferWhereInput>;
  orderBy?: InputMaybe<Array<TransferOrderByInput> | TransferOrderByInput>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type TransfersSubscriptionSubscription = { __typename?: 'Subscription', transfers: Array<{ __typename?: 'Transfer', id: string, amount: any, timestamp: any, success: boolean, type: TransferType, extrinsicHash?: string | null, from: { __typename?: 'Account', id: string }, to: { __typename?: 'Account', id: string }, token: { __typename?: 'VerifiedContract', id: string, name: string, contractData?: any | null } }> };

export type TransfersPollingQueryQueryVariables = Exact<{
  where?: InputMaybe<TransferWhereInput>;
  orderBy?: InputMaybe<Array<TransferOrderByInput> | TransferOrderByInput>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type TransfersPollingQueryQuery = { __typename?: 'Query', transfers: Array<{ __typename?: 'Transfer', id: string, amount: any, timestamp: any, success: boolean, type: TransferType, extrinsicHash?: string | null, from: { __typename?: 'Account', id: string }, to: { __typename?: 'Account', id: string }, token: { __typename?: 'VerifiedContract', id: string, name: string, contractData?: any | null } }> };


export const TransfersQueryDocument = gql`
    query TransfersQuery($first: Int!, $after: String, $where: TransferWhereInput, $orderBy: [TransferOrderByInput!]!) {
  transfersConnection(
    orderBy: $orderBy
    first: $first
    after: $after
    where: $where
  ) {
    edges {
      node {
        id
        amount
        timestamp
        success
        type
        extrinsicHash
        from {
          id
        }
        to {
          id
        }
        token {
          id
          name
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
    `;

/**
 * __useTransfersQueryQuery__
 *
 * To run a query within a React component, call `useTransfersQueryQuery` and pass it any options that fit your needs.
 * When your component renders, `useTransfersQueryQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useTransfersQueryQuery({
 *   variables: {
 *      first: // value for 'first'
 *      after: // value for 'after'
 *      where: // value for 'where'
 *      orderBy: // value for 'orderBy'
 *   },
 * });
 */
export function useTransfersQueryQuery(baseOptions: Apollo.QueryHookOptions<TransfersQueryQuery, TransfersQueryQueryVariables> & ({ variables: TransfersQueryQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<TransfersQueryQuery, TransfersQueryQueryVariables>(TransfersQueryDocument, options);
      }
export function useTransfersQueryLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<TransfersQueryQuery, TransfersQueryQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<TransfersQueryQuery, TransfersQueryQueryVariables>(TransfersQueryDocument, options);
        }
export function useTransfersQuerySuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TransfersQueryQuery, TransfersQueryQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<TransfersQueryQuery, TransfersQueryQueryVariables>(TransfersQueryDocument, options);
        }
export type TransfersQueryQueryHookResult = ReturnType<typeof useTransfersQueryQuery>;
export type TransfersQueryLazyQueryHookResult = ReturnType<typeof useTransfersQueryLazyQuery>;
export type TransfersQuerySuspenseQueryHookResult = ReturnType<typeof useTransfersQuerySuspenseQuery>;
export type TransfersQueryQueryResult = Apollo.QueryResult<TransfersQueryQuery, TransfersQueryQueryVariables>;
export const FeeEventsQueryDocument = gql`
    query FeeEventsQuery($where: EventWhereInput, $orderBy: [EventOrderByInput!]!) {
  eventsConnection(orderBy: $orderBy, where: $where) {
    edges {
      node {
        id
        data
        extrinsic {
          id
          hash
        }
      }
    }
  }
}
    `;

/**
 * __useFeeEventsQueryQuery__
 *
 * To run a query within a React component, call `useFeeEventsQueryQuery` and pass it any options that fit your needs.
 * When your component renders, `useFeeEventsQueryQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useFeeEventsQueryQuery({
 *   variables: {
 *      where: // value for 'where'
 *      orderBy: // value for 'orderBy'
 *   },
 * });
 */
export function useFeeEventsQueryQuery(baseOptions: Apollo.QueryHookOptions<FeeEventsQueryQuery, FeeEventsQueryQueryVariables> & ({ variables: FeeEventsQueryQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<FeeEventsQueryQuery, FeeEventsQueryQueryVariables>(FeeEventsQueryDocument, options);
      }
export function useFeeEventsQueryLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<FeeEventsQueryQuery, FeeEventsQueryQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<FeeEventsQueryQuery, FeeEventsQueryQueryVariables>(FeeEventsQueryDocument, options);
        }
export function useFeeEventsQuerySuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<FeeEventsQueryQuery, FeeEventsQueryQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<FeeEventsQueryQuery, FeeEventsQueryQueryVariables>(FeeEventsQueryDocument, options);
        }
export type FeeEventsQueryQueryHookResult = ReturnType<typeof useFeeEventsQueryQuery>;
export type FeeEventsQueryLazyQueryHookResult = ReturnType<typeof useFeeEventsQueryLazyQuery>;
export type FeeEventsQuerySuspenseQueryHookResult = ReturnType<typeof useFeeEventsQuerySuspenseQuery>;
export type FeeEventsQueryQueryResult = Apollo.QueryResult<FeeEventsQueryQuery, FeeEventsQueryQueryVariables>;
export const DiagnosticTransfersQueryDocument = gql`
    query DiagnosticTransfersQuery($orderBy: [TransferOrderByInput!]!) {
  transfersConnection(first: 5, orderBy: $orderBy) {
    edges {
      node {
        id
        from {
          id
        }
        to {
          id
        }
        amount
        timestamp
        type
      }
    }
    totalCount
  }
}
    `;

/**
 * __useDiagnosticTransfersQueryQuery__
 *
 * To run a query within a React component, call `useDiagnosticTransfersQueryQuery` and pass it any options that fit your needs.
 * When your component renders, `useDiagnosticTransfersQueryQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useDiagnosticTransfersQueryQuery({
 *   variables: {
 *      orderBy: // value for 'orderBy'
 *   },
 * });
 */
export function useDiagnosticTransfersQueryQuery(baseOptions: Apollo.QueryHookOptions<DiagnosticTransfersQueryQuery, DiagnosticTransfersQueryQueryVariables> & ({ variables: DiagnosticTransfersQueryQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<DiagnosticTransfersQueryQuery, DiagnosticTransfersQueryQueryVariables>(DiagnosticTransfersQueryDocument, options);
      }
export function useDiagnosticTransfersQueryLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<DiagnosticTransfersQueryQuery, DiagnosticTransfersQueryQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<DiagnosticTransfersQueryQuery, DiagnosticTransfersQueryQueryVariables>(DiagnosticTransfersQueryDocument, options);
        }
export function useDiagnosticTransfersQuerySuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<DiagnosticTransfersQueryQuery, DiagnosticTransfersQueryQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<DiagnosticTransfersQueryQuery, DiagnosticTransfersQueryQueryVariables>(DiagnosticTransfersQueryDocument, options);
        }
export type DiagnosticTransfersQueryQueryHookResult = ReturnType<typeof useDiagnosticTransfersQueryQuery>;
export type DiagnosticTransfersQueryLazyQueryHookResult = ReturnType<typeof useDiagnosticTransfersQueryLazyQuery>;
export type DiagnosticTransfersQuerySuspenseQueryHookResult = ReturnType<typeof useDiagnosticTransfersQuerySuspenseQuery>;
export type DiagnosticTransfersQueryQueryResult = Apollo.QueryResult<DiagnosticTransfersQueryQuery, DiagnosticTransfersQueryQueryVariables>;
export const TransfersSubscriptionDocument = gql`
    subscription TransfersSubscription($where: TransferWhereInput, $orderBy: [TransferOrderByInput!], $offset: Int, $limit: Int) {
  transfers(where: $where, orderBy: $orderBy, offset: $offset, limit: $limit) {
    id
    amount
    timestamp
    success
    type
    extrinsicHash
    from {
      id
    }
    to {
      id
    }
    token {
      id
      name
      contractData
    }
  }
}
    `;

/**
 * __useTransfersSubscriptionSubscription__
 *
 * To run a query within a React component, call `useTransfersSubscriptionSubscription` and pass it any options that fit your needs.
 * When your component renders, `useTransfersSubscriptionSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useTransfersSubscriptionSubscription({
 *   variables: {
 *      where: // value for 'where'
 *      orderBy: // value for 'orderBy'
 *      offset: // value for 'offset'
 *      limit: // value for 'limit'
 *   },
 * });
 */
export function useTransfersSubscriptionSubscription(baseOptions?: Apollo.SubscriptionHookOptions<TransfersSubscriptionSubscription, TransfersSubscriptionSubscriptionVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useSubscription<TransfersSubscriptionSubscription, TransfersSubscriptionSubscriptionVariables>(TransfersSubscriptionDocument, options);
      }
export type TransfersSubscriptionSubscriptionHookResult = ReturnType<typeof useTransfersSubscriptionSubscription>;
export type TransfersSubscriptionSubscriptionResult = Apollo.SubscriptionResult<TransfersSubscriptionSubscription>;
export const TransfersPollingQueryDocument = gql`
    query TransfersPollingQuery($where: TransferWhereInput, $orderBy: [TransferOrderByInput!], $offset: Int, $limit: Int) {
  transfers(where: $where, orderBy: $orderBy, offset: $offset, limit: $limit) {
    id
    amount
    timestamp
    success
    type
    extrinsicHash
    from {
      id
    }
    to {
      id
    }
    token {
      id
      name
      contractData
    }
  }
}
    `;

/**
 * __useTransfersPollingQueryQuery__
 *
 * To run a query within a React component, call `useTransfersPollingQueryQuery` and pass it any options that fit your needs.
 * When your component renders, `useTransfersPollingQueryQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useTransfersPollingQueryQuery({
 *   variables: {
 *      where: // value for 'where'
 *      orderBy: // value for 'orderBy'
 *      offset: // value for 'offset'
 *      limit: // value for 'limit'
 *   },
 * });
 */
export function useTransfersPollingQueryQuery(baseOptions?: Apollo.QueryHookOptions<TransfersPollingQueryQuery, TransfersPollingQueryQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<TransfersPollingQueryQuery, TransfersPollingQueryQueryVariables>(TransfersPollingQueryDocument, options);
      }
export function useTransfersPollingQueryLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<TransfersPollingQueryQuery, TransfersPollingQueryQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<TransfersPollingQueryQuery, TransfersPollingQueryQueryVariables>(TransfersPollingQueryDocument, options);
        }
export function useTransfersPollingQuerySuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TransfersPollingQueryQuery, TransfersPollingQueryQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<TransfersPollingQueryQuery, TransfersPollingQueryQueryVariables>(TransfersPollingQueryDocument, options);
        }
export type TransfersPollingQueryQueryHookResult = ReturnType<typeof useTransfersPollingQueryQuery>;
export type TransfersPollingQueryLazyQueryHookResult = ReturnType<typeof useTransfersPollingQueryLazyQuery>;
export type TransfersPollingQuerySuspenseQueryHookResult = ReturnType<typeof useTransfersPollingQuerySuspenseQuery>;
export type TransfersPollingQueryQueryResult = Apollo.QueryResult<TransfersPollingQueryQuery, TransfersPollingQueryQueryVariables>;
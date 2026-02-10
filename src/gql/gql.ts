/* eslint-disable */
import * as types from './graphql';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  query GetAccountByEvm($evmAddress: String!) {\n    accounts(where: { evmAddress_eq: $evmAddress }, limit: 1) {\n      id\n      evmAddress\n    }\n  }\n": typeof types.GetAccountByEvmDocument,
    "\n  query GetAccountByNative($nativeAddress: String!) {\n    accounts(where: { id_eq: $nativeAddress }, limit: 1) {\n      id\n      evmAddress\n    }\n  }\n": typeof types.GetAccountByNativeDocument,
    "\n  query TokenHoldersByAccount($accountId: String!, $first: Int!) {\n    tokenHolders: tokenHoldersConnection(\n      orderBy: balance_DESC\n      where: {\n        signer: { id_eq: $accountId }\n        AND: { token: { type_eq: ERC20 } }\n      }\n      first: $first\n    ) {\n      edges {\n        node {\n          signer { id evmAddress }\n          balance\n          token { id contractData }\n        }\n      }\n      totalCount\n    }\n  }\n": typeof types.TokenHoldersByAccountDocument,
    "\n  query BlockByTimeBefore($ts: DateTime!) {\n    blocks(orderBy: timestamp_DESC, limit: 1, where: { timestamp_lte: $ts }) {\n      height\n      timestamp\n    }\n  }\n": typeof types.BlockByTimeBeforeDocument,
    "\n  query BlockByTimeAfter($ts: DateTime!) {\n    blocks(orderBy: timestamp_ASC, limit: 1, where: { timestamp_gte: $ts }) {\n      height\n      timestamp\n    }\n  }\n": typeof types.BlockByTimeAfterDocument,
    "\n  query SquidStatusQuery { \n    squidStatus { \n      height \n    } \n  }\n": typeof types.SquidStatusQueryDocument,
    "\n  query LatestBlockQuery {\n    blocks(orderBy: height_DESC, limit: 1) {\n      height\n      timestamp\n      processorTimestamp\n    }\n  }\n": typeof types.LatestBlockQueryDocument,
    "\n  query HealthCombinedQuery {\n    squidStatus { height }\n    blocks(orderBy: height_DESC, limit: 1) {\n      height\n      timestamp\n      processorTimestamp\n    }\n  }\n": typeof types.HealthCombinedQueryDocument,
    "\n  query NftsByOwner($owner: String!) {\n    tokenHolders(\n      where: { \n        signer: { evmAddress_eq: $owner },\n        balance_gt: \"0\",\n        token: { type_in: [ERC721, ERC1155] }\n      }\n      limit: 300\n    ) {\n      id\n      balance\n      type\n      nftId\n      token {\n        id\n        type\n      }\n    }\n  }\n": typeof types.NftsByOwnerDocument,
    "\n  query NftsByOwnerPaged($owner: String!, $limit: Int!, $offset: Int!) {\n    tokenHolders(\n      where: { signer: { evmAddress_eq: $owner }, balance_gt: \"0\", token: { type_in: [ERC721, ERC1155] } }\n      limit: $limit\n      offset: $offset\n    ) {\n      id\n      balance\n      nftId\n      token { id type }\n    }\n  }\n": typeof types.NftsByOwnerPagedDocument,
    "\n  query NftsByOwnerCount($owner: String!) {\n    tokenHolders: tokenHoldersConnection(\n      where: { signer: { evmAddress_eq: $owner }, balance_gt: \"0\", token: { type_in: [ERC721, ERC1155] } }\n      orderBy: [id_DESC]\n      first: 1\n    ) {\n      totalCount\n    }\n  }\n": typeof types.NftsByOwnerCountDocument,
    "\n  query StakingConnectionQuery($accountId: String!, $from: DateTime, $to: DateTime) {\n    stakingsConnection(\n      where: { signer: { id_eq: $accountId }, type_eq: Reward, timestamp_gte: $from, timestamp_lte: $to }\n      orderBy: [id_DESC]\n    ) {\n      totalCount\n    }\n  }\n": typeof types.StakingConnectionQueryDocument,
    "\n  query StakingListQuery($accountId: String!, $first: Int!, $after: Int!) {\n    stakings(\n      orderBy: [id_DESC]\n      where: { signer: { id_eq: $accountId }, type_eq: Reward }\n      limit: $first\n      offset: $after\n    ) {\n      id\n      amount\n      timestamp\n      signer { id }\n      event {\n        extrinsic { hash }\n      }\n    }\n  }\n": typeof types.StakingListQueryDocument,
    "\n  query StakingListMinQuery($accountId: String!, $first: Int!, $after: Int!, $from: DateTime, $to: DateTime) {\n    stakings(\n      orderBy: [id_DESC]\n      where: { signer: { id_eq: $accountId }, type_eq: Reward, timestamp_gte: $from, timestamp_lte: $to }\n      limit: $first\n      offset: $after\n    ) {\n      id\n      amount\n      timestamp\n    }\n  }\n": typeof types.StakingListMinQueryDocument,
    "\n  query StakingLastTsQuery($accountId: String!) {\n    stakings(\n      orderBy: [timestamp_DESC]\n      where: { signer: { id_eq: $accountId }, type_eq: Reward }\n      limit: 1\n    ) {\n      timestamp\n    }\n  }\n": typeof types.StakingLastTsQueryDocument,
    "\n  query VerifiedContractsByIds($ids: [String!], $first: Int!) {\n    verifiedContracts(\n      where: { id_in: $ids }\n      limit: $first\n    ) {\n      id\n      contractData\n    }\n  }\n": typeof types.VerifiedContractsByIdsDocument,
    "\n  query ExtrinsicIdentityUnified(\n    $hash: String, $id: String, $height: Int, $index: Int,\n    $useHash: Boolean!, $useId: Boolean!, $useHeightIndex: Boolean!\n  ) {\n    byHash: extrinsics(where: { hash_eq: $hash }, limit: 1) @include(if: $useHash) { id hash }\n    byId: extrinsics(where: { id_eq: $id }, limit: 1) @include(if: $useId) { id hash }\n    byHeightIndex: extrinsics(where: { index_eq: $index, block: { height_eq: $height } }, limit: 1) @include(if: $useHeightIndex) { id hash }\n  }\n": typeof types.ExtrinsicIdentityUnifiedDocument,
    "\n  fragment TransferCommonFields on Transfer {\n    id\n    amount\n    timestamp\n    success\n    type\n    reefswapAction\n    extrinsicHash\n    extrinsicId\n    blockHeight\n    extrinsicIndex\n    eventIndex\n    fromEvmAddress\n    toEvmAddress\n    from { id }\n    to { id }\n    token { id name }\n  }\n": typeof types.TransferCommonFieldsFragmentDoc,
    "\n  query PaginatedTransfers($first: Int!, $after: String, $where: TransferWhereInput, $orderBy: [TransferOrderByInput!]!) {\n    transfersConnection(orderBy: $orderBy, first: $first, after: $after, where: $where) {\n      edges {\n        node {\n          ...TransferCommonFields\n          token {\n            contractData\n          }\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      totalCount\n    }\n  }\n": typeof types.PaginatedTransfersDocument,
    "\n  query TransfersMinQuery($first: Int!, $after: String, $where: TransferWhereInput, $orderBy: [TransferOrderByInput!]!) {\n    transfersConnection(orderBy: $orderBy, first: $first, after: $after, where: $where) {\n      edges {\n        node {\n          ...TransferCommonFields\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      totalCount\n    }\n  }\n": typeof types.TransfersMinQueryDocument,
    "\n  query TransfersCount($where: TransferWhereInput, $orderBy: [TransferOrderByInput!]!) {\n    transfersConnection(where: $where, orderBy: $orderBy, first: 1) {\n      totalCount\n    }\n  }\n": typeof types.TransfersCountDocument,
    "\n  query TransfersBulkCounts(\n    $whereAny: TransferWhereInput\n    $whereIncoming: TransferWhereInput\n    $whereOutgoing: TransferWhereInput\n    $orderBy: [TransferOrderByInput!]!\n  ) {\n    all: transfersConnection(where: $whereAny, orderBy: $orderBy, first: 1) {\n      totalCount\n    }\n    incoming: transfersConnection(where: $whereIncoming, orderBy: $orderBy, first: 1) {\n      totalCount\n    }\n    outgoing: transfersConnection(where: $whereOutgoing, orderBy: $orderBy, first: 1) {\n      totalCount\n    }\n  }\n": typeof types.TransfersBulkCountsDocument,
    "\n  query TransfersPollingQuery($where: TransferWhereInput, $orderBy: [TransferOrderByInput!], $offset: Int, $limit: Int) {\n    transfers(where: $where, orderBy: $orderBy, offset: $offset, limit: $limit) {\n      ...TransferCommonFields\n    }\n  }\n": typeof types.TransfersPollingQueryDocument,
    "\n  query VerifiedContractsByName($names: [String!], $needle: String) {\n    verifiedContracts(where: { OR: [{ name_in: $names }, { name_containsInsensitive: $needle }] }) {\n      id\n      name\n    }\n  }\n": typeof types.VerifiedContractsByNameDocument,
    "\n  query ExtrinsicsGrowth24h($fromPrev: DateTime!, $fromNow: DateTime!, $toNow: DateTime!) {\n    last24h: extrinsicsConnection(\n      where: { timestamp_gte: $fromNow, timestamp_lt: $toNow }\n      orderBy: timestamp_ASC\n    ) {\n      totalCount\n    }\n    prev24h: extrinsicsConnection(\n      where: { timestamp_gte: $fromPrev, timestamp_lt: $fromNow }\n      orderBy: timestamp_ASC\n    ) {\n      totalCount\n    }\n  }\n": typeof types.ExtrinsicsGrowth24hDocument,
    "\n          query TokenHoldersByCollection($collectionId: String!, $limit: Int!, $offset: Int!) {\n            tokenHolders(\n              where: { token: { id_eq: $collectionId }, balance_gt: \"0\" }\n              limit: $limit\n              offset: $offset\n            ) {\n              nftId\n            }\n          }\n        ": typeof types.TokenHoldersByCollectionDocument,
    "\n  query LatestEraValidators {\n    eraValidatorInfos(orderBy: era_DESC, limit: 200) {\n      era\n      address\n      total\n    }\n  }\n": typeof types.LatestEraValidatorsDocument,
    "\n  query RewardsPage($from: DateTime!, $offset: Int!) {\n    stakings(\n      where: { type_eq: Reward, timestamp_gte: $from }\n      orderBy: [id_ASC]\n      limit: 200\n      offset: $offset\n    ) {\n      amount\n    }\n  }\n": typeof types.RewardsPageDocument,
    "\n  query LatestBlockForTps {\n    blocks(orderBy: height_DESC, limit: 1) { height timestamp }\n  }\n": typeof types.LatestBlockForTpsDocument,
    "\n  subscription ExtrinsicsFromHeight($fromHeight: Int!, $limit: Int!) {\n    extrinsics(\n      where: { block: { height_gt: $fromHeight } }\n      orderBy: [id_ASC]\n      limit: $limit\n    ) {\n      id\n      block { timestamp }\n    }\n  }\n": typeof types.ExtrinsicsFromHeightDocument,
    "\n  subscription TransfersFromHeight($fromHeight: Int!, $limit: Int!) {\n    transfers(\n      where: { blockHeight_gt: $fromHeight }\n      orderBy: [id_ASC]\n      limit: $limit\n    ) {\n      id\n      timestamp\n    }\n  }\n": typeof types.TransfersFromHeightDocument,
};
const documents: Documents = {
    "\n  query GetAccountByEvm($evmAddress: String!) {\n    accounts(where: { evmAddress_eq: $evmAddress }, limit: 1) {\n      id\n      evmAddress\n    }\n  }\n": types.GetAccountByEvmDocument,
    "\n  query GetAccountByNative($nativeAddress: String!) {\n    accounts(where: { id_eq: $nativeAddress }, limit: 1) {\n      id\n      evmAddress\n    }\n  }\n": types.GetAccountByNativeDocument,
    "\n  query TokenHoldersByAccount($accountId: String!, $first: Int!) {\n    tokenHolders: tokenHoldersConnection(\n      orderBy: balance_DESC\n      where: {\n        signer: { id_eq: $accountId }\n        AND: { token: { type_eq: ERC20 } }\n      }\n      first: $first\n    ) {\n      edges {\n        node {\n          signer { id evmAddress }\n          balance\n          token { id contractData }\n        }\n      }\n      totalCount\n    }\n  }\n": types.TokenHoldersByAccountDocument,
    "\n  query BlockByTimeBefore($ts: DateTime!) {\n    blocks(orderBy: timestamp_DESC, limit: 1, where: { timestamp_lte: $ts }) {\n      height\n      timestamp\n    }\n  }\n": types.BlockByTimeBeforeDocument,
    "\n  query BlockByTimeAfter($ts: DateTime!) {\n    blocks(orderBy: timestamp_ASC, limit: 1, where: { timestamp_gte: $ts }) {\n      height\n      timestamp\n    }\n  }\n": types.BlockByTimeAfterDocument,
    "\n  query SquidStatusQuery { \n    squidStatus { \n      height \n    } \n  }\n": types.SquidStatusQueryDocument,
    "\n  query LatestBlockQuery {\n    blocks(orderBy: height_DESC, limit: 1) {\n      height\n      timestamp\n      processorTimestamp\n    }\n  }\n": types.LatestBlockQueryDocument,
    "\n  query HealthCombinedQuery {\n    squidStatus { height }\n    blocks(orderBy: height_DESC, limit: 1) {\n      height\n      timestamp\n      processorTimestamp\n    }\n  }\n": types.HealthCombinedQueryDocument,
    "\n  query NftsByOwner($owner: String!) {\n    tokenHolders(\n      where: { \n        signer: { evmAddress_eq: $owner },\n        balance_gt: \"0\",\n        token: { type_in: [ERC721, ERC1155] }\n      }\n      limit: 300\n    ) {\n      id\n      balance\n      type\n      nftId\n      token {\n        id\n        type\n      }\n    }\n  }\n": types.NftsByOwnerDocument,
    "\n  query NftsByOwnerPaged($owner: String!, $limit: Int!, $offset: Int!) {\n    tokenHolders(\n      where: { signer: { evmAddress_eq: $owner }, balance_gt: \"0\", token: { type_in: [ERC721, ERC1155] } }\n      limit: $limit\n      offset: $offset\n    ) {\n      id\n      balance\n      nftId\n      token { id type }\n    }\n  }\n": types.NftsByOwnerPagedDocument,
    "\n  query NftsByOwnerCount($owner: String!) {\n    tokenHolders: tokenHoldersConnection(\n      where: { signer: { evmAddress_eq: $owner }, balance_gt: \"0\", token: { type_in: [ERC721, ERC1155] } }\n      orderBy: [id_DESC]\n      first: 1\n    ) {\n      totalCount\n    }\n  }\n": types.NftsByOwnerCountDocument,
    "\n  query StakingConnectionQuery($accountId: String!, $from: DateTime, $to: DateTime) {\n    stakingsConnection(\n      where: { signer: { id_eq: $accountId }, type_eq: Reward, timestamp_gte: $from, timestamp_lte: $to }\n      orderBy: [id_DESC]\n    ) {\n      totalCount\n    }\n  }\n": types.StakingConnectionQueryDocument,
    "\n  query StakingListQuery($accountId: String!, $first: Int!, $after: Int!) {\n    stakings(\n      orderBy: [id_DESC]\n      where: { signer: { id_eq: $accountId }, type_eq: Reward }\n      limit: $first\n      offset: $after\n    ) {\n      id\n      amount\n      timestamp\n      signer { id }\n      event {\n        extrinsic { hash }\n      }\n    }\n  }\n": types.StakingListQueryDocument,
    "\n  query StakingListMinQuery($accountId: String!, $first: Int!, $after: Int!, $from: DateTime, $to: DateTime) {\n    stakings(\n      orderBy: [id_DESC]\n      where: { signer: { id_eq: $accountId }, type_eq: Reward, timestamp_gte: $from, timestamp_lte: $to }\n      limit: $first\n      offset: $after\n    ) {\n      id\n      amount\n      timestamp\n    }\n  }\n": types.StakingListMinQueryDocument,
    "\n  query StakingLastTsQuery($accountId: String!) {\n    stakings(\n      orderBy: [timestamp_DESC]\n      where: { signer: { id_eq: $accountId }, type_eq: Reward }\n      limit: 1\n    ) {\n      timestamp\n    }\n  }\n": types.StakingLastTsQueryDocument,
    "\n  query VerifiedContractsByIds($ids: [String!], $first: Int!) {\n    verifiedContracts(\n      where: { id_in: $ids }\n      limit: $first\n    ) {\n      id\n      contractData\n    }\n  }\n": types.VerifiedContractsByIdsDocument,
    "\n  query ExtrinsicIdentityUnified(\n    $hash: String, $id: String, $height: Int, $index: Int,\n    $useHash: Boolean!, $useId: Boolean!, $useHeightIndex: Boolean!\n  ) {\n    byHash: extrinsics(where: { hash_eq: $hash }, limit: 1) @include(if: $useHash) { id hash }\n    byId: extrinsics(where: { id_eq: $id }, limit: 1) @include(if: $useId) { id hash }\n    byHeightIndex: extrinsics(where: { index_eq: $index, block: { height_eq: $height } }, limit: 1) @include(if: $useHeightIndex) { id hash }\n  }\n": types.ExtrinsicIdentityUnifiedDocument,
    "\n  fragment TransferCommonFields on Transfer {\n    id\n    amount\n    timestamp\n    success\n    type\n    reefswapAction\n    extrinsicHash\n    extrinsicId\n    blockHeight\n    extrinsicIndex\n    eventIndex\n    fromEvmAddress\n    toEvmAddress\n    from { id }\n    to { id }\n    token { id name }\n  }\n": types.TransferCommonFieldsFragmentDoc,
    "\n  query PaginatedTransfers($first: Int!, $after: String, $where: TransferWhereInput, $orderBy: [TransferOrderByInput!]!) {\n    transfersConnection(orderBy: $orderBy, first: $first, after: $after, where: $where) {\n      edges {\n        node {\n          ...TransferCommonFields\n          token {\n            contractData\n          }\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      totalCount\n    }\n  }\n": types.PaginatedTransfersDocument,
    "\n  query TransfersMinQuery($first: Int!, $after: String, $where: TransferWhereInput, $orderBy: [TransferOrderByInput!]!) {\n    transfersConnection(orderBy: $orderBy, first: $first, after: $after, where: $where) {\n      edges {\n        node {\n          ...TransferCommonFields\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      totalCount\n    }\n  }\n": types.TransfersMinQueryDocument,
    "\n  query TransfersCount($where: TransferWhereInput, $orderBy: [TransferOrderByInput!]!) {\n    transfersConnection(where: $where, orderBy: $orderBy, first: 1) {\n      totalCount\n    }\n  }\n": types.TransfersCountDocument,
    "\n  query TransfersBulkCounts(\n    $whereAny: TransferWhereInput\n    $whereIncoming: TransferWhereInput\n    $whereOutgoing: TransferWhereInput\n    $orderBy: [TransferOrderByInput!]!\n  ) {\n    all: transfersConnection(where: $whereAny, orderBy: $orderBy, first: 1) {\n      totalCount\n    }\n    incoming: transfersConnection(where: $whereIncoming, orderBy: $orderBy, first: 1) {\n      totalCount\n    }\n    outgoing: transfersConnection(where: $whereOutgoing, orderBy: $orderBy, first: 1) {\n      totalCount\n    }\n  }\n": types.TransfersBulkCountsDocument,
    "\n  query TransfersPollingQuery($where: TransferWhereInput, $orderBy: [TransferOrderByInput!], $offset: Int, $limit: Int) {\n    transfers(where: $where, orderBy: $orderBy, offset: $offset, limit: $limit) {\n      ...TransferCommonFields\n    }\n  }\n": types.TransfersPollingQueryDocument,
    "\n  query VerifiedContractsByName($names: [String!], $needle: String) {\n    verifiedContracts(where: { OR: [{ name_in: $names }, { name_containsInsensitive: $needle }] }) {\n      id\n      name\n    }\n  }\n": types.VerifiedContractsByNameDocument,
    "\n  query ExtrinsicsGrowth24h($fromPrev: DateTime!, $fromNow: DateTime!, $toNow: DateTime!) {\n    last24h: extrinsicsConnection(\n      where: { timestamp_gte: $fromNow, timestamp_lt: $toNow }\n      orderBy: timestamp_ASC\n    ) {\n      totalCount\n    }\n    prev24h: extrinsicsConnection(\n      where: { timestamp_gte: $fromPrev, timestamp_lt: $fromNow }\n      orderBy: timestamp_ASC\n    ) {\n      totalCount\n    }\n  }\n": types.ExtrinsicsGrowth24hDocument,
    "\n          query TokenHoldersByCollection($collectionId: String!, $limit: Int!, $offset: Int!) {\n            tokenHolders(\n              where: { token: { id_eq: $collectionId }, balance_gt: \"0\" }\n              limit: $limit\n              offset: $offset\n            ) {\n              nftId\n            }\n          }\n        ": types.TokenHoldersByCollectionDocument,
    "\n  query LatestEraValidators {\n    eraValidatorInfos(orderBy: era_DESC, limit: 200) {\n      era\n      address\n      total\n    }\n  }\n": types.LatestEraValidatorsDocument,
    "\n  query RewardsPage($from: DateTime!, $offset: Int!) {\n    stakings(\n      where: { type_eq: Reward, timestamp_gte: $from }\n      orderBy: [id_ASC]\n      limit: 200\n      offset: $offset\n    ) {\n      amount\n    }\n  }\n": types.RewardsPageDocument,
    "\n  query LatestBlockForTps {\n    blocks(orderBy: height_DESC, limit: 1) { height timestamp }\n  }\n": types.LatestBlockForTpsDocument,
    "\n  subscription ExtrinsicsFromHeight($fromHeight: Int!, $limit: Int!) {\n    extrinsics(\n      where: { block: { height_gt: $fromHeight } }\n      orderBy: [id_ASC]\n      limit: $limit\n    ) {\n      id\n      block { timestamp }\n    }\n  }\n": types.ExtrinsicsFromHeightDocument,
    "\n  subscription TransfersFromHeight($fromHeight: Int!, $limit: Int!) {\n    transfers(\n      where: { blockHeight_gt: $fromHeight }\n      orderBy: [id_ASC]\n      limit: $limit\n    ) {\n      id\n      timestamp\n    }\n  }\n": types.TransfersFromHeightDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetAccountByEvm($evmAddress: String!) {\n    accounts(where: { evmAddress_eq: $evmAddress }, limit: 1) {\n      id\n      evmAddress\n    }\n  }\n"): (typeof documents)["\n  query GetAccountByEvm($evmAddress: String!) {\n    accounts(where: { evmAddress_eq: $evmAddress }, limit: 1) {\n      id\n      evmAddress\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetAccountByNative($nativeAddress: String!) {\n    accounts(where: { id_eq: $nativeAddress }, limit: 1) {\n      id\n      evmAddress\n    }\n  }\n"): (typeof documents)["\n  query GetAccountByNative($nativeAddress: String!) {\n    accounts(where: { id_eq: $nativeAddress }, limit: 1) {\n      id\n      evmAddress\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query TokenHoldersByAccount($accountId: String!, $first: Int!) {\n    tokenHolders: tokenHoldersConnection(\n      orderBy: balance_DESC\n      where: {\n        signer: { id_eq: $accountId }\n        AND: { token: { type_eq: ERC20 } }\n      }\n      first: $first\n    ) {\n      edges {\n        node {\n          signer { id evmAddress }\n          balance\n          token { id contractData }\n        }\n      }\n      totalCount\n    }\n  }\n"): (typeof documents)["\n  query TokenHoldersByAccount($accountId: String!, $first: Int!) {\n    tokenHolders: tokenHoldersConnection(\n      orderBy: balance_DESC\n      where: {\n        signer: { id_eq: $accountId }\n        AND: { token: { type_eq: ERC20 } }\n      }\n      first: $first\n    ) {\n      edges {\n        node {\n          signer { id evmAddress }\n          balance\n          token { id contractData }\n        }\n      }\n      totalCount\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query BlockByTimeBefore($ts: DateTime!) {\n    blocks(orderBy: timestamp_DESC, limit: 1, where: { timestamp_lte: $ts }) {\n      height\n      timestamp\n    }\n  }\n"): (typeof documents)["\n  query BlockByTimeBefore($ts: DateTime!) {\n    blocks(orderBy: timestamp_DESC, limit: 1, where: { timestamp_lte: $ts }) {\n      height\n      timestamp\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query BlockByTimeAfter($ts: DateTime!) {\n    blocks(orderBy: timestamp_ASC, limit: 1, where: { timestamp_gte: $ts }) {\n      height\n      timestamp\n    }\n  }\n"): (typeof documents)["\n  query BlockByTimeAfter($ts: DateTime!) {\n    blocks(orderBy: timestamp_ASC, limit: 1, where: { timestamp_gte: $ts }) {\n      height\n      timestamp\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query SquidStatusQuery { \n    squidStatus { \n      height \n    } \n  }\n"): (typeof documents)["\n  query SquidStatusQuery { \n    squidStatus { \n      height \n    } \n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query LatestBlockQuery {\n    blocks(orderBy: height_DESC, limit: 1) {\n      height\n      timestamp\n      processorTimestamp\n    }\n  }\n"): (typeof documents)["\n  query LatestBlockQuery {\n    blocks(orderBy: height_DESC, limit: 1) {\n      height\n      timestamp\n      processorTimestamp\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query HealthCombinedQuery {\n    squidStatus { height }\n    blocks(orderBy: height_DESC, limit: 1) {\n      height\n      timestamp\n      processorTimestamp\n    }\n  }\n"): (typeof documents)["\n  query HealthCombinedQuery {\n    squidStatus { height }\n    blocks(orderBy: height_DESC, limit: 1) {\n      height\n      timestamp\n      processorTimestamp\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query NftsByOwner($owner: String!) {\n    tokenHolders(\n      where: { \n        signer: { evmAddress_eq: $owner },\n        balance_gt: \"0\",\n        token: { type_in: [ERC721, ERC1155] }\n      }\n      limit: 300\n    ) {\n      id\n      balance\n      type\n      nftId\n      token {\n        id\n        type\n      }\n    }\n  }\n"): (typeof documents)["\n  query NftsByOwner($owner: String!) {\n    tokenHolders(\n      where: { \n        signer: { evmAddress_eq: $owner },\n        balance_gt: \"0\",\n        token: { type_in: [ERC721, ERC1155] }\n      }\n      limit: 300\n    ) {\n      id\n      balance\n      type\n      nftId\n      token {\n        id\n        type\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query NftsByOwnerPaged($owner: String!, $limit: Int!, $offset: Int!) {\n    tokenHolders(\n      where: { signer: { evmAddress_eq: $owner }, balance_gt: \"0\", token: { type_in: [ERC721, ERC1155] } }\n      limit: $limit\n      offset: $offset\n    ) {\n      id\n      balance\n      nftId\n      token { id type }\n    }\n  }\n"): (typeof documents)["\n  query NftsByOwnerPaged($owner: String!, $limit: Int!, $offset: Int!) {\n    tokenHolders(\n      where: { signer: { evmAddress_eq: $owner }, balance_gt: \"0\", token: { type_in: [ERC721, ERC1155] } }\n      limit: $limit\n      offset: $offset\n    ) {\n      id\n      balance\n      nftId\n      token { id type }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query NftsByOwnerCount($owner: String!) {\n    tokenHolders: tokenHoldersConnection(\n      where: { signer: { evmAddress_eq: $owner }, balance_gt: \"0\", token: { type_in: [ERC721, ERC1155] } }\n      orderBy: [id_DESC]\n      first: 1\n    ) {\n      totalCount\n    }\n  }\n"): (typeof documents)["\n  query NftsByOwnerCount($owner: String!) {\n    tokenHolders: tokenHoldersConnection(\n      where: { signer: { evmAddress_eq: $owner }, balance_gt: \"0\", token: { type_in: [ERC721, ERC1155] } }\n      orderBy: [id_DESC]\n      first: 1\n    ) {\n      totalCount\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query StakingConnectionQuery($accountId: String!, $from: DateTime, $to: DateTime) {\n    stakingsConnection(\n      where: { signer: { id_eq: $accountId }, type_eq: Reward, timestamp_gte: $from, timestamp_lte: $to }\n      orderBy: [id_DESC]\n    ) {\n      totalCount\n    }\n  }\n"): (typeof documents)["\n  query StakingConnectionQuery($accountId: String!, $from: DateTime, $to: DateTime) {\n    stakingsConnection(\n      where: { signer: { id_eq: $accountId }, type_eq: Reward, timestamp_gte: $from, timestamp_lte: $to }\n      orderBy: [id_DESC]\n    ) {\n      totalCount\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query StakingListQuery($accountId: String!, $first: Int!, $after: Int!) {\n    stakings(\n      orderBy: [id_DESC]\n      where: { signer: { id_eq: $accountId }, type_eq: Reward }\n      limit: $first\n      offset: $after\n    ) {\n      id\n      amount\n      timestamp\n      signer { id }\n      event {\n        extrinsic { hash }\n      }\n    }\n  }\n"): (typeof documents)["\n  query StakingListQuery($accountId: String!, $first: Int!, $after: Int!) {\n    stakings(\n      orderBy: [id_DESC]\n      where: { signer: { id_eq: $accountId }, type_eq: Reward }\n      limit: $first\n      offset: $after\n    ) {\n      id\n      amount\n      timestamp\n      signer { id }\n      event {\n        extrinsic { hash }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query StakingListMinQuery($accountId: String!, $first: Int!, $after: Int!, $from: DateTime, $to: DateTime) {\n    stakings(\n      orderBy: [id_DESC]\n      where: { signer: { id_eq: $accountId }, type_eq: Reward, timestamp_gte: $from, timestamp_lte: $to }\n      limit: $first\n      offset: $after\n    ) {\n      id\n      amount\n      timestamp\n    }\n  }\n"): (typeof documents)["\n  query StakingListMinQuery($accountId: String!, $first: Int!, $after: Int!, $from: DateTime, $to: DateTime) {\n    stakings(\n      orderBy: [id_DESC]\n      where: { signer: { id_eq: $accountId }, type_eq: Reward, timestamp_gte: $from, timestamp_lte: $to }\n      limit: $first\n      offset: $after\n    ) {\n      id\n      amount\n      timestamp\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query StakingLastTsQuery($accountId: String!) {\n    stakings(\n      orderBy: [timestamp_DESC]\n      where: { signer: { id_eq: $accountId }, type_eq: Reward }\n      limit: 1\n    ) {\n      timestamp\n    }\n  }\n"): (typeof documents)["\n  query StakingLastTsQuery($accountId: String!) {\n    stakings(\n      orderBy: [timestamp_DESC]\n      where: { signer: { id_eq: $accountId }, type_eq: Reward }\n      limit: 1\n    ) {\n      timestamp\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query VerifiedContractsByIds($ids: [String!], $first: Int!) {\n    verifiedContracts(\n      where: { id_in: $ids }\n      limit: $first\n    ) {\n      id\n      contractData\n    }\n  }\n"): (typeof documents)["\n  query VerifiedContractsByIds($ids: [String!], $first: Int!) {\n    verifiedContracts(\n      where: { id_in: $ids }\n      limit: $first\n    ) {\n      id\n      contractData\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ExtrinsicIdentityUnified(\n    $hash: String, $id: String, $height: Int, $index: Int,\n    $useHash: Boolean!, $useId: Boolean!, $useHeightIndex: Boolean!\n  ) {\n    byHash: extrinsics(where: { hash_eq: $hash }, limit: 1) @include(if: $useHash) { id hash }\n    byId: extrinsics(where: { id_eq: $id }, limit: 1) @include(if: $useId) { id hash }\n    byHeightIndex: extrinsics(where: { index_eq: $index, block: { height_eq: $height } }, limit: 1) @include(if: $useHeightIndex) { id hash }\n  }\n"): (typeof documents)["\n  query ExtrinsicIdentityUnified(\n    $hash: String, $id: String, $height: Int, $index: Int,\n    $useHash: Boolean!, $useId: Boolean!, $useHeightIndex: Boolean!\n  ) {\n    byHash: extrinsics(where: { hash_eq: $hash }, limit: 1) @include(if: $useHash) { id hash }\n    byId: extrinsics(where: { id_eq: $id }, limit: 1) @include(if: $useId) { id hash }\n    byHeightIndex: extrinsics(where: { index_eq: $index, block: { height_eq: $height } }, limit: 1) @include(if: $useHeightIndex) { id hash }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment TransferCommonFields on Transfer {\n    id\n    amount\n    timestamp\n    success\n    type\n    reefswapAction\n    extrinsicHash\n    extrinsicId\n    blockHeight\n    extrinsicIndex\n    eventIndex\n    fromEvmAddress\n    toEvmAddress\n    from { id }\n    to { id }\n    token { id name }\n  }\n"): (typeof documents)["\n  fragment TransferCommonFields on Transfer {\n    id\n    amount\n    timestamp\n    success\n    type\n    reefswapAction\n    extrinsicHash\n    extrinsicId\n    blockHeight\n    extrinsicIndex\n    eventIndex\n    fromEvmAddress\n    toEvmAddress\n    from { id }\n    to { id }\n    token { id name }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PaginatedTransfers($first: Int!, $after: String, $where: TransferWhereInput, $orderBy: [TransferOrderByInput!]!) {\n    transfersConnection(orderBy: $orderBy, first: $first, after: $after, where: $where) {\n      edges {\n        node {\n          ...TransferCommonFields\n          token {\n            contractData\n          }\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      totalCount\n    }\n  }\n"): (typeof documents)["\n  query PaginatedTransfers($first: Int!, $after: String, $where: TransferWhereInput, $orderBy: [TransferOrderByInput!]!) {\n    transfersConnection(orderBy: $orderBy, first: $first, after: $after, where: $where) {\n      edges {\n        node {\n          ...TransferCommonFields\n          token {\n            contractData\n          }\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      totalCount\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query TransfersMinQuery($first: Int!, $after: String, $where: TransferWhereInput, $orderBy: [TransferOrderByInput!]!) {\n    transfersConnection(orderBy: $orderBy, first: $first, after: $after, where: $where) {\n      edges {\n        node {\n          ...TransferCommonFields\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      totalCount\n    }\n  }\n"): (typeof documents)["\n  query TransfersMinQuery($first: Int!, $after: String, $where: TransferWhereInput, $orderBy: [TransferOrderByInput!]!) {\n    transfersConnection(orderBy: $orderBy, first: $first, after: $after, where: $where) {\n      edges {\n        node {\n          ...TransferCommonFields\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      totalCount\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query TransfersCount($where: TransferWhereInput, $orderBy: [TransferOrderByInput!]!) {\n    transfersConnection(where: $where, orderBy: $orderBy, first: 1) {\n      totalCount\n    }\n  }\n"): (typeof documents)["\n  query TransfersCount($where: TransferWhereInput, $orderBy: [TransferOrderByInput!]!) {\n    transfersConnection(where: $where, orderBy: $orderBy, first: 1) {\n      totalCount\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query TransfersBulkCounts(\n    $whereAny: TransferWhereInput\n    $whereIncoming: TransferWhereInput\n    $whereOutgoing: TransferWhereInput\n    $orderBy: [TransferOrderByInput!]!\n  ) {\n    all: transfersConnection(where: $whereAny, orderBy: $orderBy, first: 1) {\n      totalCount\n    }\n    incoming: transfersConnection(where: $whereIncoming, orderBy: $orderBy, first: 1) {\n      totalCount\n    }\n    outgoing: transfersConnection(where: $whereOutgoing, orderBy: $orderBy, first: 1) {\n      totalCount\n    }\n  }\n"): (typeof documents)["\n  query TransfersBulkCounts(\n    $whereAny: TransferWhereInput\n    $whereIncoming: TransferWhereInput\n    $whereOutgoing: TransferWhereInput\n    $orderBy: [TransferOrderByInput!]!\n  ) {\n    all: transfersConnection(where: $whereAny, orderBy: $orderBy, first: 1) {\n      totalCount\n    }\n    incoming: transfersConnection(where: $whereIncoming, orderBy: $orderBy, first: 1) {\n      totalCount\n    }\n    outgoing: transfersConnection(where: $whereOutgoing, orderBy: $orderBy, first: 1) {\n      totalCount\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query TransfersPollingQuery($where: TransferWhereInput, $orderBy: [TransferOrderByInput!], $offset: Int, $limit: Int) {\n    transfers(where: $where, orderBy: $orderBy, offset: $offset, limit: $limit) {\n      ...TransferCommonFields\n    }\n  }\n"): (typeof documents)["\n  query TransfersPollingQuery($where: TransferWhereInput, $orderBy: [TransferOrderByInput!], $offset: Int, $limit: Int) {\n    transfers(where: $where, orderBy: $orderBy, offset: $offset, limit: $limit) {\n      ...TransferCommonFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query VerifiedContractsByName($names: [String!], $needle: String) {\n    verifiedContracts(where: { OR: [{ name_in: $names }, { name_containsInsensitive: $needle }] }) {\n      id\n      name\n    }\n  }\n"): (typeof documents)["\n  query VerifiedContractsByName($names: [String!], $needle: String) {\n    verifiedContracts(where: { OR: [{ name_in: $names }, { name_containsInsensitive: $needle }] }) {\n      id\n      name\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ExtrinsicsGrowth24h($fromPrev: DateTime!, $fromNow: DateTime!, $toNow: DateTime!) {\n    last24h: extrinsicsConnection(\n      where: { timestamp_gte: $fromNow, timestamp_lt: $toNow }\n      orderBy: timestamp_ASC\n    ) {\n      totalCount\n    }\n    prev24h: extrinsicsConnection(\n      where: { timestamp_gte: $fromPrev, timestamp_lt: $fromNow }\n      orderBy: timestamp_ASC\n    ) {\n      totalCount\n    }\n  }\n"): (typeof documents)["\n  query ExtrinsicsGrowth24h($fromPrev: DateTime!, $fromNow: DateTime!, $toNow: DateTime!) {\n    last24h: extrinsicsConnection(\n      where: { timestamp_gte: $fromNow, timestamp_lt: $toNow }\n      orderBy: timestamp_ASC\n    ) {\n      totalCount\n    }\n    prev24h: extrinsicsConnection(\n      where: { timestamp_gte: $fromPrev, timestamp_lt: $fromNow }\n      orderBy: timestamp_ASC\n    ) {\n      totalCount\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n          query TokenHoldersByCollection($collectionId: String!, $limit: Int!, $offset: Int!) {\n            tokenHolders(\n              where: { token: { id_eq: $collectionId }, balance_gt: \"0\" }\n              limit: $limit\n              offset: $offset\n            ) {\n              nftId\n            }\n          }\n        "): (typeof documents)["\n          query TokenHoldersByCollection($collectionId: String!, $limit: Int!, $offset: Int!) {\n            tokenHolders(\n              where: { token: { id_eq: $collectionId }, balance_gt: \"0\" }\n              limit: $limit\n              offset: $offset\n            ) {\n              nftId\n            }\n          }\n        "];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query LatestEraValidators {\n    eraValidatorInfos(orderBy: era_DESC, limit: 200) {\n      era\n      address\n      total\n    }\n  }\n"): (typeof documents)["\n  query LatestEraValidators {\n    eraValidatorInfos(orderBy: era_DESC, limit: 200) {\n      era\n      address\n      total\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query RewardsPage($from: DateTime!, $offset: Int!) {\n    stakings(\n      where: { type_eq: Reward, timestamp_gte: $from }\n      orderBy: [id_ASC]\n      limit: 200\n      offset: $offset\n    ) {\n      amount\n    }\n  }\n"): (typeof documents)["\n  query RewardsPage($from: DateTime!, $offset: Int!) {\n    stakings(\n      where: { type_eq: Reward, timestamp_gte: $from }\n      orderBy: [id_ASC]\n      limit: 200\n      offset: $offset\n    ) {\n      amount\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query LatestBlockForTps {\n    blocks(orderBy: height_DESC, limit: 1) { height timestamp }\n  }\n"): (typeof documents)["\n  query LatestBlockForTps {\n    blocks(orderBy: height_DESC, limit: 1) { height timestamp }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  subscription ExtrinsicsFromHeight($fromHeight: Int!, $limit: Int!) {\n    extrinsics(\n      where: { block: { height_gt: $fromHeight } }\n      orderBy: [id_ASC]\n      limit: $limit\n    ) {\n      id\n      block { timestamp }\n    }\n  }\n"): (typeof documents)["\n  subscription ExtrinsicsFromHeight($fromHeight: Int!, $limit: Int!) {\n    extrinsics(\n      where: { block: { height_gt: $fromHeight } }\n      orderBy: [id_ASC]\n      limit: $limit\n    ) {\n      id\n      block { timestamp }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  subscription TransfersFromHeight($fromHeight: Int!, $limit: Int!) {\n    transfers(\n      where: { blockHeight_gt: $fromHeight }\n      orderBy: [id_ASC]\n      limit: $limit\n    ) {\n      id\n      timestamp\n    }\n  }\n"): (typeof documents)["\n  subscription TransfersFromHeight($fromHeight: Int!, $limit: Int!) {\n    transfers(\n      where: { blockHeight_gt: $fromHeight }\n      orderBy: [id_ASC]\n      limit: $limit\n    ) {\n      id\n      timestamp\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;
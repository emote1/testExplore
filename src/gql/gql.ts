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
    "\n  query AccountNativeBalance($accountId: String!) {\n    accounts(where: { OR: [{ id_eq: $accountId }, { evmAddress_eq: $accountId }] }, limit: 1) {\n      id\n      freeBalance\n      availableBalance\n    }\n  }\n": typeof types.AccountNativeBalanceDocument,
    "\n  query BlockByTimeBefore($ts: DateTime!) {\n    blocks(orderBy: timestamp_DESC, limit: 1, where: { timestamp_lte: $ts }) {\n      height\n      timestamp\n    }\n  }\n": typeof types.BlockByTimeBeforeDocument,
    "\n  query BlockByTimeAfter($ts: DateTime!) {\n    blocks(orderBy: timestamp_ASC, limit: 1, where: { timestamp_gte: $ts }) {\n      height\n      timestamp\n    }\n  }\n": typeof types.BlockByTimeAfterDocument,
    "\n  query SquidStatusQuery { \n    squidStatus { \n      height \n    } \n  }\n": typeof types.SquidStatusQueryDocument,
    "\n  query LatestBlockQuery {\n    blocks(orderBy: height_DESC, limit: 1) {\n      height\n      timestamp\n      processorTimestamp\n    }\n  }\n": typeof types.LatestBlockQueryDocument,
    "\n  query HealthCombinedQuery {\n    squidStatus { height }\n    blocks(orderBy: height_DESC, limit: 1) {\n      height\n      timestamp\n      processorTimestamp\n    }\n  }\n": typeof types.HealthCombinedQueryDocument,
    "\n  query ExtrinsicsGrowth24h($fromPrev: DateTime!, $fromNow: DateTime!, $toNow: DateTime!) {\n    last24h: extrinsicsConnection(\n      where: { timestamp_gte: $fromNow, timestamp_lt: $toNow }\n      orderBy: timestamp_ASC\n    ) {\n      totalCount\n    }\n    prev24h: extrinsicsConnection(\n      where: { timestamp_gte: $fromPrev, timestamp_lt: $fromNow }\n      orderBy: timestamp_ASC\n    ) {\n      totalCount\n    }\n  }\n": typeof types.ExtrinsicsGrowth24hDocument,
    "\n          query TokenHoldersByCollection($collectionId: String!, $limit: Int!, $offset: Int!) {\n            tokenHolders(\n              where: { token: { id_eq: $collectionId }, balance_gt: \"0\" }\n              limit: $limit\n              offset: $offset\n            ) {\n              nftId\n            }\n          }\n        ": typeof types.TokenHoldersByCollectionDocument,
    "\n  query LatestEraValidators {\n    eraValidatorInfos(orderBy: era_DESC, limit: 200) {\n      era\n      address\n      total\n    }\n  }\n": typeof types.LatestEraValidatorsDocument,
    "\n  query RewardsWindow($limit: Int!, $offset: Int!) {\n    stakings(\n      where: { type_eq: Reward }\n      orderBy: [timestamp_DESC, id_DESC]\n      limit: $limit\n      offset: $offset\n    ) {\n      amount\n      timestamp\n    }\n  }\n": typeof types.RewardsWindowDocument,
    "\n  query LatestBlockForTps {\n    blocks(orderBy: height_DESC, limit: 1) { height timestamp }\n  }\n": typeof types.LatestBlockForTpsDocument,
    "\n  query RecentBlocksForTps($limit: Int!) {\n    blocks(orderBy: height_DESC, limit: $limit) { height timestamp }\n  }\n": typeof types.RecentBlocksForTpsDocument,
    "\n  subscription ExtrinsicsFromHeight($fromHeight: Int!, $limit: Int!) {\n    extrinsics(\n      where: { block: { height_gt: $fromHeight } }\n      orderBy: [id_ASC]\n      limit: $limit\n    ) {\n      id\n      block { timestamp }\n    }\n  }\n": typeof types.ExtrinsicsFromHeightDocument,
    "\n  subscription TransfersFromHeight($fromHeight: Int!, $limit: Int!) {\n    transfers(\n      where: { blockHeight_gt: $fromHeight }\n      orderBy: [id_ASC]\n      limit: $limit\n    ) {\n      id\n      timestamp\n    }\n  }\n": typeof types.TransfersFromHeightDocument,
    "\n  subscription BlocksFromHeight($fromHeight: Int!, $limit: Int!) {\n    blocks(\n      where: { height_gt: $fromHeight }\n      orderBy: [height_ASC]\n      limit: $limit\n    ) {\n      height\n      timestamp\n    }\n  }\n": typeof types.BlocksFromHeightDocument,
};
const documents: Documents = {
    "\n  query GetAccountByEvm($evmAddress: String!) {\n    accounts(where: { evmAddress_eq: $evmAddress }, limit: 1) {\n      id\n      evmAddress\n    }\n  }\n": types.GetAccountByEvmDocument,
    "\n  query GetAccountByNative($nativeAddress: String!) {\n    accounts(where: { id_eq: $nativeAddress }, limit: 1) {\n      id\n      evmAddress\n    }\n  }\n": types.GetAccountByNativeDocument,
    "\n  query TokenHoldersByAccount($accountId: String!, $first: Int!) {\n    tokenHolders: tokenHoldersConnection(\n      orderBy: balance_DESC\n      where: {\n        signer: { id_eq: $accountId }\n        AND: { token: { type_eq: ERC20 } }\n      }\n      first: $first\n    ) {\n      edges {\n        node {\n          signer { id evmAddress }\n          balance\n          token { id contractData }\n        }\n      }\n      totalCount\n    }\n  }\n": types.TokenHoldersByAccountDocument,
    "\n  query AccountNativeBalance($accountId: String!) {\n    accounts(where: { OR: [{ id_eq: $accountId }, { evmAddress_eq: $accountId }] }, limit: 1) {\n      id\n      freeBalance\n      availableBalance\n    }\n  }\n": types.AccountNativeBalanceDocument,
    "\n  query BlockByTimeBefore($ts: DateTime!) {\n    blocks(orderBy: timestamp_DESC, limit: 1, where: { timestamp_lte: $ts }) {\n      height\n      timestamp\n    }\n  }\n": types.BlockByTimeBeforeDocument,
    "\n  query BlockByTimeAfter($ts: DateTime!) {\n    blocks(orderBy: timestamp_ASC, limit: 1, where: { timestamp_gte: $ts }) {\n      height\n      timestamp\n    }\n  }\n": types.BlockByTimeAfterDocument,
    "\n  query SquidStatusQuery { \n    squidStatus { \n      height \n    } \n  }\n": types.SquidStatusQueryDocument,
    "\n  query LatestBlockQuery {\n    blocks(orderBy: height_DESC, limit: 1) {\n      height\n      timestamp\n      processorTimestamp\n    }\n  }\n": types.LatestBlockQueryDocument,
    "\n  query HealthCombinedQuery {\n    squidStatus { height }\n    blocks(orderBy: height_DESC, limit: 1) {\n      height\n      timestamp\n      processorTimestamp\n    }\n  }\n": types.HealthCombinedQueryDocument,
    "\n  query ExtrinsicsGrowth24h($fromPrev: DateTime!, $fromNow: DateTime!, $toNow: DateTime!) {\n    last24h: extrinsicsConnection(\n      where: { timestamp_gte: $fromNow, timestamp_lt: $toNow }\n      orderBy: timestamp_ASC\n    ) {\n      totalCount\n    }\n    prev24h: extrinsicsConnection(\n      where: { timestamp_gte: $fromPrev, timestamp_lt: $fromNow }\n      orderBy: timestamp_ASC\n    ) {\n      totalCount\n    }\n  }\n": types.ExtrinsicsGrowth24hDocument,
    "\n          query TokenHoldersByCollection($collectionId: String!, $limit: Int!, $offset: Int!) {\n            tokenHolders(\n              where: { token: { id_eq: $collectionId }, balance_gt: \"0\" }\n              limit: $limit\n              offset: $offset\n            ) {\n              nftId\n            }\n          }\n        ": types.TokenHoldersByCollectionDocument,
    "\n  query LatestEraValidators {\n    eraValidatorInfos(orderBy: era_DESC, limit: 200) {\n      era\n      address\n      total\n    }\n  }\n": types.LatestEraValidatorsDocument,
    "\n  query RewardsWindow($limit: Int!, $offset: Int!) {\n    stakings(\n      where: { type_eq: Reward }\n      orderBy: [timestamp_DESC, id_DESC]\n      limit: $limit\n      offset: $offset\n    ) {\n      amount\n      timestamp\n    }\n  }\n": types.RewardsWindowDocument,
    "\n  query LatestBlockForTps {\n    blocks(orderBy: height_DESC, limit: 1) { height timestamp }\n  }\n": types.LatestBlockForTpsDocument,
    "\n  query RecentBlocksForTps($limit: Int!) {\n    blocks(orderBy: height_DESC, limit: $limit) { height timestamp }\n  }\n": types.RecentBlocksForTpsDocument,
    "\n  subscription ExtrinsicsFromHeight($fromHeight: Int!, $limit: Int!) {\n    extrinsics(\n      where: { block: { height_gt: $fromHeight } }\n      orderBy: [id_ASC]\n      limit: $limit\n    ) {\n      id\n      block { timestamp }\n    }\n  }\n": types.ExtrinsicsFromHeightDocument,
    "\n  subscription TransfersFromHeight($fromHeight: Int!, $limit: Int!) {\n    transfers(\n      where: { blockHeight_gt: $fromHeight }\n      orderBy: [id_ASC]\n      limit: $limit\n    ) {\n      id\n      timestamp\n    }\n  }\n": types.TransfersFromHeightDocument,
    "\n  subscription BlocksFromHeight($fromHeight: Int!, $limit: Int!) {\n    blocks(\n      where: { height_gt: $fromHeight }\n      orderBy: [height_ASC]\n      limit: $limit\n    ) {\n      height\n      timestamp\n    }\n  }\n": types.BlocksFromHeightDocument,
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
export function graphql(source: "\n  query AccountNativeBalance($accountId: String!) {\n    accounts(where: { OR: [{ id_eq: $accountId }, { evmAddress_eq: $accountId }] }, limit: 1) {\n      id\n      freeBalance\n      availableBalance\n    }\n  }\n"): (typeof documents)["\n  query AccountNativeBalance($accountId: String!) {\n    accounts(where: { OR: [{ id_eq: $accountId }, { evmAddress_eq: $accountId }] }, limit: 1) {\n      id\n      freeBalance\n      availableBalance\n    }\n  }\n"];
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
export function graphql(source: "\n  query RewardsWindow($limit: Int!, $offset: Int!) {\n    stakings(\n      where: { type_eq: Reward }\n      orderBy: [timestamp_DESC, id_DESC]\n      limit: $limit\n      offset: $offset\n    ) {\n      amount\n      timestamp\n    }\n  }\n"): (typeof documents)["\n  query RewardsWindow($limit: Int!, $offset: Int!) {\n    stakings(\n      where: { type_eq: Reward }\n      orderBy: [timestamp_DESC, id_DESC]\n      limit: $limit\n      offset: $offset\n    ) {\n      amount\n      timestamp\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query LatestBlockForTps {\n    blocks(orderBy: height_DESC, limit: 1) { height timestamp }\n  }\n"): (typeof documents)["\n  query LatestBlockForTps {\n    blocks(orderBy: height_DESC, limit: 1) { height timestamp }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query RecentBlocksForTps($limit: Int!) {\n    blocks(orderBy: height_DESC, limit: $limit) { height timestamp }\n  }\n"): (typeof documents)["\n  query RecentBlocksForTps($limit: Int!) {\n    blocks(orderBy: height_DESC, limit: $limit) { height timestamp }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  subscription ExtrinsicsFromHeight($fromHeight: Int!, $limit: Int!) {\n    extrinsics(\n      where: { block: { height_gt: $fromHeight } }\n      orderBy: [id_ASC]\n      limit: $limit\n    ) {\n      id\n      block { timestamp }\n    }\n  }\n"): (typeof documents)["\n  subscription ExtrinsicsFromHeight($fromHeight: Int!, $limit: Int!) {\n    extrinsics(\n      where: { block: { height_gt: $fromHeight } }\n      orderBy: [id_ASC]\n      limit: $limit\n    ) {\n      id\n      block { timestamp }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  subscription TransfersFromHeight($fromHeight: Int!, $limit: Int!) {\n    transfers(\n      where: { blockHeight_gt: $fromHeight }\n      orderBy: [id_ASC]\n      limit: $limit\n    ) {\n      id\n      timestamp\n    }\n  }\n"): (typeof documents)["\n  subscription TransfersFromHeight($fromHeight: Int!, $limit: Int!) {\n    transfers(\n      where: { blockHeight_gt: $fromHeight }\n      orderBy: [id_ASC]\n      limit: $limit\n    ) {\n      id\n      timestamp\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  subscription BlocksFromHeight($fromHeight: Int!, $limit: Int!) {\n    blocks(\n      where: { height_gt: $fromHeight }\n      orderBy: [height_ASC]\n      limit: $limit\n    ) {\n      height\n      timestamp\n    }\n  }\n"): (typeof documents)["\n  subscription BlocksFromHeight($fromHeight: Int!, $limit: Int!) {\n    blocks(\n      where: { height_gt: $fromHeight }\n      orderBy: [height_ASC]\n      limit: $limit\n    ) {\n      height\n      timestamp\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;
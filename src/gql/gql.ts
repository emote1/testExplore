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
    "\n  query NftsByOwner($owner: String!) {\n    tokenHolders(\n      where: { \n        signer: { evmAddress_eq: $owner },\n        balance_gt: \"0\",\n        token: { type_in: [ERC721, ERC1155] }\n      }\n      limit: 300\n    ) {\n      id\n      balance\n      type\n      nftId\n      token {\n        id\n        type\n      }\n    }\n  }\n": typeof types.NftsByOwnerDocument,
    "\n  query NftsByOwnerPaged($owner: String!, $limit: Int!, $offset: Int!) {\n    tokenHolders(\n      where: { signer: { evmAddress_eq: $owner }, balance_gt: \"0\", token: { type_in: [ERC721, ERC1155] } }\n      limit: $limit\n      offset: $offset\n    ) {\n      id\n      balance\n      nftId\n      token { id type }\n    }\n  }\n": typeof types.NftsByOwnerPagedDocument,
    "\n  query ExtrinsicFeeQuery($extrinsicHash: String!) {\n    extrinsics(where: { hash_eq: $extrinsicHash }, limit: 1) {\n      events(where: {section_eq: \"transactionpayment\", method_eq: \"TransactionFeePaid\"}, limit: 1) {\n        data\n      }\n    }\n  }\n": typeof types.ExtrinsicFeeQueryDocument,
    "\n  query BulkExtrinsicsFeesQuery($hashes: [String!]!) {\n    extrinsics(where: { hash_in: $hashes }) {\n      hash\n      events(where: { section_eq: \"transactionpayment\", method_eq: \"TransactionFeePaid\" }) {\n        data\n      }\n    }\n  }\n": typeof types.BulkExtrinsicsFeesQueryDocument,
    "\n  query TransfersFeeQuery($first: Int!, $after: String, $where: TransferWhereInput, $orderBy: [TransferOrderByInput!]!) {\n    transfersConnection(orderBy: $orderBy, first: $first, after: $after, where: $where) {\n      edges {\n        node {\n          id\n          amount\n          timestamp\n          success\n          type\n          signedData\n          extrinsicHash\n          from {\n            id\n          }\n          to {\n            id\n          }\n          token {\n            id\n            name\n            contractData\n          }\n\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": typeof types.TransfersFeeQueryDocument,
    "\n  query NftTokenIdQuery($ids: [String!]) {\n    extrinsics(where: { id_in: $ids }) {\n      id\n      hash\n      events(where: { section_eq: \"uniques\", method_eq: \"Transferred\" }) {\n        id\n        section\n        method\n        data\n      }\n    }\n  }\n": typeof types.NftTokenIdQueryDocument,
    "\n  query TransfersPollingQuery($where: TransferWhereInput, $orderBy: [TransferOrderByInput!], $offset: Int, $limit: Int) {\n    transfers(where: $where, orderBy: $orderBy, offset: $offset, limit: $limit) {\n      id\n      amount\n      timestamp\n      success\n      type\n      signedData\n      extrinsicHash\n      from {\n        id\n      }\n      to {\n        id\n      }\n      token {\n        id\n        name\n      }\n    }\n  }\n": typeof types.TransfersPollingQueryDocument,
    "\n          query TokenHoldersByCollection($collectionId: String!, $limit: Int!, $offset: Int!) {\n            tokenHolders(\n              where: { token: { id_eq: $collectionId }, balance_gt: \"0\" }\n              limit: $limit\n              offset: $offset\n            ) {\n              nftId\n            }\n          }\n        ": typeof types.TokenHoldersByCollectionDocument,
};
const documents: Documents = {
    "\n  query GetAccountByEvm($evmAddress: String!) {\n    accounts(where: { evmAddress_eq: $evmAddress }, limit: 1) {\n      id\n      evmAddress\n    }\n  }\n": types.GetAccountByEvmDocument,
    "\n  query GetAccountByNative($nativeAddress: String!) {\n    accounts(where: { id_eq: $nativeAddress }, limit: 1) {\n      id\n      evmAddress\n    }\n  }\n": types.GetAccountByNativeDocument,
    "\n  query NftsByOwner($owner: String!) {\n    tokenHolders(\n      where: { \n        signer: { evmAddress_eq: $owner },\n        balance_gt: \"0\",\n        token: { type_in: [ERC721, ERC1155] }\n      }\n      limit: 300\n    ) {\n      id\n      balance\n      type\n      nftId\n      token {\n        id\n        type\n      }\n    }\n  }\n": types.NftsByOwnerDocument,
    "\n  query NftsByOwnerPaged($owner: String!, $limit: Int!, $offset: Int!) {\n    tokenHolders(\n      where: { signer: { evmAddress_eq: $owner }, balance_gt: \"0\", token: { type_in: [ERC721, ERC1155] } }\n      limit: $limit\n      offset: $offset\n    ) {\n      id\n      balance\n      nftId\n      token { id type }\n    }\n  }\n": types.NftsByOwnerPagedDocument,
    "\n  query ExtrinsicFeeQuery($extrinsicHash: String!) {\n    extrinsics(where: { hash_eq: $extrinsicHash }, limit: 1) {\n      events(where: {section_eq: \"transactionpayment\", method_eq: \"TransactionFeePaid\"}, limit: 1) {\n        data\n      }\n    }\n  }\n": types.ExtrinsicFeeQueryDocument,
    "\n  query BulkExtrinsicsFeesQuery($hashes: [String!]!) {\n    extrinsics(where: { hash_in: $hashes }) {\n      hash\n      events(where: { section_eq: \"transactionpayment\", method_eq: \"TransactionFeePaid\" }) {\n        data\n      }\n    }\n  }\n": types.BulkExtrinsicsFeesQueryDocument,
    "\n  query TransfersFeeQuery($first: Int!, $after: String, $where: TransferWhereInput, $orderBy: [TransferOrderByInput!]!) {\n    transfersConnection(orderBy: $orderBy, first: $first, after: $after, where: $where) {\n      edges {\n        node {\n          id\n          amount\n          timestamp\n          success\n          type\n          signedData\n          extrinsicHash\n          from {\n            id\n          }\n          to {\n            id\n          }\n          token {\n            id\n            name\n            contractData\n          }\n\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": types.TransfersFeeQueryDocument,
    "\n  query NftTokenIdQuery($ids: [String!]) {\n    extrinsics(where: { id_in: $ids }) {\n      id\n      hash\n      events(where: { section_eq: \"uniques\", method_eq: \"Transferred\" }) {\n        id\n        section\n        method\n        data\n      }\n    }\n  }\n": types.NftTokenIdQueryDocument,
    "\n  query TransfersPollingQuery($where: TransferWhereInput, $orderBy: [TransferOrderByInput!], $offset: Int, $limit: Int) {\n    transfers(where: $where, orderBy: $orderBy, offset: $offset, limit: $limit) {\n      id\n      amount\n      timestamp\n      success\n      type\n      signedData\n      extrinsicHash\n      from {\n        id\n      }\n      to {\n        id\n      }\n      token {\n        id\n        name\n      }\n    }\n  }\n": types.TransfersPollingQueryDocument,
    "\n          query TokenHoldersByCollection($collectionId: String!, $limit: Int!, $offset: Int!) {\n            tokenHolders(\n              where: { token: { id_eq: $collectionId }, balance_gt: \"0\" }\n              limit: $limit\n              offset: $offset\n            ) {\n              nftId\n            }\n          }\n        ": types.TokenHoldersByCollectionDocument,
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
export function graphql(source: "\n  query NftsByOwner($owner: String!) {\n    tokenHolders(\n      where: { \n        signer: { evmAddress_eq: $owner },\n        balance_gt: \"0\",\n        token: { type_in: [ERC721, ERC1155] }\n      }\n      limit: 300\n    ) {\n      id\n      balance\n      type\n      nftId\n      token {\n        id\n        type\n      }\n    }\n  }\n"): (typeof documents)["\n  query NftsByOwner($owner: String!) {\n    tokenHolders(\n      where: { \n        signer: { evmAddress_eq: $owner },\n        balance_gt: \"0\",\n        token: { type_in: [ERC721, ERC1155] }\n      }\n      limit: 300\n    ) {\n      id\n      balance\n      type\n      nftId\n      token {\n        id\n        type\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query NftsByOwnerPaged($owner: String!, $limit: Int!, $offset: Int!) {\n    tokenHolders(\n      where: { signer: { evmAddress_eq: $owner }, balance_gt: \"0\", token: { type_in: [ERC721, ERC1155] } }\n      limit: $limit\n      offset: $offset\n    ) {\n      id\n      balance\n      nftId\n      token { id type }\n    }\n  }\n"): (typeof documents)["\n  query NftsByOwnerPaged($owner: String!, $limit: Int!, $offset: Int!) {\n    tokenHolders(\n      where: { signer: { evmAddress_eq: $owner }, balance_gt: \"0\", token: { type_in: [ERC721, ERC1155] } }\n      limit: $limit\n      offset: $offset\n    ) {\n      id\n      balance\n      nftId\n      token { id type }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ExtrinsicFeeQuery($extrinsicHash: String!) {\n    extrinsics(where: { hash_eq: $extrinsicHash }, limit: 1) {\n      events(where: {section_eq: \"transactionpayment\", method_eq: \"TransactionFeePaid\"}, limit: 1) {\n        data\n      }\n    }\n  }\n"): (typeof documents)["\n  query ExtrinsicFeeQuery($extrinsicHash: String!) {\n    extrinsics(where: { hash_eq: $extrinsicHash }, limit: 1) {\n      events(where: {section_eq: \"transactionpayment\", method_eq: \"TransactionFeePaid\"}, limit: 1) {\n        data\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query BulkExtrinsicsFeesQuery($hashes: [String!]!) {\n    extrinsics(where: { hash_in: $hashes }) {\n      hash\n      events(where: { section_eq: \"transactionpayment\", method_eq: \"TransactionFeePaid\" }) {\n        data\n      }\n    }\n  }\n"): (typeof documents)["\n  query BulkExtrinsicsFeesQuery($hashes: [String!]!) {\n    extrinsics(where: { hash_in: $hashes }) {\n      hash\n      events(where: { section_eq: \"transactionpayment\", method_eq: \"TransactionFeePaid\" }) {\n        data\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query TransfersFeeQuery($first: Int!, $after: String, $where: TransferWhereInput, $orderBy: [TransferOrderByInput!]!) {\n    transfersConnection(orderBy: $orderBy, first: $first, after: $after, where: $where) {\n      edges {\n        node {\n          id\n          amount\n          timestamp\n          success\n          type\n          signedData\n          extrinsicHash\n          from {\n            id\n          }\n          to {\n            id\n          }\n          token {\n            id\n            name\n            contractData\n          }\n\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n"): (typeof documents)["\n  query TransfersFeeQuery($first: Int!, $after: String, $where: TransferWhereInput, $orderBy: [TransferOrderByInput!]!) {\n    transfersConnection(orderBy: $orderBy, first: $first, after: $after, where: $where) {\n      edges {\n        node {\n          id\n          amount\n          timestamp\n          success\n          type\n          signedData\n          extrinsicHash\n          from {\n            id\n          }\n          to {\n            id\n          }\n          token {\n            id\n            name\n            contractData\n          }\n\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query NftTokenIdQuery($ids: [String!]) {\n    extrinsics(where: { id_in: $ids }) {\n      id\n      hash\n      events(where: { section_eq: \"uniques\", method_eq: \"Transferred\" }) {\n        id\n        section\n        method\n        data\n      }\n    }\n  }\n"): (typeof documents)["\n  query NftTokenIdQuery($ids: [String!]) {\n    extrinsics(where: { id_in: $ids }) {\n      id\n      hash\n      events(where: { section_eq: \"uniques\", method_eq: \"Transferred\" }) {\n        id\n        section\n        method\n        data\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query TransfersPollingQuery($where: TransferWhereInput, $orderBy: [TransferOrderByInput!], $offset: Int, $limit: Int) {\n    transfers(where: $where, orderBy: $orderBy, offset: $offset, limit: $limit) {\n      id\n      amount\n      timestamp\n      success\n      type\n      signedData\n      extrinsicHash\n      from {\n        id\n      }\n      to {\n        id\n      }\n      token {\n        id\n        name\n      }\n    }\n  }\n"): (typeof documents)["\n  query TransfersPollingQuery($where: TransferWhereInput, $orderBy: [TransferOrderByInput!], $offset: Int, $limit: Int) {\n    transfers(where: $where, orderBy: $orderBy, offset: $offset, limit: $limit) {\n      id\n      amount\n      timestamp\n      success\n      type\n      signedData\n      extrinsicHash\n      from {\n        id\n      }\n      to {\n        id\n      }\n      token {\n        id\n        name\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n          query TokenHoldersByCollection($collectionId: String!, $limit: Int!, $offset: Int!) {\n            tokenHolders(\n              where: { token: { id_eq: $collectionId }, balance_gt: \"0\" }\n              limit: $limit\n              offset: $offset\n            ) {\n              nftId\n            }\n          }\n        "): (typeof documents)["\n          query TokenHoldersByCollection($collectionId: String!, $limit: Int!, $offset: Int!) {\n            tokenHolders(\n              where: { token: { id_eq: $collectionId }, balance_gt: \"0\" }\n              limit: $limit\n              offset: $offset\n            ) {\n              nftId\n            }\n          }\n        "];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;
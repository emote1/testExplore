import { graphql } from '@/gql';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { type ApolloClient, type NormalizedCacheObject } from '@apollo/client';
import { parse } from 'graphql';
import { buildTransferOrderBy, isHasuraExplorerMode } from '@/utils/transfer-query';

// Identity resolution: get extrinsic id/hash by any of the identifiers (hash, id, or height+index)
const EXTRINSIC_IDENTITY_UNIFIED_SUBSQUID_QUERY = graphql(`
  query ExtrinsicIdentityUnified(
    $hash: String, $id: String, $height: Int, $index: Int,
    $useHash: Boolean!, $useId: Boolean!, $useHeightIndex: Boolean!
  ) {
    byHash: extrinsics(where: { hash_eq: $hash }, limit: 1) @include(if: $useHash) { id hash }
    byId: extrinsics(where: { id_eq: $id }, limit: 1) @include(if: $useId) { id hash }
    byHeightIndex: extrinsics(where: { index_eq: $index, block: { height_eq: $height } }, limit: 1) @include(if: $useHeightIndex) { id hash }
  }
`);

const EXTRINSIC_IDENTITY_UNIFIED_HASURA_QUERY = parse(`
  query ExtrinsicIdentityUnifiedHasura(
    $hash: String,
    $id: String,
    $height: Int,
    $index: Int,
    $useHash: Boolean!,
    $useId: Boolean!,
    $useHeightIndex: Boolean!
  ) {
    byHash: transfer(where: { extrinsic_hash: { _eq: $hash } }, limit: 1) @include(if: $useHash) {
      id: extrinsic_id
      hash: extrinsic_hash
    }
    byId: transfer(where: { extrinsic_id: { _eq: $id } }, limit: 1) @include(if: $useId) {
      id: extrinsic_id
      hash: extrinsic_hash
    }
    byHeightIndex: transfer(where: { block_height: { _eq: $height }, extrinsic_index: { _eq: $index } }, limit: 1) @include(if: $useHeightIndex) {
      id: extrinsic_id
      hash: extrinsic_hash
    }
  }
`);

export const EXTRINSIC_IDENTITY_UNIFIED_QUERY = isHasuraExplorerMode
  ? EXTRINSIC_IDENTITY_UNIFIED_HASURA_QUERY
  : EXTRINSIC_IDENTITY_UNIFIED_SUBSQUID_QUERY;

export async function fetchExtrinsicIdentityOnce(
  client: ApolloClient<NormalizedCacheObject>,
  params: { hash?: string | null; extrinsicId?: string | null; height?: number | null; index?: number | null },
): Promise<{ id?: string; hash?: string } | null> {
  const hash = (params.hash || '').trim();
  const id = (params.extrinsicId || '').trim();
  const h = Number(params.height);
  const i = Number(params.index);
  const useHash = !!hash;
  const useId = !!id;
  const useHeightIndex = Number.isFinite(h) && Number.isFinite(i);
  if (!useHash && !useId && !useHeightIndex) return null;
  try {
    const { data } = await client.query({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query: EXTRINSIC_IDENTITY_UNIFIED_QUERY as unknown as TypedDocumentNode<any, any>,
      variables: { hash, id, height: useHeightIndex ? h : undefined, index: useHeightIndex ? i : undefined, useHash, useId, useHeightIndex },
      fetchPolicy: 'network-only',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = ((data as any)?.byHash ?? [])[0]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      || ((data as any)?.byId ?? [])[0]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      || ((data as any)?.byHeightIndex ?? [])[0];
    if (!node) return null;
    return { id: node?.id, hash: node?.hash };
  } catch {
    return null;
  }
}

// --- Reusable fragments for transfers ---
const TRANSFER_COMMON_FIELDS_SUBSQUID = graphql(`
  fragment TransferCommonFields on Transfer {
    id
    amount
    timestamp
    success
    type
    reefswapAction
    extrinsicHash
    extrinsicId
    blockHeight
    extrinsicIndex
    eventIndex
    fromEvmAddress
    toEvmAddress
    from { id }
    to { id }
    token { id name }
  }
`);

const HASURA_TRANSFER_COMMON_FIELDS = `
  id
  amount
  timestamp
  success
  type
  reefswapAction: reefswap_action
  extrinsicHash: extrinsic_hash
  extrinsicId: extrinsic_id
  blockHeight: block_height
  extrinsicIndex: extrinsic_index
  eventIndex: event_index
  fromEvmAddress: from_evm_address
  toEvmAddress: to_evm_address
  fromId: from_id
  toId: to_id
  verified_contract { id name contractData: contract_data }
`;

export const TRANSFER_COMMON_FIELDS = TRANSFER_COMMON_FIELDS_SUBSQUID;

const PAGINATED_TRANSFERS_SUBSQUID_QUERY = graphql(`
  query PaginatedTransfers($first: Int!, $after: String, $where: TransferWhereInput, $orderBy: [TransferOrderByInput!]!) {
    transfersConnection(orderBy: $orderBy, first: $first, after: $after, where: $where) {
      edges {
        node {
          ...TransferCommonFields
          token {
            contractData
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
`);

const PAGINATED_TRANSFERS_HASURA_QUERY = parse(`
  query PaginatedTransfersHasura($limit: Int!, $offset: Int!, $where: transfer_bool_exp, $orderBy: [transfer_order_by!]) {
    transfers: transfer(where: $where, order_by: $orderBy, limit: $limit, offset: $offset) {
      ${HASURA_TRANSFER_COMMON_FIELDS}
    }
    transfersAggregate: transfer_aggregate(where: $where) {
      aggregate {
        count
      }
    }
  }
`);

// Minimal variant without token.contractData for lighter payload when token filter is fixed
const PAGINATED_TRANSFERS_MIN_SUBSQUID_QUERY = graphql(`
  query TransfersMinQuery($first: Int!, $after: String, $where: TransferWhereInput, $orderBy: [TransferOrderByInput!]!) {
    transfersConnection(orderBy: $orderBy, first: $first, after: $after, where: $where) {
      edges {
        node {
          ...TransferCommonFields
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`);

const PAGINATED_TRANSFERS_MIN_HASURA_QUERY = parse(`
  query TransfersMinQueryHasura($limit: Int!, $offset: Int!, $where: transfer_bool_exp, $orderBy: [transfer_order_by!]) {
    transfers: transfer(where: $where, order_by: $orderBy, limit: $limit, offset: $offset) {
      ${HASURA_TRANSFER_COMMON_FIELDS}
    }
    transfersAggregate: transfer_aggregate(where: $where) {
      aggregate {
        count
      }
    }
  }
`);

const TRANSFERS_COUNT_SUBSQUID_QUERY = graphql(`
  query TransfersCount($where: TransferWhereInput, $orderBy: [TransferOrderByInput!]!) {
    transfersConnection(where: $where, orderBy: $orderBy, first: 1) {
      totalCount
    }
  }
`);

const TRANSFERS_COUNT_HASURA_QUERY = parse(`
  query TransfersCountHasura($where: transfer_bool_exp) {
    transfersAggregate: transfer_aggregate(where: $where) {
      aggregate {
        count
      }
    }
  }
`);

const TRANSFERS_BULK_COUNTS_SUBSQUID_QUERY = graphql(`
  query TransfersBulkCounts(
    $whereAny: TransferWhereInput
    $whereIncoming: TransferWhereInput
    $whereOutgoing: TransferWhereInput
    $orderBy: [TransferOrderByInput!]!
  ) {
    all: transfersConnection(where: $whereAny, orderBy: $orderBy, first: 1) {
      totalCount
    }
    incoming: transfersConnection(where: $whereIncoming, orderBy: $orderBy, first: 1) {
      totalCount
    }
    outgoing: transfersConnection(where: $whereOutgoing, orderBy: $orderBy, first: 1) {
      totalCount
    }
  }
`);

const TRANSFERS_BULK_COUNTS_HASURA_QUERY = parse(`
  query TransfersBulkCountsHasura(
    $whereAny: transfer_bool_exp
    $whereIncoming: transfer_bool_exp
    $whereOutgoing: transfer_bool_exp
  ) {
    all: transfer_aggregate(where: $whereAny) {
      aggregate {
        count
      }
    }
    incoming: transfer_aggregate(where: $whereIncoming) {
      aggregate {
        count
      }
    }
    outgoing: transfer_aggregate(where: $whereOutgoing) {
      aggregate {
        count
      }
    }
}
`);

// (removed) NFT_TOKEN_ID_QUERY — unused


// Polling query for new transfers (used by subscription hook)
const TRANSFERS_POLLING_SUBSQUID_QUERY = graphql(`
  query TransfersPollingQuery($where: TransferWhereInput, $orderBy: [TransferOrderByInput!], $offset: Int, $limit: Int) {
    transfers(where: $where, orderBy: $orderBy, offset: $offset, limit: $limit) {
      ...TransferCommonFields
    }
  }
`);

const TRANSFERS_POLLING_HASURA_QUERY = parse(`
  query TransfersPollingQueryHasura($where: transfer_bool_exp, $orderBy: [transfer_order_by!], $offset: Int, $limit: Int) {
    transfers: transfer(where: $where, order_by: $orderBy, offset: $offset, limit: $limit) {
      ${HASURA_TRANSFER_COMMON_FIELDS}
    }
  }
`);

export const PAGINATED_TRANSFERS_QUERY = isHasuraExplorerMode
  ? PAGINATED_TRANSFERS_HASURA_QUERY
  : PAGINATED_TRANSFERS_SUBSQUID_QUERY;

export const PAGINATED_TRANSFERS_MIN_QUERY = isHasuraExplorerMode
  ? PAGINATED_TRANSFERS_MIN_HASURA_QUERY
  : PAGINATED_TRANSFERS_MIN_SUBSQUID_QUERY;

export const TRANSFERS_COUNT_QUERY = isHasuraExplorerMode
  ? TRANSFERS_COUNT_HASURA_QUERY
  : TRANSFERS_COUNT_SUBSQUID_QUERY;

export const TRANSFERS_BULK_COUNTS_QUERY = isHasuraExplorerMode
  ? TRANSFERS_BULK_COUNTS_HASURA_QUERY
  : TRANSFERS_BULK_COUNTS_SUBSQUID_QUERY;

export const TRANSFERS_POLLING_QUERY = isHasuraExplorerMode
  ? TRANSFERS_POLLING_HASURA_QUERY
  : TRANSFERS_POLLING_SUBSQUID_QUERY;

/** Resolve transfer indices and extrinsic id/hash by any identifier. */
export async function fetchAnyTransferIndicesOnce(
  client: ApolloClient<NormalizedCacheObject>,
  params: { hash?: string | null; extrinsicId?: string | null; height?: number | null; index?: number | null },
): Promise<{
  blockHeight?: number;
  extrinsicIndex?: number;
  eventIndex?: number;
  extrinsicId?: string;
  extrinsicHash?: string;
} | null> {
  const hash = (params.hash || '').trim();
  const id = (params.extrinsicId || '').trim();
  const h = Number(params.height);
  const i = Number(params.index);
  const where: Record<string, unknown> = {};
  if (hash) {
    if (isHasuraExplorerMode) {
      where.extrinsic_hash = { _eq: hash };
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (where as any).extrinsicHash_eq = hash;
    }
  } else if (Number.isFinite(h) && Number.isFinite(i)) {
    if (isHasuraExplorerMode) {
      where.block_height = { _eq: h };
      where.extrinsic_index = { _eq: i };
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (where as any).blockHeight_eq = h;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (where as any).extrinsicIndex_eq = i;
    }
  } else if (id) {
    if (isHasuraExplorerMode) {
      where.extrinsic_id = { _eq: id };
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (where as any).extrinsicId_eq = id;
    }
    const m = /^0*(\d+)-0*(\d+)/.exec(id);
    if (m) {
      if (isHasuraExplorerMode) {
        where.block_height = { _eq: Number(m[1]) };
        where.extrinsic_index = { _eq: Number(m[2]) };
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (where as any).blockHeight_eq = Number(m[1]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (where as any).extrinsicIndex_eq = Number(m[2]);
      }
    }
  } else {
    return null;
  }
  try {
    const { data } = await (client as ApolloClient<NormalizedCacheObject>).query({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query: TRANSFERS_POLLING_QUERY as unknown as TypedDocumentNode<any, any>,
      variables: { where, orderBy: buildTransferOrderBy(), limit: 50 },
      fetchPolicy: 'network-only',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arr = ((data as any)?.transfers ?? []) as Array<any>;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const first = arr[0];
    const minEvent = arr
      .map((x) => Number((x?.eventIndex ?? x?.event_index)))
      .filter((n) => Number.isFinite(n))
      .reduce<number | undefined>((min, n) => (min == null ? n : Math.min(min, n)), undefined);
    return {
      blockHeight: Number.isFinite(Number(first?.blockHeight ?? first?.block_height)) ? Number(first?.blockHeight ?? first?.block_height) : undefined,
      extrinsicIndex: Number.isFinite(Number(first?.extrinsicIndex ?? first?.extrinsic_index)) ? Number(first?.extrinsicIndex ?? first?.extrinsic_index) : undefined,
      eventIndex: minEvent,
      extrinsicId: typeof (first?.extrinsicId ?? first?.extrinsic_id) === 'string' ? (first?.extrinsicId ?? first?.extrinsic_id) : undefined,
      extrinsicHash: typeof (first?.extrinsicHash ?? first?.extrinsic_hash) === 'string' ? (first?.extrinsicHash ?? first?.extrinsic_hash) : undefined,
    };
  } catch {
    return null;
  }
}

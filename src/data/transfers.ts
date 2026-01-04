import { graphql } from '@/gql';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import type { ApolloClient, NormalizedCacheObject } from '@apollo/client';

// Identity resolution: get extrinsic id/hash by any of the identifiers (hash, id, or height+index)
export const EXTRINSIC_IDENTITY_UNIFIED_QUERY = graphql(`
  query ExtrinsicIdentityUnified(
    $hash: String, $id: String, $height: Int, $index: Int,
    $useHash: Boolean!, $useId: Boolean!, $useHeightIndex: Boolean!
  ) {
    byHash: extrinsics(where: { hash_eq: $hash }, limit: 1) @include(if: $useHash) { id hash }
    byId: extrinsics(where: { id_eq: $id }, limit: 1) @include(if: $useId) { id hash }
    byHeightIndex: extrinsics(where: { index_eq: $index, block: { height_eq: $height } }, limit: 1) @include(if: $useHeightIndex) { id hash }
  }
`);

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
export const TRANSFER_COMMON_FIELDS = graphql(`
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

export const PAGINATED_TRANSFERS_QUERY = graphql(`
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

// Minimal variant without token.contractData for lighter payload when token filter is fixed
export const PAGINATED_TRANSFERS_MIN_QUERY = graphql(`
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

export const TRANSFERS_COUNT_QUERY = graphql(`
  query TransfersCount($where: TransferWhereInput, $orderBy: [TransferOrderByInput!]!) {
    transfersConnection(where: $where, orderBy: $orderBy, first: 1) {
      totalCount
    }
  }
`);

export const TRANSFERS_BULK_COUNTS_QUERY = graphql(`
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

// (removed) NFT_TOKEN_ID_QUERY — unused


// Polling query for new transfers (used by subscription hook)
export const TRANSFERS_POLLING_QUERY = graphql(`
  query TransfersPollingQuery($where: TransferWhereInput, $orderBy: [TransferOrderByInput!], $offset: Int, $limit: Int) {
    transfers(where: $where, orderBy: $orderBy, offset: $offset, limit: $limit) {
      ...TransferCommonFields
    }
  }
`);

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (where as any).extrinsicHash_eq = hash;
  } else if (Number.isFinite(h) && Number.isFinite(i)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (where as any).blockHeight_eq = h;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (where as any).extrinsicIndex_eq = i;
  } else if (id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (where as any).extrinsicId_eq = id;
    const m = /^0*(\d+)-0*(\d+)/.exec(id);
    if (m) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (where as any).blockHeight_eq = Number(m[1]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (where as any).extrinsicIndex_eq = Number(m[2]);
    }
  } else {
    return null;
  }
  try {
    const { data } = await (client as ApolloClient<NormalizedCacheObject>).query({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query: TRANSFERS_POLLING_QUERY as unknown as TypedDocumentNode<any, any>,
      variables: { where, limit: 50 },
      fetchPolicy: 'network-only',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arr = ((data as any)?.transfers ?? []) as Array<any>;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const first = arr[0];
    const minEvent = arr
      .map((x) => Number((x?.eventIndex)))
      .filter((n) => Number.isFinite(n))
      .reduce<number | undefined>((min, n) => (min == null ? n : Math.min(min, n)), undefined);
    return {
      blockHeight: Number.isFinite(Number(first?.blockHeight)) ? Number(first.blockHeight) : undefined,
      extrinsicIndex: Number.isFinite(Number(first?.extrinsicIndex)) ? Number(first.extrinsicIndex) : undefined,
      eventIndex: minEvent,
      extrinsicId: typeof first?.extrinsicId === 'string' ? first.extrinsicId : undefined,
      extrinsicHash: typeof first?.extrinsicHash === 'string' ? first.extrinsicHash : undefined,
    };
  } catch {
    return null;
  }
}

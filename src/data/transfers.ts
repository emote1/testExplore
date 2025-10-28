import { graphql } from '@/gql';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import type { ApolloClient, NormalizedCacheObject } from '@apollo/client';
import { sumFeesFromEvents } from '@/utils/fees';

// Deprecated extrinsicId helpers removed

// (removed) Standalone fee/signedData/event queries — unified query used instead

// (removed) EXTRINSIC_FEE_AND_SIGNED_BY_* queries — replaced by unified query below

// Unified variant: include only one branch per call via @include flags
export const EXTRINSIC_FEE_AND_SIGNED_UNIFIED_QUERY = graphql(`
  query ExtrinsicFeeAndSignedUnified(
    $hash: String, $id: String, $height: Int, $index: Int,
    $useHash: Boolean!, $useId: Boolean!, $useHeightIndex: Boolean!
  ) {
    byHash: extrinsics(where: { hash_eq: $hash }, limit: 1) @include(if: $useHash) {
      signedData
      events(where: { section_eq: "transactionpayment", method_eq: "TransactionFeePaid" }, limit: 3) { section method data }
    }
    byId: extrinsics(where: { id_eq: $id }, limit: 1) @include(if: $useId) {
      signedData
      events(where: { section_eq: "transactionpayment", method_eq: "TransactionFeePaid" }, limit: 3) { section method data }
    }
    byHeightIndex: extrinsics(where: { index_eq: $index, block: { height_eq: $height } }, limit: 1) @include(if: $useHeightIndex) {
      signedData
      events(where: { section_eq: "transactionpayment", method_eq: "TransactionFeePaid" }, limit: 3) { section method data }
    }
  }
`);

// Minimal identity query: get extrinsic id/hash by any of the identifiers (hash, id, or height+index)
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
      query: EXTRINSIC_IDENTITY_UNIFIED_QUERY as unknown as TypedDocumentNode<any, any>,
      variables: { hash, id, height: useHeightIndex ? h : undefined, index: useHeightIndex ? i : undefined, useHash, useId, useHeightIndex },
      fetchPolicy: 'network-only',
    });
    const node = ((data as any)?.byHash ?? [])[0]
      || ((data as any)?.byId ?? [])[0]
      || ((data as any)?.byHeightIndex ?? [])[0];
    if (!node) return null;
    return { id: node?.id, hash: node?.hash };
  } catch {
    return null;
  }
}

// On-demand: deep unified events (unfiltered) for rare cases when indexer filters miss the fee event
export const EXTRINSIC_DEEP_EVENTS_UNIFIED_QUERY = graphql(`
  query ExtrinsicDeepEventsUnified(
    $hash: String, $id: String, $height: Int, $index: Int,
    $useHash: Boolean!, $useId: Boolean!, $useHeightIndex: Boolean!,
    $limit: Int!
  ) {
    byHash: extrinsics(where: { hash_eq: $hash }, limit: 1) @include(if: $useHash) {
      signedData
      events(limit: $limit) { section method data }
    }
    byId: extrinsics(where: { id_eq: $id }, limit: 1) @include(if: $useId) {
      signedData
      events(limit: $limit) { section method data }
    }
    byHeightIndex: extrinsics(where: { index_eq: $index, block: { height_eq: $height } }, limit: 1) @include(if: $useHeightIndex) {
      signedData
      events(limit: $limit) { section method data }
    }
  }
`);

/**
 * Deep lookup variant: single on-demand query that fetches unfiltered events (higher limit)
 * and computes fee client-side. Use only when the light query failed.
 */
export async function fetchFeeDeepLookupOnce(
  client: ApolloClient<NormalizedCacheObject>,
  params: { hash?: string | null; extrinsicId?: string | null; height?: number | null; index?: number | null },
  limit: number = 100,
): Promise<string> {
  const hash = (params.hash || '').trim();
  const id = (params.extrinsicId || '').trim();
  const h = Number(params.height);
  const i = Number(params.index);
  const useHash = !!hash;
  const useId = !!id;
  const useHeightIndex = Number.isFinite(h) && Number.isFinite(i);
  if (!useHash && !useId && !useHeightIndex) return '0';
  try {
    const { data } = await client.query({
      query: EXTRINSIC_DEEP_EVENTS_UNIFIED_QUERY as unknown as TypedDocumentNode<any, any>,
      variables: { hash, id, height: useHeightIndex ? h : undefined, index: useHeightIndex ? i : undefined, useHash, useId, useHeightIndex, limit: Math.max(20, Math.min(limit, 400)) },
      fetchPolicy: 'network-only',
    });
    const node = ((data as any)?.byHash ?? [])[0]
      || ((data as any)?.byId ?? [])[0]
      || ((data as any)?.byHeightIndex ?? [])[0];
    const evs = (node?.events ?? []) as Array<{ section?: string; method?: string; data: unknown }>;
    const filtered = evs
      .filter((e) => String(e?.section || '').toLowerCase() === 'transactionpayment'
        && String(e?.method || '').toLowerCase() === 'transactionfeepaid')
      .map((e) => ({ data: e.data }));
    let fee = sumFeesFromEvents(filtered);
    if (fee === '0') {
      const v = parseFeeFromSignedData(node?.signedData);
      if (v && v !== '0') fee = v;
    }
    return fee;
  } catch {
    return '0';
  }
}

// Fallback to find extrinsicHash via Transfer entity by (height,index)
// (removed) TRANSFER_HASH_BY_HEIGHT_INDEX_QUERY — unused

// (removed) BULK_EXTRINSIC_FEES_QUERY — unused

// (removed) BULK_EXTRINSIC_IDS_BY_HASHES_QUERY — unused

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
    from { id }
    to { id }
    token { id name }
  }
`);

export const PAGINATED_TRANSFERS_QUERY = graphql(`
  query TransfersFeeQuery($first: Int!, $after: String, $where: TransferWhereInput, $orderBy: [TransferOrderByInput!]!) {
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
    (where as any).extrinsicHash_eq = hash;
  } else if (Number.isFinite(h) && Number.isFinite(i)) {
    (where as any).blockHeight_eq = h;
    (where as any).extrinsicIndex_eq = i;
  } else if (id) {
    (where as any).extrinsicId_eq = id;
    const m = /^0*(\d+)-0*(\d+)/.exec(id);
    if (m) {
      (where as any).blockHeight_eq = Number(m[1]);
      (where as any).extrinsicIndex_eq = Number(m[2]);
    }
  } else {
    return null;
  }
  try {
    const { data } = await (client as ApolloClient<NormalizedCacheObject>).query({
      query: TRANSFERS_POLLING_QUERY as unknown as TypedDocumentNode<any, any>,
      variables: { where, limit: 50 },
      fetchPolicy: 'network-only',
    });
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

// --- Fee helpers ---
/**
 * Fetch total fee for a single extrinsic hash using TransactionFeePaid events.
 * Returns total (actual_fee + tip) in base units as decimal string.
 */
// Deprecated fetchFeeByExtrinsicHash removed (use fetchFeeUnifiedOnce)

// (removed) fetchFeesByExtrinsicHashesBulk / fetchFeesByExtrinsicHashes — unused

// (removed) ExtrinsicId helpers — unused

// --- helpers ---
/**
 * One-call fee resolver. Uses EXTRINSIC_FEE_AND_SIGNED_UNIFIED_QUERY with include flags.
 * Does not perform any additional network fallbacks to keep it strictly single-request.
 */
export async function fetchFeeUnifiedOnce(
  client: ApolloClient<NormalizedCacheObject>,
  params: { hash?: string | null; extrinsicId?: string | null; height?: number | null; index?: number | null }
): Promise<string> {
  const hash = (params.hash || '').trim();
  const id = (params.extrinsicId || '').trim();
  const h = Number(params.height);
  const i = Number(params.index);
  const useHash = !!hash;
  const useId = !!id;
  const useHeightIndex = Number.isFinite(h) && Number.isFinite(i);
  if (!useHash && !useId && !useHeightIndex) return '0';
  try {
    const { data } = await client.query({
      query: EXTRINSIC_FEE_AND_SIGNED_UNIFIED_QUERY as unknown as TypedDocumentNode<any, any>,
      variables: { hash, id, height: useHeightIndex ? h : undefined, index: useHeightIndex ? i : undefined, useHash, useId, useHeightIndex },
      fetchPolicy: 'network-only',
    });
    const node = ((data as any)?.byHash ?? [])[0]
      || ((data as any)?.byId ?? [])[0]
      || ((data as any)?.byHeightIndex ?? [])[0];
    const evs = (node?.events ?? []) as Array<{ section?: string; method?: string; data: unknown }>;
    let fee = sumFeesFromEvents(
      evs
        .filter((e) => String(e?.section || '').toLowerCase() === 'transactionpayment'
          && String(e?.method || '').toLowerCase() === 'transactionfeepaid')
        .map((e) => ({ data: e.data }))
    );
    if (fee === '0') {
      const v = parseFeeFromSignedData(node?.signedData);
      if (v && v !== '0') fee = v;
    }
    return fee;
  } catch (e) {
    return '0';
  }
}

function parseFeeFromSignedData(raw: unknown): string | undefined {
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const paths = [
      ['fee', 'partialFee'],
      ['fee', 'partial_fee'],
      ['partialFee'],
      ['partial_fee'],
      ['actual_fee'],
      ['actualFee'],
    ];
    for (const p of paths) {
      let cur: any = obj;
      for (const k of p) cur = cur?.[k];
      if (cur == null) continue;
      if (typeof cur === 'bigint') return cur.toString();
      if (typeof cur === 'number' && Number.isFinite(cur)) return BigInt(Math.trunc(cur)).toString();
      if (typeof cur === 'string') {
        const s = cur.trim();
        if (/^0x[0-9a-fA-F]+$/.test(s)) return BigInt(s).toString();
        if (/^[0-9]+$/.test(s)) return BigInt(s).toString();
      }
    }
    return undefined;
  } catch { return undefined; }
}

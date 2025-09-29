import { graphql } from '@/gql';
import type {
  ExtrinsicFeeQueryQuery,
  ExtrinsicFeeQueryQueryVariables,
  BulkExtrinsicsFeesQueryQuery,
  BulkExtrinsicsFeesQueryQueryVariables,
} from '@/gql/graphql';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import type { ApolloClient, NormalizedCacheObject } from '@apollo/client';
import { sumFeesFromEvents } from '@/utils/fees';

// Simple module-level cache to deduplicate fee fetches across hooks/components
const feeCache = new Map<string, string>();
const inflightFees = new Map<string, Promise<string>>();
// Cache for extrinsic id by hash (e.g., "13538903-1")
const extrinsicIdCache = new Map<string, string>();

export function getCachedFee(extrinsicHash: string): string | undefined {
  if (!extrinsicHash) return undefined;
  return feeCache.get(extrinsicHash);
}

export function getCachedExtrinsicId(extrinsicHash: string): string | undefined {
  if (!extrinsicHash) return undefined;
  return extrinsicIdCache.get(extrinsicHash);
}

export const EXTRINSIC_FEE_QUERY = graphql(`
  query ExtrinsicFeeQuery($extrinsicHash: String!) {
    extrinsics(where: { hash_eq: $extrinsicHash }, limit: 1) {
      events(where: {section_eq: "transactionpayment", method_eq: "TransactionFeePaid"}, limit: 1) {
        data
      }
    }
  }
`);

// Minimal extrinsic fetch by hash to retrieve its canonical id ("block-extrinsic")
export const EXTRINSIC_ID_BY_HASH_QUERY = graphql(`
  query ExtrinsicIdByHash($hash: String!) {
    extrinsics(where: { hash_eq: $hash }, limit: 1) {
      id
    }
  }
`);

// Bulk fees query using hash_in to reduce round-trips
export const BULK_EXTRINSIC_FEES_QUERY = graphql(`
  query BulkExtrinsicsFeesQuery($hashes: [String!]!) {
    extrinsics(where: { hash_in: $hashes }) {
      hash
      events(where: { section_eq: "transactionpayment", method_eq: "TransactionFeePaid" }) {
        data
      }
    }
  }
`);

// Bulk extrinsic ids by hashes to minimize round-trips
export const BULK_EXTRINSIC_IDS_BY_HASHES_QUERY = graphql(`
  query BulkExtrinsicIdsByHashes($hashes: [String!]!) {
    extrinsics(where: { hash_in: $hashes }) {
      hash
      id
    }
  }
`);

// --- Reusable fragments for transfers ---
export const TRANSFER_COMMON_FIELDS = graphql(`
  fragment TransferCommonFields on Transfer {
    id
    amount
    timestamp
    success
    type
    reefswapAction
    signedData
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

export const NFT_TOKEN_ID_QUERY = graphql(`
  query NftTokenIdQuery($ids: [String!]) {
    extrinsics(where: { id_in: $ids }) {
      id
      hash
      events(where: { section_eq: "uniques", method_eq: "Transferred" }) {
        id
        section
        method
        data
      }
    }
  }
`);


// Polling query for new transfers (used by subscription hook)
export const TRANSFERS_POLLING_QUERY = graphql(`
  query TransfersPollingQuery($where: TransferWhereInput, $orderBy: [TransferOrderByInput!], $offset: Int, $limit: Int) {
    transfers(where: $where, orderBy: $orderBy, offset: $offset, limit: $limit) {
      ...TransferCommonFields
    }
  }
`);

// --- Fee helpers ---
/**
 * Fetch total fee for a single extrinsic hash using TransactionFeePaid events.
 * Returns total (actual_fee + tip) in base units as decimal string.
 */
export async function fetchFeeByExtrinsicHash(
  client: ApolloClient<NormalizedCacheObject>,
  extrinsicHash: string,
): Promise<string> {
  if (!extrinsicHash) return '0';
  // Resolved cache hit
  const cached = feeCache.get(extrinsicHash);
  if (cached !== undefined) return cached;

  // In-flight de-duplication
  const inflight = inflightFees.get(extrinsicHash);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      const { data } = await client.query<ExtrinsicFeeQueryQuery, ExtrinsicFeeQueryQueryVariables>({
        query: EXTRINSIC_FEE_QUERY as unknown as TypedDocumentNode<ExtrinsicFeeQueryQuery, ExtrinsicFeeQueryQueryVariables>,
        variables: { extrinsicHash },
        fetchPolicy: 'cache-first',
      });
      const events = (data?.extrinsics?.[0]?.events ?? []) as Array<{ data: unknown }>;
      const fee = sumFeesFromEvents(events);
      feeCache.set(extrinsicHash, fee);
      return fee;
    } catch (e) {
      console.warn('[fees] Failed to fetch fee for hash', extrinsicHash, e);
      return '0';
    } finally {
      inflightFees.delete(extrinsicHash);
    }
  })();

  inflightFees.set(extrinsicHash, promise);
  return promise;
}

async function fetchFeesByExtrinsicHashesBulk(
  client: ApolloClient<NormalizedCacheObject>,
  hashes: string[],
): Promise<Record<string, string>> {
  if (!hashes.length) return {};
  try {
    const { data } = await client.query<BulkExtrinsicsFeesQueryQuery, BulkExtrinsicsFeesQueryQueryVariables>({
      query: BULK_EXTRINSIC_FEES_QUERY as unknown as TypedDocumentNode<BulkExtrinsicsFeesQueryQuery, BulkExtrinsicsFeesQueryQueryVariables>,
      variables: { hashes },
      fetchPolicy: 'cache-first',
    });
    const map: Record<string, string> = {};
    const list = (data?.extrinsics ?? []) as Array<{ hash: string; events?: Array<{ data: unknown }> }>;
    for (const ex of list) {
      const fee = sumFeesFromEvents(ex.events ?? []);
      map[ex.hash] = fee;
      feeCache.set(ex.hash, fee);
    }
    return map;
  } catch (e) {
    console.warn('[fees][bulk] Failed to fetch bulk fees', e);
    return {};
  }
}

/**
 * Fetch fees for a list of extrinsic hashes with simple concurrency limiting.
 */
export async function fetchFeesByExtrinsicHashes(
  client: ApolloClient<NormalizedCacheObject>,
  hashes: string[],
  concurrency = 4,
): Promise<Record<string, string>> {
  const unique = Array.from(new Set(hashes.filter(Boolean)));
  const result: Record<string, string> = {};

  // Prime from cache and build fetch list
  const toFetch: string[] = [];
  for (const h of unique) {
    const cached = feeCache.get(h);
    if (cached !== undefined) {
      result[h] = cached;
    } else {
      toFetch.push(h);
    }
  }

  // First try bulk query to minimize round-trips
  if (toFetch.length > 1) {
    const bulkMap = await fetchFeesByExtrinsicHashesBulk(client, toFetch);
    for (const [hash, fee] of Object.entries(bulkMap)) {
      result[hash] = fee;
    }
    // Determine which remain
    const remaining = toFetch.filter((h) => bulkMap[h] === undefined);
    toFetch.length = 0;
    toFetch.push(...remaining);
  }

  let index = 0;
  async function worker() {
    while (index < toFetch.length) {
      const current = toFetch[index++];
      const fee = await fetchFeeByExtrinsicHash(client, current);
      result[current] = fee;
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, toFetch.length) }, () => worker());
  await Promise.all(workers);
  return result;
}

// --- ExtrinsicId helpers ---
/**
 * Fetch extrinsic id ("block-extrinsic") by extrinsic hash and cache it.
 */
export async function fetchExtrinsicIdByHash(
  client: ApolloClient<NormalizedCacheObject>,
  hash: string,
): Promise<string | undefined> {
  if (!hash) return undefined;
  const cached = extrinsicIdCache.get(hash);
  if (cached !== undefined) return cached;
  try {
    const { data } = await client.query({
      query: EXTRINSIC_ID_BY_HASH_QUERY as unknown as TypedDocumentNode<any, any>,
      variables: { hash },
      fetchPolicy: 'cache-first',
    });
    const id: string | undefined = data?.extrinsics?.[0]?.id;
    if (id) extrinsicIdCache.set(hash, id);
    return id;
  } catch (e) {
    console.warn('[exId] Failed to fetch extrinsic id for hash', hash, e);
    return undefined;
  }
}

/**
 * Fetch extrinsic ids for a list of extrinsic hashes with simple concurrency limiting.
 */
export async function fetchExtrinsicIdsByHashes(
  client: ApolloClient<NormalizedCacheObject>,
  hashes: string[],
  concurrency = 4,
): Promise<Record<string, string>> {
  const unique = Array.from(new Set(hashes.filter(Boolean)));
  const result: Record<string, string> = {};

  const toFetch: string[] = [];
  for (const h of unique) {
    const cached = extrinsicIdCache.get(h);
    if (cached !== undefined) {
      result[h] = cached;
    } else {
      toFetch.push(h);
    }
  }

  // Try bulk first to reduce number of requests
  let remaining = toFetch.slice();
  if (remaining.length > 1) {
    try {
      const { data } = await client.query({
        query: BULK_EXTRINSIC_IDS_BY_HASHES_QUERY as unknown as TypedDocumentNode<any, any>,
        variables: { hashes: remaining },
        fetchPolicy: 'cache-first',
      });
      const list = (data?.extrinsics ?? []) as Array<{ hash: string; id?: string }>;
      const bulkMap: Record<string, string> = {};
      for (const ex of list) {
        if (ex?.hash && ex?.id) {
          bulkMap[ex.hash] = ex.id;
          extrinsicIdCache.set(ex.hash, ex.id);
        }
      }
      for (const [h, id] of Object.entries(bulkMap)) {
        result[h] = id;
      }
      remaining = remaining.filter((h) => bulkMap[h] === undefined);
    } catch (e) {
      console.warn('[exId][bulk] Failed to fetch bulk extrinsic ids', e);
    }
  }

  // Fallback to singles for those still missing
  if (remaining.length > 0) {
    let index = 0;
    async function worker() {
      while (index < remaining.length) {
        const current = remaining[index++];
        const id = await fetchExtrinsicIdByHash(client, current);
        if (id) {
          result[current] = id;
          extrinsicIdCache.set(current, id);
        }
      }
    }
    const workers = Array.from({ length: Math.min(concurrency, remaining.length) }, () => worker());
    await Promise.all(workers);
  }

  return result;
}

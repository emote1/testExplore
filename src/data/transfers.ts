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

export function getCachedFee(extrinsicHash: string): string | undefined {
  if (!extrinsicHash) return undefined;
  return feeCache.get(extrinsicHash);
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

export const PAGINATED_TRANSFERS_QUERY = graphql(`
  query TransfersFeeQuery($first: Int!, $after: String, $where: TransferWhereInput, $orderBy: [TransferOrderByInput!]!) {
    transfersConnection(orderBy: $orderBy, first: $first, after: $after, where: $where) {
      edges {
        node {
          id
          amount
          timestamp
          success
          type
          signedData
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
      pageInfo {
        hasNextPage
        endCursor
      }
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
      id
      amount
      timestamp
      success
      type
      signedData
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

import { useEffect, useMemo, useState } from 'react';
import { useAddressResolver } from './use-address-resolver';
import { useQuery } from '@tanstack/react-query';
import { apolloClient as client } from '../apollo-client';
import { gql } from '@apollo/client';
import { normalizeIpfs } from '../utils/ipfs';
import { TtlCache } from '../data/ttl-cache';
import type { TokenHoldersByCollectionQuery, TokenHoldersByCollectionQueryVariables } from '@/gql/graphql';


interface Collection {
  id: string;
  name: string;
  image: string;
  // Derived from marketplace endpoint; may be 0 if not found
  itemCount?: number;
  // The API also returns 'description', 'official', 'verified', etc.
  // but we only need these for the gallery view.
}

// Module-level TTL caches and in-flight dedupe
const COLLECTIONS_BY_OWNER_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const COLLECTION_TOTALS_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

const collectionsByOwnerTtl = new TtlCache<Collection[]>({
  namespace: 'reef:collectionsByOwner',
  defaultTtlMs: COLLECTIONS_BY_OWNER_TTL_MS,
  persist: true,
  maxSize: 5000,
});

const collectionTotalsTtl = new TtlCache<number>({
  namespace: 'reef:collectionTotals',
  defaultTtlMs: COLLECTION_TOTALS_TTL_MS,
  persist: true,
  maxSize: 20000,
});

const totalsInflight = new Map<string, Promise<number>>();

export function clearSqwidCollectionsCaches(): void {
  collectionsByOwnerTtl.clear();
  collectionTotalsTtl.clear();
}

export function pruneSqwidCollectionsCaches(): void {
  collectionsByOwnerTtl.pruneExpired();
  collectionTotalsTtl.pruneExpired();
}

/**
 * Fetch total number of unique items in a collection by paging the marketplace endpoint
 * and counting distinct IDs (prefer tokenId, then itemId, then positionId, then id).
 *
 * Why: pagination.lowest is not a reliable total. With limit=1 it can appear as 2, etc.
 * We follow the actual API paging: startFrom=0, then use pagination.lowest as the next cursor
 * until no items are returned or the cursor stops progressing.
 *
 * RU (кратко): пагинируем по startFrom → pagination.lowest и считаем уникальные ID
 * (tokenId | itemId | positionId | id). Если API возвращает total — используем его и
 * прекращаем пагинацию.
 */
async function fetchCollectionTotal(collectionId: string, signal?: AbortSignal): Promise<number> {
  if (!collectionId) return 0;
  const cached = collectionTotalsTtl.get(collectionId);
  if (typeof cached === 'number') return cached;

  const existing = totalsInflight.get(collectionId);
  if (existing) return existing;

  const task = (async () => {
    const perPage = 12;
    const maxPages = 100; // safety cap
    let startFrom = 0;
    let pages = 0;
    const seen = new Set<string>();

    while (pages < maxPages) {
      const url = `https://sqwid-api-mainnet.reefscan.info/get/marketplace/by-collection/${collectionId}/0?limit=${perPage}&startFrom=${startFrom}`;
      const res = await fetch(url, { headers: { accept: 'application/json' }, signal });
      if (!res.ok) {
        // treat non-404 errors as zero to keep gallery resilient
        if (res.status === 404) {
          collectionTotalsTtl.set(collectionId, 0);
          return 0;
        }
        break;
      }
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        break;
      }
      type ItemsContainer = { items?: unknown[]; total?: number; pagination?: { lowest?: number } };
      interface MarketplaceItem { tokenId?: string | number; itemId?: string | number; positionId?: string | number; id?: string | number }
      const json: ItemsContainer = await res.json().catch(() => ({} as ItemsContainer));
      const items: MarketplaceItem[] = Array.isArray(json.items) ? (json.items as MarketplaceItem[]) : [];

      // If API provides authoritative total, prefer it and stop early
      const apiTotal = typeof json.total === 'number' ? json.total : undefined;
      if (typeof apiTotal === 'number' && apiTotal >= 0) {
        collectionTotalsTtl.set(collectionId, apiTotal);
        return apiTotal;
      }

      if (!items.length) {
        break;
      }

      for (const it of items) {
        const key = String(it?.tokenId ?? it?.itemId ?? it?.positionId ?? it?.id ?? `${startFrom}-${seen.size}`);
        seen.add(key);
      }

      const next = typeof json?.pagination?.lowest === 'number' ? Number(json.pagination.lowest) : startFrom + perPage;
      if (!Number.isFinite(next) || next <= startFrom) {
        break; // cursor didn't advance; stop to avoid infinite loop
      }
      startFrom = next;
      pages += 1;
    }

    const total = seen.size;
    collectionTotalsTtl.set(collectionId, total);
    return total;
  })();

  totalsInflight.set(collectionId, task);
  try {
    return await task;
  } finally {
    totalsInflight.delete(collectionId);
  }
}

async function fetchTotalsForCollections(ids: string[], concurrency = 6, signal?: AbortSignal): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  let index = 0;
  async function worker() {
    while (index < ids.length) {
      const current = index++;
      const id = ids[current];
      try {
        const cached = collectionTotalsTtl.get(id);
        const total = typeof cached === 'number' ? cached : await fetchCollectionTotal(id, signal);
        out.set(id, total);
      } catch {
        out.set(id, 0);
      }
    }
  }
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, ids.length)) }, () => worker());
  await Promise.all(workers);
  return out;
}

async function fetchSqwidCollectionsByOwner(evmAddress: string | null, signal?: AbortSignal): Promise<Collection[]> {
  if (!evmAddress) {
    return [];
  }

  const cachedOwner = collectionsByOwnerTtl.get(evmAddress);
  if (Array.isArray(cachedOwner)) return cachedOwner;

  const url = `https://sqwid-api-mainnet.reefscan.info/get/collections/owner/${evmAddress}`;
  const response = await fetch(url, { headers: { accept: 'application/json' }, signal });

  if (!response.ok) {
    // Gracefully degrade: treat any non-2xx (including 404) as "no collections"
    if (evmAddress) collectionsByOwnerTtl.set(evmAddress, []);
    return [];
  }

  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    // Unexpected content type; assume empty result instead of surfacing an error
    if (evmAddress) collectionsByOwnerTtl.set(evmAddress, []);
    return [];
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    if (evmAddress) collectionsByOwnerTtl.set(evmAddress, []);
    return [];
  }
  type RawCollectionsEnvelope = { collections?: unknown[] };
  interface RawCollection { id?: string; data?: { name?: string; thumbnail?: string; image?: string } }
  const arrUnknown: unknown[] = Array.isArray(raw)
    ? (raw as unknown[])
    : (typeof raw === 'object' && raw && Array.isArray((raw as RawCollectionsEnvelope).collections)
        ? ((raw as RawCollectionsEnvelope).collections as unknown[])
        : []);
  const baseSource = arrUnknown as RawCollection[];
  const base: Collection[] = baseSource
    .map((c) => {
      const data = c?.data ?? {};
      return {
        id: c?.id ?? '',
        name: data?.name ?? 'Unnamed Collection',
        image: normalizeIpfs(data?.thumbnail ?? data?.image) ?? '',
      };
    })
    .filter((c) => !!c.id);

  // Enrich with itemCount from marketplace endpoint
  const ids = base.map(c => c.id);
  const totals = await fetchTotalsForCollections(ids, 6, signal);
  const initial: Collection[] = base.map(c => ({ ...c, itemCount: totals.get(c.id) ?? 0 }));

  // For small or missing totals, fallback to Subsquid GraphQL: count distinct nftId by collection (not by owner)
  async function fetchDistinctCountByCollection(collectionId: string, pageSize = 300, maxPages = 10, signal?: AbortSignal): Promise<number> {
    if (!collectionId) return 0;
    const seen = new Set<string>();
    let offset = 0;
    for (let page = 0; page < maxPages; page++) {
      const result = await client.query<TokenHoldersByCollectionQuery, TokenHoldersByCollectionQueryVariables>({
        query: gql`
          query TokenHoldersByCollection($collectionId: String!, $limit: Int!, $offset: Int!) {
            tokenHolders(
              where: { token: { id_eq: $collectionId }, balance_gt: "0" }
              limit: $limit
              offset: $offset
            ) {
              nftId
            }
          }
        `,
        variables: { collectionId, limit: pageSize, offset },
        fetchPolicy: 'network-only',
        context: { fetchOptions: { signal } },
      });
      const batch = Array.isArray(result.data?.tokenHolders) ? result.data.tokenHolders : [];
      if (batch.length === 0) break;
      for (const row of batch) {
        const id = row?.nftId;
        if (id === null || id === undefined) continue;
        seen.add(String(id));
      }
      offset += batch.length;
      if (batch.length < pageSize) break;
      if (seen.size > 5000) break; // safety cap
    }
    return seen.size;
  }

  async function fetchDistinctCounts(ids: string[], concurrency = 4, signal?: AbortSignal): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    const targets = ids.slice();
    let index = 0;
    async function worker() {
      while (index < targets.length) {
        const current = index++;
        const id = targets[current];
        try {
          const n = await fetchDistinctCountByCollection(id, 300, 10, signal);
          out.set(id, n);
        } catch {
          out.set(id, 0);
        }
      }
    }
    const workers = Array.from({ length: Math.max(1, Math.min(concurrency, targets.length)) }, () => worker());
    await Promise.all(workers);
    return out;
  }

  const smallIds = initial.filter(c => (c.itemCount ?? 0) <= 2).map(c => c.id);
  if (smallIds.length === 0) {
    collectionsByOwnerTtl.set(evmAddress, initial);
    return initial;
  }
  const distinct = await fetchDistinctCounts(smallIds, 4, signal);
  const merged: Collection[] = initial.map(c => {
    const d = distinct.get(c.id) ?? 0;
    const itemCount = Math.max(c.itemCount ?? 0, d);
    return { ...c, itemCount };
  });
  collectionsByOwnerTtl.set(evmAddress, merged);
  return merged;
}

export function useSqwidCollectionsByOwner(address: string | null) {
  const { resolveEvmAddress, isResolving: isEvmResolving } = useAddressResolver();
  const [evmAddress, setEvmAddress] = useState<string | null>(null);

  useEffect(() => {
    const resolve = async () => {
      if (!address) {
        setEvmAddress(null);
        return;
      }
      const resolved = await resolveEvmAddress(address);
      setEvmAddress(resolved);
    };
    resolve();
  }, [address, resolveEvmAddress]);

  const queryKey = useMemo(() => ['sqwid-collections', evmAddress] as const, [evmAddress]);

  const { data: collections = [], isLoading, error } = useQuery<Collection[], Error>({
    queryKey,
    queryFn: ({ signal }) => fetchSqwidCollectionsByOwner(evmAddress, signal),
    enabled: !!evmAddress && !isEvmResolving, // Enable query only when we have the EVM address
  });

  return { collections, isLoading: isLoading || isEvmResolving, error };
}

import { useEffect, useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';

export interface OwnerCollection {
  id: string;
  name: string;
  image?: string;
  itemCount: number; // unknown from API; default 0
}

interface ApiCollectionItem {
  id: string;
  data?: {
    name?: string;
    image?: string;
    thumbnail?: string;
    owner?: string;
  };
}

interface ApiResponse {
  collections?: ApiCollectionItem[];
  total?: number;
  count?: number;
}

// React Query handles caching; module-level caches removed

function sanitizeName(name?: string): string {
  if (!name) return 'Unnamed Collection';
  return name.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ').replace(/\s+/g, ' ').trim() || 'Unnamed Collection';
}

function normalizeIpfs(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('ipfs://')) return `https://reef.infura-ipfs.io/ipfs/${url.slice('ipfs://'.length)}`;
  return url;
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

async function fetchCollectionsByOwner(address: string, limit: number, startFrom: number): Promise<ApiResponse> {
  const url = `https://sqwid-api-mainnet.reefscan.info/get/collections/owner/${address}?limit=${limit}&startFrom=${startFrom}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err: any = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as ApiResponse;
}

export interface UseSqwidCollectionsByOwnerParams {
  limit?: number;
  startFrom?: number;
  disableCounts?: boolean;
}

export function useSqwidCollectionsByOwner(address: string | null, params: UseSqwidCollectionsByOwnerParams = {}) {
  const { limit = 24, startFrom = 0, disableCounts = false } = params;
  const [collections, setCollections] = useState<OwnerCollection[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const queryKey = useMemo(() => ['sqwidOwnerCollections', address, startFrom, limit] as const, [address, startFrom, limit]);

  const query = useQuery<ApiResponse, Error, { list: OwnerCollection[]; total: number | null }>({
    queryKey,
    enabled: !!address,
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    queryFn: async () => {
      if (!address) return { collections: [], total: 0 } as ApiResponse;
      try {
        return await fetchCollectionsByOwner(address, limit, startFrom);
      } catch (err: any) {
        const status = err?.status ?? err?.response?.status;
        const isTransient = status === 502 || status === 503 || status === 429;
        if (isTransient) {
          await sleep(300);
          return fetchCollectionsByOwner(address, limit, startFrom);
        }
        throw err;
      }
    },
    select: (response: ApiResponse) => {
      const list: OwnerCollection[] = (response.collections ?? []).map((c) => ({
        id: c.id,
        name: sanitizeName(c.data?.name),
        image: normalizeIpfs(c.data?.thumbnail || c.data?.image),
        itemCount: 0,
      }));
      const t = typeof response.total === 'number' ? response.total : (typeof response.count === 'number' ? response.count : null);
      return { list, total: t };
    },
  });

  useEffect(() => {
    setCollections(query.data?.list ?? []);
    setTotal(query.data?.total ?? null);
  }, [query.data]);

  useEffect(() => {
    if (disableCounts) return;
    const baseList = query.data?.list ?? [];
    if (!baseList.length) return;
    let cancelled = false;
    const list = baseList;
    const concurrency = 6;
    let idx = 0;
    const countCache = new Map<string, number>();
    async function fetchCountOnce(colId: string): Promise<number> {
      if (countCache.has(colId)) return countCache.get(colId)!;
      try {
        const url = `https://sqwid-api-mainnet.reefscan.info/get/marketplace/by-collection/${colId}/0?limit=12&startFrom=0`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        let total = typeof data?.pagination?.lowest === 'number' && data.pagination.lowest > 0
          ? data.pagination.lowest
          : (typeof data?.total === 'number' ? data.total : 0);
        if (!total || total <= 2) {
          total = await countDistinctNftsViaSubsquid(colId);
        }
        countCache.set(colId, total);
        return total;
      } catch {
        return 0;
      }
    }
    async function worker() {
      while (!cancelled && idx < list.length) {
        const current = idx++;
        const col = list[current];
        const count = await fetchCountOnce(col.id);
        if (cancelled) return;
        setCollections((prev) => prev.map((c) => (c.id === col.id ? { ...c, itemCount: count } : c)));
      }
    }
    Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, () => worker()));
    return () => { cancelled = true; };
  }, [disableCounts, address, startFrom, limit, query.data]);

  return { collections, total, isLoading: query.isLoading || query.isFetching, error: (query.error as Error) ?? null };
}

// Fallback using Subsquid GraphQL: count distinct nftId for a given token (contract) id
async function countDistinctNftsViaSubsquid(tokenId: string): Promise<number> {
  const endpoint = 'https://squid.subsquid.io/reef-explorer/graphql';
  const query = `query DistinctNfts($tokenId: String!, $limit: Int!, $offset: Int!) {
    transfers(where: { token: { id_eq: $tokenId }, type_in: [ERC1155, ERC721] }, orderBy: timestamp_DESC, limit: $limit, offset: $offset) {
      nftId
    }
  }`;
  const limit = 500;
  let offset = 0;
  const seen = new Set<string>();
  for (let page = 0; page < 30; page++) { // up to 15k rows
    const body = { query, variables: { tokenId, limit, offset } };
    const res = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) break;
    const json = await res.json();
    const rows = json?.data?.transfers ?? [];
    for (const r of rows) {
      if (r?.nftId != null) seen.add(String(r.nftId));
    }
    if (rows.length < limit) break;
    offset += limit;
  }
  return seen.size;
}

// removed head-based helper in favor of accurate paged counting

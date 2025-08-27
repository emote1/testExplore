import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { normalizeIpfs } from '../utils/ipfs';
import { sleep } from '../utils/time';

export interface CollectionNft {
  id: string;
  name?: string;
  image?: string;
  media?: string;
  thumbnail?: string;
  mimetype?: string;
  amount?: number;
}

export interface UseSqwidCollectionParams {
  collectionId: string | null;
  limit?: number;
}

interface ApiItem {
  id?: string | number;
  tokenId?: string | number;
  itemId?: string | number;
  positionId?: string | number;
  name?: string;
  image?: string;
  thumbnail?: string;
  media?: string;
  amount?: number;
  mimetype?: string;
  state?: { amount?: number | string };
  meta?: {
    name?: string;
    image?: string;
    thumbnail?: string;
    media?: string;
    animation_url?: string;
    mimetype?: string;
    mimeType?: string;
  };
}

interface ApiResponse {
  items?: ApiItem[];
  pagination?: { lowest?: number; limit?: number };
  total?: number | null;
}

// IPFS URL normalization is handled by utils/ipfs

async function fetchCollectionPage(collectionId: string, limit: number, startFrom: number, signal?: AbortSignal): Promise<ApiResponse & { __cursor: number }> {
  const url = `https://sqwid-api-mainnet.reefscan.info/get/marketplace/by-collection/${collectionId}/0?limit=${limit}&startFrom=${startFrom}`;
  const res = await fetch(url, { headers: { accept: 'application/json' }, signal });
  if (!res.ok) {
    const snippet = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url} :: ${snippet.slice(0, 160)}`);
  }

  const contentType = res.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await res.text();
    throw new Error(`Expected JSON but received ${contentType}. Response: ${text.slice(0, 100)}`);
  }

  const json = (await res.json()) as ApiResponse;
  return Object.assign(json, { __cursor: startFrom });
}

export function useSqwidCollectionInfinite(params: UseSqwidCollectionParams) {
  const { collectionId, limit = 12 } = params;
  const queryKey = useMemo(() => ['sqwidCollectionInfinite', collectionId, limit] as const, [collectionId, limit]);

  const query = useInfiniteQuery<
    (ApiResponse & { __cursor: number; __nfts: CollectionNft[]; __total: number | null }),
    Error
  >({
    queryKey,
    enabled: !!collectionId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    getNextPageParam: (lastPage, _pages) => {
      const currentCursor = lastPage.__cursor ?? 0;
      const next = typeof lastPage?.pagination?.lowest === 'number' ? Number(lastPage.pagination.lowest) : currentCursor + limit;
      const itemsLen = Array.isArray(lastPage.items) ? lastPage.items.length : 0;
      // If no items or cursor didn't advance, stop
      if (itemsLen === 0 || !Number.isFinite(next) || next <= currentCursor) return undefined;
      // If API gives total, stop when next would exceed total
      const total = typeof lastPage.total === 'number' ? lastPage.total : undefined;
      if (typeof total === 'number' && next >= total) return undefined;
      return next;
    },
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      if (!collectionId) return { items: [], pagination: { lowest: 0, limit }, total: null, __cursor: 0, __nfts: [], __total: null } as ApiResponse & { __cursor: number; __nfts: CollectionNft[]; __total: number | null };
      const startFrom = typeof pageParam === 'number' ? pageParam : 0;
      try {
        const response = await fetchCollectionPage(collectionId, limit, startFrom, signal);
        const items = (response.items ?? []).map((it: ApiItem) => {
          const name = it.meta?.name ?? it.name;
          const rawImage = it.meta?.image ?? it.image ?? it.meta?.thumbnail;
          const rawMedia = it.meta?.media ?? it.meta?.animation_url ?? it.media;
          const rawThumb = it.meta?.thumbnail ?? it.thumbnail;
          const mimetype = it.meta?.mimetype ?? it.meta?.mimeType ?? it.mimetype;
          const isVideo = typeof mimetype === 'string' && mimetype.startsWith('video/');
          const image = isVideo ? normalizeIpfs(rawThumb) : normalizeIpfs(rawImage);
          const media = normalizeIpfs(rawMedia ?? (isVideo ? rawImage : undefined));
          const thumbnail = normalizeIpfs(rawThumb);
          const keyPart = (it.tokenId ?? it.itemId ?? it.positionId ?? it.id ?? `${startFrom}`).toString();
          const id = `${collectionId}-${keyPart}`;
          const rawAmt = it.amount ?? it.state?.amount;
          const parsed = typeof rawAmt === 'string' ? Number(rawAmt) : rawAmt;
          const amount = typeof parsed === 'number' && !Number.isNaN(parsed) ? parsed : undefined;
          return { id, name, image, media, thumbnail, mimetype, amount } as CollectionNft;
        });
        const computedTotal = typeof response.total === 'number' ? response.total : (typeof response.pagination?.lowest === 'number' ? response.pagination.lowest : null);
        return Object.assign(response, { __cursor: startFrom, __nfts: items, __total: computedTotal });
      } catch (err: unknown) {
        const maybe = err as { status?: number; response?: { status?: number } } | undefined;
        const status = maybe?.status ?? maybe?.response?.status;
        const isTransient = status === 502 || status === 503 || status === 429;
        if (isTransient) {
          await sleep(300);
          const response = await fetchCollectionPage(collectionId, limit, startFrom, signal);
          const items = (response.items ?? []).map((it: ApiItem) => {
            const name = it.meta?.name ?? it.name;
            const rawImage = it.meta?.image ?? it.image ?? it.meta?.thumbnail;
            const rawMedia = it.meta?.media ?? it.meta?.animation_url ?? it.media;
            const rawThumb = it.meta?.thumbnail ?? it.thumbnail;
            const mimetype = it.meta?.mimetype ?? it.meta?.mimeType ?? it.mimetype;
            const isVideo = typeof mimetype === 'string' && mimetype.startsWith('video/');
            const image = isVideo ? normalizeIpfs(rawThumb) : normalizeIpfs(rawImage);
            const media = normalizeIpfs(rawMedia ?? (isVideo ? rawImage : undefined));
            const thumbnail = normalizeIpfs(rawThumb);
            const keyPart = (it.tokenId ?? it.itemId ?? it.positionId ?? it.id ?? `${startFrom}`).toString();
            const id = `${collectionId}-${keyPart}`;
            const rawAmt = it.amount ?? it.state?.amount;
            const parsed = typeof rawAmt === 'string' ? Number(rawAmt) : rawAmt;
            const amount = typeof parsed === 'number' && !Number.isNaN(parsed) ? parsed : undefined;
            return { id, name, image, media, thumbnail, mimetype, amount } as CollectionNft;
          });
          const computedTotal = typeof response.total === 'number' ? response.total : (typeof response.pagination?.lowest === 'number' ? response.pagination.lowest : null);
          return Object.assign(response, { __cursor: startFrom, __nfts: items, __total: computedTotal });
        }
        throw err as Error;
      }
    },
  });

  const nfts = (query.data?.pages ?? []).flatMap((p) => p.__nfts);
  // Dedupe by id while preserving order (API might repeat items across cursors)
  const seen = new Set<string>();
  const deduped: CollectionNft[] = [];
  for (const it of nfts) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    deduped.push(it);
  }
  const total = (query.data?.pages ?? []).reduce<number | null>((acc, p) => {
    if (acc !== null) return acc;
    return typeof p.__total === 'number' ? p.__total : null;
  }, null);

  return {
    nfts: deduped,
    total,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: !!query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    error: (query.error as Error) ?? null,
  };
}

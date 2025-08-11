import { useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';

export interface CollectionNft {
  id: string;
  name?: string;
  image?: string;
  amount?: number;
}

export interface UseSqwidCollectionParams {
  collectionId: string | null;
  limit?: number;
  startFrom?: number;
}

interface ApiItem {
  id?: string | number;
  tokenId?: string | number;
  itemId?: string | number;
  positionId?: string | number;
  name?: string;
  image?: string;
  amount?: number;
  meta?: {
    name?: string;
    image?: string;
    thumbnail?: string;
  };
}

interface ApiResponse {
  items?: ApiItem[];
  pagination?: { lowest?: number; limit?: number };
  total?: number;
}

function toIpfsUrl(ipfsUri: string | undefined): string | undefined {
  if (!ipfsUri) return undefined;
  if (ipfsUri.startsWith('ipfs://')) {
    return `https://reef.infura-ipfs.io/ipfs/${ipfsUri.split('ipfs://')[1]}`;
  }
  return ipfsUri;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCollectionPage(collectionId: string, limit: number, startFrom: number, signal?: AbortSignal): Promise<ApiResponse> {
  const url = `https://sqwid-api-mainnet.reefscan.info/get/marketplace/by-collection/${collectionId}/0?limit=${limit}&startFrom=${startFrom}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    const err: any = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = (await res.json()) as ApiResponse;
  return data;
}

export function useSqwidCollection(params: UseSqwidCollectionParams) {
  const { collectionId, limit = 12, startFrom = 0 } = params;
  const queryKey = useMemo(() => ['sqwidCollection', collectionId, startFrom, limit] as const, [collectionId, startFrom, limit]);

  const query = useQuery<ApiResponse, Error, { nfts: CollectionNft[]; total: number | null }>({
    queryKey,
    enabled: !!collectionId,
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    queryFn: async ({ signal }) => {
      if (!collectionId) return { items: [], pagination: { lowest: 0, limit } } as ApiResponse;
      try {
        return await fetchCollectionPage(collectionId, limit, startFrom, signal);
      } catch (err: any) {
        const status = err?.status ?? err?.response?.status;
        const isTransient = status === 502 || status === 503 || status === 429;
        if (isTransient) {
          await sleep(300);
          return fetchCollectionPage(collectionId, limit, startFrom, signal);
        }
        throw err;
      }
    },
    select: (response: ApiResponse) => {
      const items = (response.items ?? []).map((it: ApiItem) => {
        const name = it.meta?.name ?? it.name;
        const rawImage = it.meta?.image ?? it.meta?.thumbnail ?? it.image;
        const image = toIpfsUrl(rawImage);
        const keyPart = (it.tokenId ?? it.itemId ?? it.positionId ?? it.id ?? `${startFrom}`).toString();
        const id = `${collectionId}-${keyPart}`;
        const rawAmt: any = (it as any).amount ?? (it as any).state?.amount;
        const parsed = typeof rawAmt === 'string' ? Number(rawAmt) : rawAmt;
        const amount = typeof parsed === 'number' && !Number.isNaN(parsed) ? parsed : undefined;
        return { id, name, image, amount } as CollectionNft;
      });
      const computedTotal = typeof response.total === 'number' ? response.total : (typeof response.pagination?.lowest === 'number' ? response.pagination.lowest : null);
      return { nfts: items, total: computedTotal };
    },
  });

  return {
    nfts: query.data?.nfts ?? [],
    total: query.data?.total ?? null,
    isLoading: query.isLoading || query.isFetching,
    error: (query.error as Error) ?? null,
  };
}

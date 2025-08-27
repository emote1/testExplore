import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apolloClient as client } from '../apollo-client';
import { useAddressResolver } from './use-address-resolver';
import { NFTS_BY_OWNER_PAGED_QUERY } from '../data/nfts';
import type { NftsByOwnerPagedQuery, NftsByOwnerPagedQueryVariables } from '@/gql/graphql';
import { normalizeIpfs } from '../utils/ipfs';
import { toU64 } from '../utils/number';
import { fetchNftMetadata, setAbortSignal, type Nft } from './use-sqwid-nfts';
import { sleep } from '../utils/time';

export interface UseSqwidNftsInfiniteParams {
  owner: string | null;
  limit?: number; // GraphQL page size
}

interface PageResult {
  __offset: number;
  __pairs: { contractAddress: string; nftId: string | number; tokenType?: string; amount?: number }[];
  __nfts: Nft[];
}

// Concurrency for per-page metadata fetches
const ENV = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env) ?? {};
const FETCH_CONCURRENCY: number = (() => {
  try {
    const raw = ENV.VITE_FETCH_CONCURRENCY;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 12;
  } catch {
    return 12;
  }
})();

export function useSqwidNftsInfinite(params: UseSqwidNftsInfiniteParams) {
  const { owner, limit = 48 } = params;
  const { resolveEvmAddress } = useAddressResolver();

  const queryKey = useMemo(() => ['sqwidNftsInfinite', owner, limit] as const, [owner, limit]);

  const query = useInfiniteQuery<PageResult, Error>({
    queryKey,
    enabled: !!owner,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    initialPageParam: 0,
    getNextPageParam: (lastPage, _pages) => {
      // If we got fewer than limit pairs, stop; otherwise advance offset by number of pairs fetched
      const got = lastPage.__pairs.length;
      if (got < limit) return undefined;
      return lastPage.__offset + got;
    },
    queryFn: async ({ pageParam, signal }) => {
      setAbortSignal(signal);
      try {
        const inputAddress = owner ?? '';
        if (!inputAddress) return { __offset: 0, __pairs: [], __nfts: [] };

        const evmAddress = await resolveEvmAddress(inputAddress);
        if (!evmAddress) return { __offset: 0, __pairs: [], __nfts: [] };

        const offset = typeof pageParam === 'number' ? pageParam : 0;
        // 1) Fetch a page of token holders
        let response: NftsByOwnerPagedQuery | null = null;
        try {
          const { data } = await client.query<NftsByOwnerPagedQuery, NftsByOwnerPagedQueryVariables>({
            query: NFTS_BY_OWNER_PAGED_QUERY,
            variables: { owner: evmAddress, limit, offset },
            fetchPolicy: 'network-only',
            context: { fetchOptions: { signal } },
          });
          response = data;
        } catch (err: unknown) {
          const status = (err as { status?: number; response?: { status?: number } })?.status ?? (err as { response?: { status?: number } })?.response?.status;
          const isTransient = status === 502 || status === 503 || status === 429 || status === 500;
          if (isTransient) {
            await sleep(300);
            const { data } = await client.query<NftsByOwnerPagedQuery, NftsByOwnerPagedQueryVariables>({
              query: NFTS_BY_OWNER_PAGED_QUERY,
              variables: { owner: evmAddress, limit, offset },
              fetchPolicy: 'network-only',
              context: { fetchOptions: { signal } },
            });
            response = data;
          } else {
            throw err as Error;
          }
        }

        const holders = Array.isArray(response?.tokenHolders) ? response!.tokenHolders : [];
        if (holders.length === 0) return { __offset: offset, __pairs: [], __nfts: [] };

        // 2) Map to unique (contract, token) pairs and preserve owned amount
        const seen = new Set<string>();
        const pairs: { contractAddress: string; nftId: string | number; tokenType?: string; amount?: number }[] = [];
        for (const t of holders) {
          const contractId = t?.token?.id ?? undefined;
          const nftIdRaw = t?.nftId as unknown;
          const nftId = typeof nftIdRaw === 'string' || typeof nftIdRaw === 'number' ? nftIdRaw : undefined;
          const tokenType = (t?.token?.type ?? undefined) as unknown as string | undefined;
          const ownedAmount = toU64(t?.balance as unknown, 0);
          if (!contractId || (nftId === undefined || nftId === null)) continue;
          const key = `${contractId}::${nftId}`;
          if (seen.has(key)) continue;
          seen.add(key);
          pairs.push({ contractAddress: contractId, nftId, tokenType, amount: ownedAmount > 0 ? ownedAmount : undefined });
        }

        if (pairs.length === 0) return { __offset: offset, __pairs: [], __nfts: [] };

        // 3) Fetch metadata for this page with limited concurrency
        const n = Math.min(FETCH_CONCURRENCY, Math.max(1, pairs.length));
        const results: (Nft | null)[] = Array(pairs.length).fill(null);
        let idx = 0;
        async function worker() {
          while (idx < pairs.length) {
            const current = idx++;
            const { contractAddress, nftId, tokenType, amount } = pairs[current];
            const value = await fetchNftMetadata(contractAddress, nftId, tokenType);
            if (value) {
              if (typeof amount === 'number' && amount > 0) value.amount = amount;
              // Normalize IPFS url for image to keep UI consistent
              value.image = normalizeIpfs(value.image);
            }
            results[current] = value;
          }
        }
        await Promise.all(Array.from({ length: n }, () => worker()));

        const nfts = results.filter((x): x is Nft => !!x);
        return { __offset: offset, __pairs: pairs, __nfts: nfts };
      } finally {
        setAbortSignal(undefined);
      }
    },
  });

  // Flatten and de-duplicate across pages by nft.id
  const pages = query.data?.pages ?? [];
  const all = pages.flatMap((p) => p.__nfts);
  const seen = new Set<string>();
  const nfts: Nft[] = [];
  for (const it of all) {
    const id = it.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    nfts.push(it);
  }

  return {
    nfts,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: !!query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    error: (query.error as Error) ?? null,
  } as const;
}

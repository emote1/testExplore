import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apolloClient as client } from '../apollo-client';
import { useAddressResolver } from './use-address-resolver';
import { NFTS_BY_OWNER_PAGED_QUERY } from '../data/nfts';
import { normalizeIpfs } from '../utils/ipfs';
import { toU64 } from '../utils/number';
import { fetchNftMetadata, setAbortSignal, type Nft } from './use-sqwid-nfts';
import { sleep } from '../utils/time';

export interface UseSqwidNftsInfiniteParams {
  owner: string | null;
  limit?: number; // GraphQL page size
}

type TokenType = 'ERC721' | 'ERC1155';
interface TokenHolderNode {
  id?: string;
  balance?: unknown;
  type?: string | null;
  nftId?: unknown;
  tokenId?: string | null;
  token?: { id?: string; type?: string | null } | null;
}
interface NftsByOwnerPagedQueryVariables {
  owner: string;
  limit: number;
  offset: number;
}

interface PageResult {
  __offset: number;
  __fetchedCount: number;
  __pairs: { contractAddress: string; nftId: string | number; tokenType?: TokenType; amount?: number }[];
  __nfts: Nft[];
}

// Concurrency for per-page metadata fetches
const ENV = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env) ?? {};
const FETCH_CONCURRENCY: number = (() => {
  try {
    const raw = ENV.VITE_FETCH_CONCURRENCY;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 4;
  } catch {
    return 4;
  }
})();
const DEBUG_NFT_FLOW = ENV.VITE_DEBUG_NFT_FLOW === '1' || ENV.VITE_DEBUG_NFT_FLOW === 'true';

export function useSqwidNftsInfinite(params: UseSqwidNftsInfiniteParams) {
  const { owner, limit = 48 } = params;
  const { resolveEvmAddress } = useAddressResolver();
  const [resolvedOwnerLower, setResolvedOwnerLower] = useState<string | null>(null);
  const [isResolvingOwner, setIsResolvingOwner] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const inputAddress = (owner ?? '').trim();
      if (!inputAddress) {
        setResolvedOwnerLower(null);
        setIsResolvingOwner(false);
        return;
      }

      if (/^0x[a-fA-F0-9]{40}$/.test(inputAddress)) {
        setResolvedOwnerLower(inputAddress.toLowerCase());
        setIsResolvingOwner(false);
        return;
      }

      setIsResolvingOwner(true);
      try {
        const evmAddress = await resolveEvmAddress(inputAddress);
        if (!active) return;
        setResolvedOwnerLower(evmAddress ? evmAddress.toLowerCase() : null);
      } catch {
        if (!active) return;
        setResolvedOwnerLower(null);
      } finally {
        if (active) setIsResolvingOwner(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [owner, resolveEvmAddress]);

  const queryKey = useMemo(() => ['sqwidNftsInfinite', resolvedOwnerLower, limit] as const, [resolvedOwnerLower, limit]);

  const query = useInfiniteQuery<PageResult, Error>({
    queryKey,
    enabled: !!resolvedOwnerLower && !isResolvingOwner,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      // Page continuation must depend on raw Hasura rows, not post-processed pairs.
      // Otherwise any filtered/duplicate row can prematurely stop offset pagination.
      const got = lastPage.__fetchedCount;
      if (got < limit) return undefined;
      return lastPage.__offset + got;
    },
    queryFn: async ({ pageParam, signal }) => {
      setAbortSignal(signal);
      try {
        const ownerForHasura = resolvedOwnerLower;
        if (!ownerForHasura) return { __offset: 0, __fetchedCount: 0, __pairs: [], __nfts: [] };

        const offset = typeof pageParam === 'number' ? pageParam : 0;
        // 1) Fetch a page of token holders
        let response: { tokenHolders?: TokenHolderNode[] } | null = null;
        try {
          const { data } = await client.query<{ tokenHolders?: TokenHolderNode[] }, NftsByOwnerPagedQueryVariables>({
            query: NFTS_BY_OWNER_PAGED_QUERY,
            variables: { owner: ownerForHasura, limit, offset },
            fetchPolicy: 'network-only',
            context: { fetchOptions: { signal } },
          });
          response = data;
        } catch (err: unknown) {
          const status = (err as { status?: number; response?: { status?: number } })?.status ?? (err as { response?: { status?: number } })?.response?.status;
          const isTransient = status === 502 || status === 503 || status === 429 || status === 500;
          if (isTransient) {
            await sleep(300);
            const { data } = await client.query<{ tokenHolders?: TokenHolderNode[] }, NftsByOwnerPagedQueryVariables>({
              query: NFTS_BY_OWNER_PAGED_QUERY,
              variables: { owner: ownerForHasura, limit, offset },
              fetchPolicy: 'network-only',
              context: { fetchOptions: { signal } },
            });
            response = data;
          } else {
            throw err as Error;
          }
        }

        const holders = Array.isArray(response?.tokenHolders) ? response!.tokenHolders : [];
        if (DEBUG_NFT_FLOW) {
          console.debug('[NFT][Hasura] token_holders page', {
            owner: ownerForHasura,
            offset,
            limit,
            count: holders.length,
          });
        }
        if (holders.length === 0) return { __offset: offset, __fetchedCount: 0, __pairs: [], __nfts: [] };

        // 2) Map to unique (contract, token) pairs and preserve owned amount
        const seen = new Set<string>();
        const pairs: { contractAddress: string; nftId: string | number; tokenType?: TokenType; amount?: number }[] = [];
        for (const t of holders) {
          const contractId = t?.tokenId ?? t?.token?.id ?? undefined;
          const nftIdRaw = t?.nftId as unknown;
          const nftId = typeof nftIdRaw === 'string' || typeof nftIdRaw === 'number' ? nftIdRaw : undefined;
          const typeRaw = t?.token?.type ?? t?.type ?? undefined;
          const tokenType: TokenType | undefined = typeRaw === 'ERC721' || typeRaw === 'ERC1155' ? typeRaw : undefined;
          const ownedAmount = toU64(t?.balance as unknown, 0);
          if (!contractId || (nftId === undefined || nftId === null)) continue;
          const key = `${contractId}::${nftId}`;
          if (seen.has(key)) continue;
          seen.add(key);
          pairs.push({ contractAddress: contractId, nftId, tokenType, amount: ownedAmount > 0 ? ownedAmount : undefined });
        }

        if (pairs.length === 0) return { __offset: offset, __fetchedCount: holders.length, __pairs: [], __nfts: [] };

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
        if (DEBUG_NFT_FLOW) {
          const withAnyMedia = nfts.filter((it) => !!(it.image || it.media || it.thumbnail)).length;
          const withImage = nfts.filter((it) => !!it.image).length;
          const withMedia = nfts.filter((it) => !!it.media).length;
          const withThumbnail = nfts.filter((it) => !!it.thumbnail).length;
          console.debug('[NFT][Summary] page metadata coverage', {
            owner: ownerForHasura,
            offset,
            pairs: pairs.length,
            nfts: nfts.length,
            withAnyMedia,
            withoutAnyMedia: Math.max(0, nfts.length - withAnyMedia),
            withImage,
            withMedia,
            withThumbnail,
          });
        }
        return { __offset: offset, __fetchedCount: holders.length, __pairs: pairs, __nfts: nfts };
      } finally {
        setAbortSignal(undefined);
      }
    },
  });

  // Flatten and de-duplicate across pages by nft.id
  const nfts = useMemo(() => {
    const pages = query.data?.pages ?? [];
    const all = pages.flatMap((p) => p.__nfts);
    const seen = new Set<string>();
    const deduped: Nft[] = [];
    for (const it of all) {
      const id = it.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      deduped.push(it);
    }
    return deduped;
  }, [query.data?.pages]);

  return {
    nfts,
    isLoading: query.isLoading || isResolvingOwner,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: !!query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    error: (query.error as Error) ?? null,
  } as const;
}

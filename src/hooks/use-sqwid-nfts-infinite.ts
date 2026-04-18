import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apolloClient as client } from '../apollo-client';
import { useAddressResolver } from './use-address-resolver';
import { NFTS_BY_OWNER_PAGED_QUERY, NFT_METADATA_BATCH_QUERY } from '../data/nfts';
import { normalizeIpfs, toIpfsHttp } from '../utils/ipfs';
import { toU64 } from '../utils/number';
import { getString } from '../utils/object';
import { fetchNftMetadata, setAbortSignal, hasuraMetaCache, type Nft } from './use-sqwid-nfts';
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

        // 2.5) Pre-fetch metadata from Hasura nft_metadata in one batch
        try {
          // Only query IDs not already in cache
          const allIds = pairs
            .map(p => `${p.contractAddress.toLowerCase()}-${typeof p.nftId === 'string' ? parseInt(p.nftId, 10) : p.nftId}`)
            .filter(id => hasuraMetaCache.get(id) === undefined);
          if (allIds.length === 0) throw new Error('all cached'); // skip query
          const { data: metaBatch } = await client.query({
            query: NFT_METADATA_BATCH_QUERY,
            variables: { ids: allIds },
            fetchPolicy: 'cache-first',
          });
          const metaRows = Array.isArray(metaBatch?.nft_metadata) ? metaBatch.nft_metadata : [];
          for (const row of metaRows) {
            const meta = row.metadata as Record<string, unknown> | null;
            const metaUri = row.metadata_uri as string | null;
            const rowId = String(row.id);
            if (meta && typeof meta === 'object') {
              const name = getString(meta, ['name']) ?? `Token #${row.token_id}`;
              const image = toIpfsHttp(getString(meta, ['image']) ?? getString(meta, ['image_url']));
              const media = toIpfsHttp(getString(meta, ['animation_url']) ?? getString(meta, ['media']));
              const thumbnail = toIpfsHttp(getString(meta, ['thumbnail']) ?? getString(meta, ['image_preview']));
              const mimetype = getString(meta, ['mimetype']) ?? getString(meta, ['mime_type']);
              if (image || media || thumbnail) {
                hasuraMetaCache.set(rowId, { id: rowId, name, image, media, thumbnail, mimetype } as Nft);
                continue;
              }
            }
            if (metaUri) {
              hasuraMetaCache.set(rowId, { id: rowId, name: `Token #${row.token_id}` } as Nft);
            }
          }
        } catch { /* Hasura batch failed, proceed with individual fetches */ }

        // 3) Resolve metadata: use Hasura cache first, fetch remaining with limited concurrency
        const results: (Nft | null)[] = Array(pairs.length).fill(null);
        const uncachedIndices: number[] = [];

        // First pass: resolve from cache (sync, no async overhead)
        for (let i = 0; i < pairs.length; i++) {
          const { contractAddress, nftId, amount } = pairs[i];
          const cacheId = `${contractAddress.toLowerCase()}-${typeof nftId === 'string' ? parseInt(nftId, 10) : nftId}`;
          const cached = hasuraMetaCache.get(cacheId);
          if (cached) {
            const value = { ...cached };
            if (typeof amount === 'number' && amount > 0) value.amount = amount;
            value.image = normalizeIpfs(value.image);
            results[i] = value;
          } else {
            uncachedIndices.push(i);
          }
        }

        // Second pass: fetch only uncached NFTs with limited concurrency
        if (uncachedIndices.length > 0) {
          const n = Math.min(FETCH_CONCURRENCY, Math.max(1, uncachedIndices.length));
          let idx = 0;
          async function worker() {
            while (idx < uncachedIndices.length) {
              const ui = idx++;
              const current = uncachedIndices[ui];
              const { contractAddress, nftId, tokenType, amount } = pairs[current];
              const value = await fetchNftMetadata(contractAddress, nftId, tokenType);
              if (value) {
                if (typeof amount === 'number' && amount > 0) value.amount = amount;
                value.image = normalizeIpfs(value.image);
              }
              results[current] = value;
            }
          }
          await Promise.all(Array.from({ length: n }, () => worker()));
        }

        const nfts = results.filter((x): x is Nft => !!x);
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

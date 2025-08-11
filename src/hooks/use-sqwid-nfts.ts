import { useState, useEffect, useCallback } from 'react';
import { ApolloClient, InMemoryCache, gql, createHttpLink } from '@apollo/client';

// Define the types for better type-checking
export interface Nft {
  id: string;
  name: string;
  image?: string;
  description?: string;
  attributes?: any[];
  error?: boolean;
  collection?: {
    id: string;
    name: string;
    image?: string;
  };
  [key: string]: any;
}

export interface Collection {
  id: string;
  name: string;
  image?: string;
  itemCount: number;
  [key: string]: any;
}

// Setup Apollo Client
const httpLink = createHttpLink({
  uri: '/graphql',
  fetchOptions: { method: 'POST' },
});

const client = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
});

const NFT_IDS_BY_ACCOUNT_QUERY = gql`
  query NftIdsByAccountQuery($address: String!, $limit: Int!) {
    transfers(
      where: { 
        OR: [{ from: { id_eq: $address } }, { to: { id_eq: $address } }],
        type_in: [ERC1155, ERC721]
      },
      limit: $limit,
      orderBy: timestamp_DESC
    ) {
      nftId
      token {
        id
      }
    }
  }
`;

/**
 * A custom hook to fetch and process NFT data from the Sqwid API for a given address.
 * @param address The Reef chain address of the owner. Can be Substrate or EVM format.
 * @returns An object containing the list of NFTs, collections, loading state, and any errors.
 */
export const useSqwidNfts = (address: string | null) => {
  const [nfts, setNfts] = useState<Nft[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const toIpfsUrl = (ipfsUri: string): string => {
    if (!ipfsUri) return '';
    if (ipfsUri.startsWith('ipfs://')) {
      return `https://reef.infura-ipfs.io/ipfs/${ipfsUri.split('ipfs://')[1]}`;
    }
    return ipfsUri;
  };

  // Helpers: basic sleep and retry for transient errors (e.g., 503)
  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  
  // In-flight de-duplication to coalesce concurrent calls for the same token
  const inflightRef = new Map<string, Promise<Nft | null>>();

  async function fetchMetadataOnce(contractAddress: string, nftId: string | number): Promise<Nft | null> {
    const key = `${contractAddress}-${nftId}`;
    if (inflightRef.has(key)) return inflightRef.get(key)!;

    const task = (async () => {
      const url = `https://sqwid-api-mainnet.reefscan.info/api/v1/metadata/${contractAddress}/${nftId}`;
      const res = await fetch(url, { method: 'GET' });
      if (res.status === 404) return null; // silent skip
      if (!res.ok) {
        const err: any = new Error(`HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }
      const data = await res.json();
      if (!data) return null;
      return { ...data, id: key } as Nft;
    })();

    inflightRef.set(key, task);
    try {
      return await task;
    } finally {
      inflightRef.delete(key);
    }
  }

  async function fetchMetadataWithRetry(contractAddress: string, nftId: string | number, retries = 4): Promise<Nft | null> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fetchMetadataOnce(contractAddress, nftId);
      } catch (err: any) {
        const status = err?.status ?? err?.response?.status;
        const isTransient = status === 503 || status === 502 || status === 429 || status === 500 || !status;
        if (attempt < retries && isTransient) {
          // Exponential backoff with jitter
          const base = 300 * Math.pow(2, attempt); // 300, 600, 1200, 2400...
          const jitter = Math.floor(Math.random() * 200);
          await sleep(base + jitter);
          continue;
        }
        return { id: `${contractAddress}-${nftId}`, name: 'Loading Failed', error: true } as Nft;
      }
    }
    return { id: `${contractAddress}-${nftId}`, name: 'Loading Failed', error: true } as Nft;
  }

  const fetchAndProcessNfts = useCallback(async () => {
      if (!address) {
        setNfts([]);
        setCollections([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data: transferData } = await client.query({
          query: NFT_IDS_BY_ACCOUNT_QUERY,
          variables: { address, limit: 50 },
        });

        if (!transferData || !transferData.transfers || transferData.transfers.length === 0) {
          setNfts([]);
          setCollections([]);
          setIsLoading(false);
          return;
        }

        // Deduplicate by (contract, nftId)
        const uniqueKeys: string[] = Array.from(
          new Set(transferData.transfers.map((t: any) => `${t.token.id}::${t.nftId}`)) as Set<string>
        );
        const uniquePairs = uniqueKeys.map((key: string) => {
          const [contractAddress, nftId] = key.split('::');
          return { contractAddress, nftId };
        });

        // Concurrency limiter to avoid hammering API
        const concurrency = 4;
        const results: PromiseSettledResult<Nft | null>[] = [];
        let index = 0;
        async function worker() {
          while (index < uniquePairs.length) {
            const current = index++;
            const { contractAddress, nftId } = uniquePairs[current];
            const value = await fetchMetadataWithRetry(contractAddress, nftId);
            results[current] = { status: 'fulfilled', value } as PromiseFulfilledResult<Nft | null>;
          }
        }
        const workers = Array.from({ length: Math.min(concurrency, uniquePairs.length) }, () => worker());
        await Promise.all(workers);

        const allNfts = results
          .map((r) => (r.status === 'fulfilled' ? r.value : null))
          .filter((n): n is Nft => n !== null);
        setNfts(allNfts.map(nft => ({ ...nft, image: nft.image ? toIpfsUrl(nft.image) : undefined })));

        // Process NFTs to extract unique collections
        const collectionsMap = new Map<string, Collection>();
        allNfts.forEach(nft => {
          if (nft.collection && nft.collection.id) {
            const existing = collectionsMap.get(nft.collection.id);
            if (existing) {
              existing.itemCount += 1;
            } else {
              collectionsMap.set(nft.collection.id, {
                id: nft.collection.id,
                name: nft.collection.name || 'Unnamed Collection',
                image: nft.collection.image ? toIpfsUrl(nft.collection.image) : (nft.image ? toIpfsUrl(nft.image) : ''),
                itemCount: 1,
              });
            }
          }
        });
        setCollections(Array.from(collectionsMap.values()));

      } catch (err) {
        console.error('Error fetching or processing NFTs:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    }, [address]);

    useEffect(() => {
      fetchAndProcessNfts();
    }, [address, fetchAndProcessNfts]);

  return { nfts, collections, isLoading, error };
};

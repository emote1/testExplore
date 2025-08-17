import { useState, useEffect, useCallback, useRef } from 'react';
import { apolloClient as client } from '../apollo-client';
import { useAddressResolver } from './use-address-resolver';
import { NFTS_BY_OWNER_PAGED_QUERY } from '../data/nfts';
import type { DocumentNode } from 'graphql';


// Define the types for better type-checking
export interface Nft {
  id: string;
  name: string;
  image?: string;
  media?: string;
  thumbnail?: string;
  mimetype?: string;
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

// EVM JSON-RPC endpoint (configurable via env). If endpoint doesn't support EVM, we disable eth_call gracefully.
const EVM_RPC_URL: string = (import.meta as any)?.env?.VITE_REEF_EVM_RPC_URL ?? 'https://rpc.reefscan.com';
// Max number of concurrent prefetch batches (across contracts). Defaults to 16 if not set or invalid.
const PREFETCH_MAX_WORKERS: number = (() => {
  try {
    const raw = (import.meta as any)?.env?.VITE_PREFETCH_MAX_WORKERS;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 16;
  } catch {
    return 16;
  }
})();
// Max number of concurrent metadata fetch workers. Defaults to 12 if not set or invalid.
const FETCH_CONCURRENCY: number = (() => {
  try {
    const raw = (import.meta as any)?.env?.VITE_FETCH_CONCURRENCY;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 12;
  } catch {
    return 12;
  }
})();
let evmRpcHealthy: boolean = false;
let evmRpcChecked = false;
let evmRpcCheckPromise: Promise<boolean> | null = null;
let evmEthCallDisabled = false; // set true if we detect eth_call unsupported (e.g., -32601)
let reefEvmCallDisabled = false; // set true if we detect evm_call unsupported (e.g., -32601)
// Some Reef RPC nodes require a full Block struct instead of a block hash for evm_* calls.
// If eth_call keeps failing or returning 0x, disable it to avoid unnecessary requests
const ETH_CALL_FAIL_THRESHOLD = 3;
let ethCallFailCount = 0;
// Cache for finalized head and blocks to avoid per-token RPCs
let cachedHead: string | null = null;
let cachedHeadTs = 0;
const HEAD_TTL_MS = 60000;
const blockCache = new Map<string, any>();
let headPending: Promise<string | null> | null = null;
const blockPending = new Map<string, Promise<any | null>>();

// Capability probes and caching
let reefEvmSupportChecked = false;
let reefEvmSupported = false;
let reefEvmCheckPromise: Promise<boolean> | null = null;

let ethCallSupportChecked = false;
let ethCallSupported = false;
let ethCallCheckPromise: Promise<boolean> | null = null;

function isHexAddress(addr: string): boolean {
  return typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/.test(addr);
}

async function checkEvmRpcHealth(): Promise<boolean> {
  if (evmRpcChecked) return evmRpcHealthy;
  if (evmRpcCheckPromise) return evmRpcCheckPromise;
  evmRpcCheckPromise = (async () => {
    try {
      const res = await fetch(EVM_RPC_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
      });
      if (!res.ok) {
        evmRpcHealthy = false;
        evmRpcChecked = true;
        return evmRpcHealthy;
      }
      const json = await res.json();
      evmRpcHealthy = typeof json?.result === 'string' && json.result.startsWith('0x');
      evmRpcChecked = true;
      return evmRpcHealthy;
    } catch {
      evmRpcHealthy = false;
      evmRpcChecked = true;
      return false;
    } finally {
      evmRpcCheckPromise = null;
    }
  })();
  return evmRpcCheckPromise;
}

async function checkReefEvmSupport(): Promise<boolean> {
  if (reefEvmSupportChecked) return reefEvmSupported;
  if (reefEvmCheckPromise) return reefEvmCheckPromise;
  reefEvmCheckPromise = (async () => {
    try {
      const res = await fetch(EVM_RPC_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'rpc_methods', params: [] }),
      });
      if (!res.ok) {
        reefEvmSupported = false;
      } else {
        const json = await res.json();
        const result = (json as any)?.result;
        const methods: string[] = Array.isArray(result)
          ? result
          : Array.isArray(result?.methods)
            ? result.methods
            : [];
        reefEvmSupported = methods.includes('evm_call') || methods.includes('evm_estimateResources');
      }
    } catch {
      reefEvmSupported = false;
    } finally {
      reefEvmSupportChecked = true;
      if (!reefEvmSupported) reefEvmCallDisabled = true;
      reefEvmCheckPromise = null;
    }
    return reefEvmSupported;
  })();
  return reefEvmCheckPromise;
}

async function checkEthCallSupport(): Promise<boolean> {
  if (ethCallSupportChecked) return ethCallSupported;
  if (ethCallCheckPromise) return ethCallCheckPromise;
  ethCallCheckPromise = (async () => {
    try {
      const res = await fetch(EVM_RPC_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'rpc_methods', params: [] }),
      });
      if (!res.ok) {
        ethCallSupported = false;
      } else {
        const json = await res.json();
        const result = (json as any)?.result;
        const methods: string[] = Array.isArray(result)
          ? result
          : Array.isArray(result?.methods)
            ? result.methods
            : [];
        ethCallSupported = methods.includes('eth_call');
      }
    } catch {
      ethCallSupported = false;
    } finally {
      ethCallSupportChecked = true;
      if (!ethCallSupported) evmEthCallDisabled = true;
      ethCallCheckPromise = null;
    }
    return ethCallSupported;
  })();
  return ethCallCheckPromise;
}

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
  const { resolveEvmAddress } = useAddressResolver();

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
  
  // In-flight de-duplication to coalesce concurrent calls for the same token (stable across renders)
  const inflightRef = useRef(new Map<string, Promise<Nft | null>>());
  // Cache for Sqwid REST fallback: contract -> (tokenId -> meta)
  const sqwidCacheRef = useRef(new Map<string, Map<string, { name?: string; image?: string; media?: string; thumbnail?: string; mimetype?: string; amount?: number }>>());
  // In-flight fetches per contract to coalesce concurrent by-collection REST requests
  const sqwidPendingRef = useRef(new Map<string, Promise<void>>());
  // Pre-resolved tokenURI cache to avoid repeated RPCs (memory + localStorage TTL)
  const tokenUriCacheRef = useRef(new Map<string, string>());

  function toHex(value: bigint, padBytes = 32): string {
    const hex = value.toString(16);
    return hex.length >= padBytes * 2 ? hex : '0'.repeat(padBytes * 2 - hex.length) + hex;
  }

  function tokenUriCacheKey(contractAddress: string, nftId: string | number): string {
    return `${contractAddress}-${String(nftId)}`;
  }

  const TOKEN_URI_LS_NS = 'reef:tokenURI:';
  const TOKEN_URI_TTL_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

  function getLocalTokenUri(contractAddress: string, nftId: string | number): string | null {
    try {
      const key = TOKEN_URI_LS_NS + tokenUriCacheKey(contractAddress, nftId);
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const obj = JSON.parse(raw) as { uri: string; ts: number } | null;
      if (!obj || !obj.uri || !obj.ts) return null;
      if (Date.now() - obj.ts > TOKEN_URI_TTL_MS) {
        localStorage.removeItem(key);
        return null;
      }
      return obj.uri;
    } catch {
      return null;
    }
  }

  function setLocalTokenUri(contractAddress: string, nftId: string | number, uri: string): void {
    try {
      const key = TOKEN_URI_LS_NS + tokenUriCacheKey(contractAddress, nftId);
      const payload = JSON.stringify({ uri, ts: Date.now() });
      localStorage.setItem(key, payload);
    } catch {
      // ignore quota errors
    }
  }

  async function ethCall(to: string, data: string): Promise<string | null> {
    try {
      // Probe once to avoid spamming an endpoint that does not support EVM JSON-RPC
      if (evmEthCallDisabled) return null;
      if (!ethCallSupportChecked) {
        const ok = await checkEthCallSupport();
        if (!ok) return null;
      }
      if (!(await checkEvmRpcHealth())) return null;
      const res = await fetch(EVM_RPC_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      // Some gateways respond with { error: { code: -32601, message: 'Method not found' } }
      if (json?.error) {
        if (json?.error?.code === -32601) {
          evmEthCallDisabled = true;
          return null;
        }
        // Count other failures; disable after threshold
        ethCallFailCount++;
        if (ethCallFailCount >= ETH_CALL_FAIL_THRESHOLD) evmEthCallDisabled = true;
        return null;
      }
      const result = json?.result as string | undefined;
      if (!result || result === '0x') {
        ethCallFailCount++;
        if (ethCallFailCount >= ETH_CALL_FAIL_THRESHOLD) evmEthCallDisabled = true;
        return null;
      }
      ethCallFailCount = 0;
      return result as string;
    } catch {
      return null;
    }
  }

  // Substrate: get the latest finalized block hash to use as `at` parameter
  async function getFinalizedHead(): Promise<string | null> {
    try {
      // TTL cache to avoid one call per token
      const now = Date.now();
      if (cachedHead && (now - cachedHeadTs) < HEAD_TTL_MS) return cachedHead;
      if (headPending) return await headPending;
      headPending = (async () => {
        try {
          const res = await fetch(EVM_RPC_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'chain_getFinalizedHead', params: [] }),
          });
          if (!res.ok) return null;
          const json = await res.json();
          const head = json?.result as string | undefined;
          const ok = typeof head === 'string' && head.startsWith('0x');
          if (ok) {
            cachedHead = head!;
            cachedHeadTs = Date.now();
            return head!;
          }
          return null;
        } catch {
          return null;
        }
      })();
      const head = await headPending;
      headPending = null;
      return head;
    } catch {
      return null;
    }
  }

  // Substrate: get the full block object for a given block hash
  async function getBlock(at: string): Promise<any | null> {
    try {
      if (blockCache.has(at)) return blockCache.get(at);
      if (blockPending.has(at)) return await blockPending.get(at)!;
      const pending = (async () => {
        try {
          const res = await fetch(EVM_RPC_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'chain_getBlock', params: [at] }),
          });
          if (!res.ok) return null;
          const json = await res.json();
          const block = (json as any)?.result?.block ?? (json as any)?.result ?? null;
          if (block) blockCache.set(at, block);
          return block ?? null;
        } catch {
          return null;
        } finally {
          blockPending.delete(at);
        }
      })();
      blockPending.set(at, pending);
      return await pending;
    } catch {
      return null;
    }
  }

  function toU64(value: unknown, fallback = 0): number {
    try {
      if (value === null || value === undefined) return fallback;
      if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value));
      if (typeof value === 'string') {
        const v = value.startsWith('0x') ? Number.parseInt(value.slice(2), 16) : Number.parseInt(value, 10);
        return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : fallback;
      }
      // objects like BN? Best-effort via valueOf
      const v2 = Number(value as any);
      return Number.isFinite(v2) ? Math.max(0, Math.floor(v2)) : fallback;
    } catch {
      return fallback;
    }
  }

  // Reef-specific RPC: evm_call (Frontier-style, but under `evm_*` namespace on Reef)
  async function reefEstimateResources(to: string, data: string): Promise<{ gasLimit?: number; storageLimit?: number } | null> {
    try {
      if (reefEvmCallDisabled) return null;
      if (!reefEvmSupportChecked) {
        const ok = await checkReefEvmSupport();
        if (!ok) return null;
      }
      const baseReq = {
        from: '0x0000000000000000000000000000000000000000',
        to,
        value: 0,
        data,
      } as const;
      const at = await getFinalizedHead();
      if (!at) return null;
      const block0 = await getBlock(at);
      if (!block0) return null;
      const secondParam: any = block0;
      const res = await fetch(EVM_RPC_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'evm_estimateResources', params: [baseReq, secondParam] }),
      });
      if (!res.ok) return null;
      let json = await res.json();
      if (json?.error) {
        const code = json?.error?.code;
        if (code === -32601) {
          reefEvmCallDisabled = true;
        }
        // Already passed Block; no retry path needed for -32602
        return null;
      }
      const result = json?.result ?? {};
      // Accept a variety of shapes across Frontier forks
      const gasRaw = (result as any).gasLimit ?? (result as any).gas_limit ?? (result as any).gas;
      const storRaw = (result as any).storageLimit ?? (result as any).storage_limit ?? (result as any).storage ?? 0;
      const gas = toU64(gasRaw, 8_000_000);
      const storage = toU64(storRaw, 0);
      return { gasLimit: gas, storageLimit: storage };
    } catch {
      return null;
    }
  }

  // Reef-specific RPC: evm_call (Frontier-style, but under `evm_*` namespace on Reef)
  async function reefEvmCall(to: string, data: string): Promise<string | null> {
    try {
      if (reefEvmCallDisabled) return null;
      if (!reefEvmSupportChecked) {
        const ok = await checkReefEvmSupport();
        if (!ok) return null;
      }
      // Start with conservative defaults; only estimate if call fails for resource reasons
      let gasLimit = 8_000_000;
      let storageLimit = 0;
      const callReq = {
        from: '0x0000000000000000000000000000000000000000',
        to,
        gasLimit,
        storageLimit,
        value: 0,
        data,
      } as const;
      const at = await getFinalizedHead();
      if (!at) return null;
      // Require Block struct; skip call entirely if not available to avoid -32602
      const block0 = await getBlock(at);
      if (!block0) return null;
      const secondParam: any = block0;
      const res = await fetch(EVM_RPC_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // `evm_call` takes CallRequest and an `at` block hash (or some nodes expect a full Block struct)
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'evm_call', params: [callReq, secondParam] }),
      });
      if (!res.ok) return null;
      let json = await res.json();
      if (json?.error) {
        const code = json?.error?.code;
        const msg = String(json?.error?.message ?? '');
        if (code === -32601) {
          reefEvmCallDisabled = true;
          return null;
        }
        // If error suggests resource limits, try estimating and retry once
        if (/gas|resource|storage/i.test(msg)) {
          const est = await reefEstimateResources(to, data).catch(() => null);
          if (est && (est.gasLimit || est.storageLimit !== undefined)) {
            gasLimit = est.gasLimit ?? gasLimit;
            storageLimit = est.storageLimit ?? storageLimit;
            const callReq2 = { ...callReq, gasLimit, storageLimit } as const;
            const res3 = await fetch(EVM_RPC_URL, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'evm_call', params: [callReq2, secondParam] }),
            });
            if (!res3.ok) return null;
            const json3 = await res3.json();
            if (json3?.error) return null;
            const result3 = json3?.result as string | undefined;
            if (!result3 || result3 === '0x') return null;
            return result3;
          }
        }
        return null;
      }
      const result = json?.result as string | undefined;
      if (!result || result === '0x') return null;
      return result as string;
    } catch {
      return null;
    }
  }

  // Batched version of evm_call for many inputs to the same contract. Falls back silently if batch unsupported.
  async function reefEvmCallBatch(to: string, datas: string[]): Promise<(string | null)[]> {
    const results: (string | null)[] = Array(datas.length).fill(null);
    try {
      if (reefEvmCallDisabled || datas.length === 0) return results;
      if (!reefEvmSupportChecked) {
        const ok = await checkReefEvmSupport();
        if (!ok) return results;
      }
      const at = await getFinalizedHead();
      if (!at) return results;
      const block0 = await getBlock(at);
      if (!block0) return results;
      const secondParam: any = block0;

      const gasLimit = 8_000_000;
      const storageLimit = 0;
      const batch = datas.map((data, i) => ({
        jsonrpc: '2.0',
        id: i + 1,
        method: 'evm_call',
        params: [
          { from: '0x0000000000000000000000000000000000000000', to, gasLimit, storageLimit, value: 0, data },
          secondParam,
        ],
      }));

      const res = await fetch(EVM_RPC_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(batch),
      });
      if (!res.ok) return results;
      const json = await res.json();
      if (!Array.isArray(json)) return results; // batch not supported or proxied

      // Map by id back to index
      for (const item of json) {
        const id = (item?.id ?? 0) as number;
        const idx = Math.max(0, Math.min(datas.length - 1, id - 1));
        if (item?.error) {
          const code = item?.error?.code;
          if (code === -32601) reefEvmCallDisabled = true;
          results[idx] = null;
        } else {
          const r = item?.result as string | undefined;
          results[idx] = !r || r === '0x' ? null : r;
        }
      }
      return results;
    } catch {
      return results;
    }
  }

  function decodeAbiString(hex: string): string | null {
    try {
      if (!hex || hex.length < 2) return null;
      // Strip 0x
      const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
      // ABI dynamic string: 32 bytes offset, 32 bytes length, then data
      if (clean.length < 64 * 2) return null;
      const offset = parseInt(clean.slice(0, 64), 16);
      const lenPos = (offset) * 2; // offset is in bytes
      const length = parseInt(clean.slice(lenPos, lenPos + 64), 16);
      const dataPos = lenPos + 64;
      const dataHex = clean.slice(dataPos, dataPos + length * 2);
      const bytes = new Uint8Array(dataHex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
      return new TextDecoder().decode(bytes);
    } catch {
      return null;
    }
  }

  function toIpfsHttp(uri?: string | null): string | undefined {
    if (!uri) return undefined;
    if (uri.startsWith('ipfs://')) return `https://reef.infura-ipfs.io/ipfs/${uri.slice('ipfs://'.length)}`;
    return uri;
  }

  // Support inline metadata: data:application/json;base64,<...> or URL-encoded JSON
  function parseDataUrlJson(dataUrl: string): any | null {
    try {
      if (!dataUrl || !dataUrl.startsWith('data:')) return null;
      const comma = dataUrl.indexOf(',');
      if (comma < 0) return null;
      const meta = dataUrl.slice(5, comma); // between 'data:' and comma
      const payload = dataUrl.slice(comma + 1);
      const isBase64 = /;base64/i.test(meta);
      const decoded = isBase64 ? atob(payload) : decodeURIComponent(payload);
      const json = JSON.parse(decoded);
      return json;
    } catch {
      return null;
    }
  }

  function isLikelyRpcEndpoint(uri: string): boolean {
    try {
      const u = new URL(uri);
      return /rpc\.reefscan\.com/i.test(u.hostname) || /\/rpc(\/|$)/i.test(u.pathname);
    } catch {
      return false;
    }
  }

  // Fallback: fetch marketplace items by collection (contract) once and cache
  async function getSqwidMeta(contractAddress: string, nftId: string | number): Promise<{ name?: string; image?: string; media?: string; thumbnail?: string; mimetype?: string; amount?: number } | null> {
    try {
      const tokenIdKey = String(nftId);
      const cache = sqwidCacheRef.current;
      let contractMap = cache.get(contractAddress);
      if (!contractMap) {
        // Coalesce concurrent fetches for the same contract
        let pending = sqwidPendingRef.current.get(contractAddress);
        if (!pending) {
          pending = (async () => {
            const limit = 200;
            const startFrom = 0;
            const url = `https://sqwid-api-mainnet.reefscan.info/get/marketplace/by-collection/${contractAddress}/0?limit=${limit}&startFrom=${startFrom}`;
            const res = await fetch(url, { headers: { accept: 'application/json' } });
            if (!res.ok) return;
            const json = await res.json().catch(() => null);
            const items = Array.isArray((json as any)?.items) ? (json as any).items : [];
            const map = new Map<string, { name?: string; image?: string; media?: string; thumbnail?: string; mimetype?: string; amount?: number }>();
            for (const it of items) {
              const rawTokenId: any = it?.tokenId ?? it?.itemId ?? it?.id;
              if (rawTokenId === undefined || rawTokenId === null) continue;
              const tid = String(rawTokenId);
              const rawImage = it?.meta?.image ?? it?.image ?? it?.meta?.thumbnail;
              const rawMedia = it?.meta?.media ?? it?.media ?? it?.meta?.animation_url ?? it?.animation_url;
              const rawThumb = it?.meta?.thumbnail ?? it?.thumbnail ?? it?.meta?.image_preview;
              const name = it?.meta?.name ?? it?.name;
              const image = toIpfsHttp(rawImage);
              const media = toIpfsHttp(rawMedia);
              const thumbnail = toIpfsHttp(rawThumb);
              const mimetype = it?.meta?.mimetype ?? it?.mimetype ?? it?.meta?.mimeType;
              const rawAmt: any = (it as any)?.amount ?? (it as any)?.state?.amount;
              const parsed = typeof rawAmt === 'string' ? Number(rawAmt) : rawAmt;
              const amount = typeof parsed === 'number' && !Number.isNaN(parsed) ? parsed : undefined;
              map.set(tid, { name, image, media, thumbnail, mimetype, amount });
            }
            cache.set(contractAddress, map);
          })();
          sqwidPendingRef.current.set(contractAddress, pending);
        }
        await pending;
        sqwidPendingRef.current.delete(contractAddress);
        contractMap = cache.get(contractAddress);
      }
      if (!contractMap) {
        contractMap = new Map<string, { name?: string; image?: string; media?: string; thumbnail?: string; mimetype?: string; amount?: number }>();
        cache.set(contractAddress, contractMap);
      }
      const hit = contractMap.get(tokenIdKey) ?? contractMap.get(String(Number(tokenIdKey)));
      return hit ?? null;
    } catch {
      return null;
    }
  }

  async function resolveTokenURI(contractAddress: string, nftId: string | number, tokenType?: string): Promise<string | null> {
    // Ensure we only call RPC for valid EVM addresses; otherwise go straight to fallback
    if (!isHexAddress(contractAddress)) return null;
    // Try cache (memory/localStorage) first
    const cached = tokenUriCacheRef.current.get(tokenUriCacheKey(contractAddress, nftId))
      ?? getLocalTokenUri(contractAddress, nftId);
    if (cached) return cached;
    const idBig = BigInt(typeof nftId === 'string' ? (nftId.startsWith('0x') ? BigInt(nftId).toString() : nftId) : nftId);
    const arg = toHex(BigInt(idBig));
    // Selectors
    const sel721 = '0xc87b56dd'; // tokenURI(uint256)
    const sel1155 = '0x0e89341c'; // uri(uint256)

    async function tryCall(selector: string): Promise<string | null> {
      const data = selector + arg;
      const result = await ethCall(contractAddress, data);
      if (!result) {
        const r2 = await reefEvmCall(contractAddress, data);
        if (!r2) return null;
        const value = decodeAbiString(r2);
        if (value) {
          tokenUriCacheRef.current.set(tokenUriCacheKey(contractAddress, nftId), value);
          setLocalTokenUri(contractAddress, nftId, value);
        }
        return value;
      }
      const value = decodeAbiString(result);
      if (value) {
        tokenUriCacheRef.current.set(tokenUriCacheKey(contractAddress, nftId), value);
        setLocalTokenUri(contractAddress, nftId, value);
      }
      return value;
    }

    if (tokenType === 'ERC721') {
      return tryCall(sel721);
    }
    if (tokenType === 'ERC1155') {
      return tryCall(sel1155);
    }
    // Unknown: try ERC721, then ERC1155
    return (await tryCall(sel721)) ?? (await tryCall(sel1155));
  }

  function applyErc1155Template(uri: string, nftId: string | number): string {
    // {id} must be 64-lowercase-hex padded
    const id = BigInt(typeof nftId === 'string' ? nftId : Number(nftId));
    const hexId = toHex(id).toLowerCase();
    return uri.replace('{id}', hexId).replace('{ID}', hexId);
  }

  async function fetchMetadataOnce(contractAddress: string, nftId: string | number, tokenType?: string): Promise<Nft | null> {
    const key = `${contractAddress}-${nftId}`;
    if (inflightRef.current.has(key)) return inflightRef.current.get(key)!;

    const task = (async () => {
      // 0) Fast path: try Sqwid REST first to avoid unnecessary RPC
      const sqwidQuick = await getSqwidMeta(contractAddress, nftId);
      if (sqwidQuick && (sqwidQuick.image || sqwidQuick.media || sqwidQuick.thumbnail || sqwidQuick.name)) {
        const name = sqwidQuick.name ?? `Token #${nftId}`;
        const image = sqwidQuick.image;
        const media = sqwidQuick.media;
        const thumbnail = sqwidQuick.thumbnail;
        const mimetype = sqwidQuick.mimetype;
        const amount = (sqwidQuick as any)?.amount;
        return { id: key, name, image, media, thumbnail, mimetype, amount } as Nft;
      }

      // 1) Resolve tokenURI/uri via RPC (skips if RPC unavailable)
      let tokenUri = await resolveTokenURI(contractAddress, nftId, tokenType);
      if (!tokenUri) {
        // Try Sqwid REST fallback first
        const sqwid = await getSqwidMeta(contractAddress, nftId);
        if (sqwid) {
          const name = sqwid.name ?? `Token #${nftId}`;
          const image = sqwid.image;
          const media = sqwid.media;
          const thumbnail = sqwid.thumbnail;
          const mimetype = sqwid.mimetype;
          const amount = (sqwid as any)?.amount;
          return { id: key, name, image, media, thumbnail, mimetype, amount } as Nft;
        }
        // Otherwise, render minimal placeholder so UI still shows the token
        return { id: key, name: `Token #${nftId}` } as Nft;
      }
      // Handle inline metadata URIs without extra network requests
      if (tokenUri.startsWith('data:')) {
        const meta = parseDataUrlJson(tokenUri);
        if (meta && typeof meta === 'object') {
          const name = (meta as any).name ?? `Token #${nftId}`;
          const image = toIpfsHttp((meta as any).image ?? (meta as any).image_url ?? (meta as any).thumbnail);
          const media = toIpfsHttp((meta as any).media ?? (meta as any).animation_url ?? (meta as any).animation);
          const thumbnail = toIpfsHttp((meta as any).thumbnail ?? (meta as any).image_preview ?? (meta as any).image_small ?? (meta as any).preview_image);
          const mimetype = (meta as any).mimetype ?? (meta as any).mime_type ?? (meta as any).mimeType ?? (meta as any).format;
          return { id: key, name, image, media, thumbnail, mimetype } as Nft;
        }
        return { id: key, name: `Token #${nftId}` } as Nft;
      }
      // ERC1155 templates may include {id}
      if (tokenUri.includes('{id}') || tokenUri.includes('{ID}')) {
        tokenUri = applyErc1155Template(tokenUri, nftId);
      }
      const httpUri = toIpfsHttp(tokenUri);
      if (!httpUri || isLikelyRpcEndpoint(httpUri)) {
        const sqwid = await getSqwidMeta(contractAddress, nftId);
        if (sqwid) {
          const name = sqwid.name ?? `Token #${nftId}`;
          const image = sqwid.image;
          const media = sqwid.media;
          const thumbnail = sqwid.thumbnail;
          const mimetype = sqwid.mimetype;
          const amount = (sqwid as any)?.amount;
          return { id: key, name, image, media, thumbnail, mimetype, amount } as Nft;
        }
        return { id: key, name: `Token #${nftId}` } as Nft;
      }
      // 2) Fetch metadata JSON
      const resp = await fetch(httpUri, { method: 'GET' });
      if (!resp.ok) {
        const sqwid = await getSqwidMeta(contractAddress, nftId);
        if (sqwid) return { id: key, name: sqwid.name ?? `Token #${nftId}`, image: sqwid.image, media: sqwid.media, thumbnail: sqwid.thumbnail, mimetype: sqwid.mimetype } as Nft;
        return { id: key, name: `Token #${nftId}` } as Nft;
      }
      const json = await resp.json().catch(() => null);
      if (!json || typeof json !== 'object') {
        const sqwid = await getSqwidMeta(contractAddress, nftId);
        if (sqwid) return { id: key, name: sqwid.name ?? `Token #${nftId}`, image: sqwid.image, media: sqwid.media, thumbnail: sqwid.thumbnail, mimetype: sqwid.mimetype, amount: (sqwid as any)?.amount } as Nft;
        return { id: key, name: `Token #${nftId}` } as Nft;
      }
      const name = (json as any).name ?? `Token #${nftId}`;
      const image = toIpfsHttp((json as any).image ?? (json as any).image_url ?? (json as any).thumbnail);
      const media = toIpfsHttp((json as any).media ?? (json as any).animation_url ?? (json as any).animation);
      const thumbnail = toIpfsHttp((json as any).thumbnail ?? (json as any).image_preview ?? (json as any).image_small ?? (json as any).preview_image);
      const mimetype = (json as any).mimetype ?? (json as any).mime_type ?? (json as any).mimeType ?? (json as any).format;
      return { id: key, name, image, media, thumbnail, mimetype } as Nft;
    })();

    inflightRef.current.set(key, task);
    try {
      return await task;
    } finally {
      inflightRef.current.delete(key);
    }
  }

  async function fetchMetadataWithRetry(contractAddress: string, nftId: string | number, tokenType?: string, retries = 2): Promise<Nft | null> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fetchMetadataOnce(contractAddress, nftId, tokenType);
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

  const fetchAndProcessNfts = useCallback(
    async (inputAddress: string, isCanceled: () => boolean) => {
      if (!inputAddress) {
        if (isCanceled()) return;
        setNfts([]);
        setCollections([]);
        setIsLoading(false);
        setError(null);
        return;
      }

      if (!isCanceled()) setIsLoading(true);
      if (!isCanceled()) setError(null);

      try {
        const evmAddress = await resolveEvmAddress(inputAddress);
        if (!evmAddress) {
          if (isCanceled()) return;
          setNfts([]);
          setCollections([]);
          setIsLoading(false);
          return;
        }

        // Page through tokenHolders to stay under Squid size limits
        const pageSize = 100; // keep each response small
        const maxPairs = 300;  // safety cap to avoid hammering downstream metadata API
        const seen = new Set<string>();
        const uniquePairs: { contractAddress: string; nftId: string | number; tokenType?: string }[] = [];
        let offset = 0;
        // Limit number of pages to avoid unbounded loops (e.g., 10 pages x 100 = 1000 max scan, but we cap by maxPairs)
        for (let page = 0; page < 10; page++) {
          const { data } = await client.query({
            query: NFTS_BY_OWNER_PAGED_QUERY as unknown as DocumentNode,
            variables: { owner: evmAddress, limit: pageSize, offset },
            fetchPolicy: 'network-only',
          });
          const batch = (data as any)?.tokenHolders ?? [];
          if (!Array.isArray(batch) || batch.length === 0) break;

          for (const t of batch) {
            const contractId = t?.token?.id as string | undefined;
            const nftId = t?.nftId as string | number | undefined;
            const tokenType = t?.token?.type as string | undefined;
            if (!contractId || (nftId === undefined || nftId === null)) continue;
            const key = `${contractId}::${nftId}`;
            if (!seen.has(key)) {
              seen.add(key);
              uniquePairs.push({ contractAddress: contractId, nftId, tokenType });
            }
            if (uniquePairs.length >= maxPairs) break;
          }

          if (uniquePairs.length >= maxPairs) break;
          offset += batch.length;
          if (isCanceled()) return;
        }

        if (uniquePairs.length === 0) {
          if (isCanceled()) return;
          setNfts([]);
          setCollections([]);
          setIsLoading(false);
          return;
        }

        // Preflight RPC support once to avoid first-try errors under parallelism
        await checkEvmRpcHealth();
        await checkEthCallSupport();
        await checkReefEvmSupport();

        // Prefetch tokenURIs in batches per contract for known token types
        try {
          const byContract = new Map<string, { nftId: string | number; tokenType?: string }[]>();
          for (const p of uniquePairs) {
            const list = byContract.get(p.contractAddress) ?? [];
            list.push({ nftId: p.nftId, tokenType: p.tokenType });
            byContract.set(p.contractAddress, list);
          }
          // For each contract: build batch for tokens with known type and no cache/REST hit
          const prefetchTasks: Array<() => Promise<void>> = [];
          for (const [contract, items] of byContract) {
            prefetchTasks.push(async () => {
              // Ensure REST cache is warmed once per contract
              try { await getSqwidMeta(contract, items[0]?.nftId ?? '0'); } catch {}
              const known = items.filter(it => it.tokenType === 'ERC721' || it.tokenType === 'ERC1155');
              if (known.length === 0) return;
              const datas: string[] = [];
              const keys: (string | number)[] = [];
              for (const it of known) {
                const key = tokenUriCacheKey(contract, it.nftId);
                if (tokenUriCacheRef.current.has(key) || getLocalTokenUri(contract, it.nftId)) continue;
                const idBig = BigInt(typeof it.nftId === 'string' ? (it.nftId.startsWith('0x') ? BigInt(it.nftId).toString() : it.nftId) : it.nftId);
                const arg = toHex(idBig);
                const sel = it.tokenType === 'ERC1155' ? '0x0e89341c' : '0xc87b56dd';
                datas.push(sel + arg);
                keys.push(it.nftId);
              }
              if (datas.length === 0) return;
              const batchRes = await reefEvmCallBatch(contract, datas);
              for (let i = 0; i < batchRes.length; i++) {
                const r = batchRes[i];
                if (!r) continue;
                const decoded = decodeAbiString(r);
                if (!decoded) continue;
                const nftId = keys[i];
                const cacheKey = tokenUriCacheKey(contract, nftId);
                tokenUriCacheRef.current.set(cacheKey, decoded);
                setLocalTokenUri(contract, nftId, decoded);
              }
            });
          }
          // Concurrency-limited execution of prefetch tasks across contracts
          let pIndex = 0;
          async function prefetchWorker() {
            while (pIndex < prefetchTasks.length) {
              const current = pIndex++;
              try { await prefetchTasks[current](); } catch {}
            }
          }
          const prefetchConcurrency = Math.max(1, Math.min(PREFETCH_MAX_WORKERS, prefetchTasks.length));
          await Promise.all(Array.from({ length: prefetchConcurrency }, () => prefetchWorker()));
        } catch {}

        // Concurrency limiter to avoid hammering API
        const concurrency = FETCH_CONCURRENCY;
        const results: PromiseSettledResult<Nft | null>[] = [];
        let index = 0;
        async function worker() {
          while (index < uniquePairs.length) {
            const current = index++;
            const { contractAddress, nftId, tokenType } = uniquePairs[current];
            const value = await fetchMetadataWithRetry(contractAddress, nftId, tokenType);
            results[current] = { status: 'fulfilled', value } as PromiseFulfilledResult<Nft | null>;
          }
        }
        const workers = Array.from({ length: Math.min(concurrency, uniquePairs.length) }, () => worker());
        await Promise.all(workers);

        const allNfts = results
          .map((r) => (r.status === 'fulfilled' ? (r as PromiseFulfilledResult<Nft | null>).value : null))
          .filter((n): n is Nft => n !== null);

        if (isCanceled()) return;
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

        if (isCanceled()) return;
        setCollections(Array.from(collectionsMap.values()));
      } catch (err) {
        console.error('Error fetching or processing NFTs:', err);
        if (!isCanceled()) setError(err as Error);
      } finally {
        if (!isCanceled()) setIsLoading(false);
      }
    },
    [resolveEvmAddress]
  );

    useEffect(() => {
      let canceled = false;
      const isCanceled = () => canceled;
      fetchAndProcessNfts(address ?? '', isCanceled);
      return () => {
        canceled = true;
      };
    }, [address, fetchAndProcessNfts]);

  return { nfts, collections, isLoading, error };
};

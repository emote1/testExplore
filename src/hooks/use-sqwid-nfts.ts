import { useQuery } from '@tanstack/react-query';
import { apolloClient as client } from '../apollo-client';
import { useAddressResolver } from './use-address-resolver';
import { NFTS_BY_OWNER_PAGED_QUERY } from '../data/nfts';
import { normalizeIpfs, toIpfsHttp, fetchIpfsWithFallback, isIpfsLike } from '../utils/ipfs';
import { TtlCache } from '../data/ttl-cache';
import { toU64 } from '../utils/number';
import { sleep } from '../utils/time';
import { get, getString, getNumber } from '../utils/object';
import { parseDataUrlJson } from '../utils/data-url';
import { toHex, decodeAbiString, applyErc1155Template } from '../utils/abi';
import { isLikelyRpcEndpoint } from '../utils/url';
import { isValidEvmAddressFormat } from '../utils/address-helpers';
import type { NftsByOwnerPagedQuery, NftsByOwnerPagedQueryVariables } from '@/gql/graphql';

// Define the types for better type-checking
interface NftAttribute {
  trait_type?: string;
  value?: string | number | boolean | null;
  display_type?: string;
  [key: string]: unknown;
}

type Json = null | boolean | number | string | Json[] | { [prop: string]: Json };

export interface Nft {
  id: string;
  name: string;
  image?: string;
  media?: string;
  thumbnail?: string;
  mimetype?: string;
  description?: string;
  attributes?: NftAttribute[];
  amount?: number;
  error?: boolean;
  collection?: {
    id: string;
    name: string;
    image?: string;
  };
  [key: string]: unknown;
}

// Sqwid REST fallback metadata (unified shape)
interface SqwidMeta {
  name?: string;
  image?: string;
  media?: string;
  thumbnail?: string;
  mimetype?: string;
  amount?: number;
}

// Module-level TTL caches (singletons shared across hook instances)
const TOKEN_URI_TTL_MS = 2 * 24 * 60 * 60 * 1000; // 2 days
const SQWID_META_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

const tokenUriTtl = new TtlCache<string>({
  namespace: 'reef:tokenURI',
  defaultTtlMs: TOKEN_URI_TTL_MS,
  persist: true,
  maxSize: 10000,
});

const sqwidMetaTtl = new TtlCache<SqwidMeta>({
  namespace: 'reef:sqwidMeta',
  defaultTtlMs: SQWID_META_TTL_MS,
  persist: true,
  maxSize: 20000,
});

export function clearSqwidNftCaches(): void {
  tokenUriTtl.clear();
  sqwidMetaTtl.clear();
}

export function pruneSqwidNftCaches(): void {
  tokenUriTtl.pruneExpired();
  sqwidMetaTtl.pruneExpired();
}

// Cross-hook in-flight de-duplication maps (module-level singletons)
const inflight = new Map<string, Promise<Nft | null>>();
const sqwidPending = new Map<string, Promise<void>>();

export interface Collection {
  id: string;
  name: string;
  image?: string;
  itemCount: number;
  [key: string]: unknown;
}

// EVM JSON-RPC endpoint (configurable via env). If endpoint doesn't support EVM, we disable eth_call gracefully.
const ENV = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env) ?? {};
const EVM_RPC_URL: string = ENV.VITE_REEF_EVM_RPC_URL ?? 'https://rpc.reefscan.com';
// Max number of concurrent prefetch batches (across contracts). Defaults to 16 if not set or invalid.
const PREFETCH_MAX_WORKERS: number = (() => {
  try {
    const raw = ENV.VITE_PREFETCH_MAX_WORKERS;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 16;
  } catch {
    return 16;
  }
})();
// Max number of concurrent metadata fetch workers. Defaults to 12 if not set or invalid.
const FETCH_CONCURRENCY: number = (() => {
  try {
    const raw = ENV.VITE_FETCH_CONCURRENCY;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 12;
  } catch {
    return 12;
  }
})();
let evmRpcHealthy: boolean = false;
let evmRpcChecked = false;
let evmRpcCheckPromise: Promise<boolean> | null = null;
let evmEthCallDisabled = false; // disabled when endpoint is Substrate-like
let reefEvmCallDisabled = false; // disabled when endpoint is Ethereum-like
// Some Reef RPC nodes require a full Block struct instead of a block hash for evm_* calls.
// If eth_call keeps failing or returning 0x, disable it to avoid unnecessary requests
const ETH_CALL_FAIL_THRESHOLD = 3;
let ethCallFailCount = 0;
// Cache for finalized head and blocks to avoid per-token RPCs
let cachedHead: string | null = null;
let cachedHeadTs = 0;
const HEAD_TTL_MS = 60000;
const blockCache = new Map<string, unknown>();
let headPending: Promise<string | null> | null = null;
const blockPending = new Map<string, Promise<unknown | null>>();

// Capability probes and caching
let reefEvmSupportChecked = false;
let reefEvmSupported = false;
let reefEvmCheckPromise: Promise<boolean> | null = null;

let ethCallSupportChecked = false;
let ethCallSupported = false;
let ethCallCheckPromise: Promise<boolean> | null = null;

function detectEndpointKind(url: string): 'substrate' | 'ethereum' {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    // Heuristics: reefscan RPC is Substrate. Common ETH providers won't have 'reefscan'.
    const substrateLikely = /reefscan\.com$/i.test(host) || /rpc/i.test(host);
    return substrateLikely ? 'substrate' : 'ethereum';
  } catch {
    return 'substrate';
  }
}

const ENDPOINT_KIND = detectEndpointKind(EVM_RPC_URL);
// Pre-disable unsupported families to avoid probing unsupported methods
evmEthCallDisabled = ENDPOINT_KIND !== 'ethereum';
reefEvmCallDisabled = ENDPOINT_KIND !== 'substrate';

// Shared AbortSignal for the current query run (set by useQuery's queryFn)
let currentAbortSignal: AbortSignal | undefined;
export function setAbortSignal(sig?: AbortSignal): void {
  currentAbortSignal = sig;
}
function getAbortSignal(): AbortSignal | undefined {
  return currentAbortSignal;
}
function fetchWithAbort(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const signal = getAbortSignal();
  const options = signal ? { ...(init ?? {}), signal } : (init ?? {});
  return fetch(input as RequestInfo, options);
}

async function checkEvmRpcHealth(): Promise<boolean> {
  if (evmRpcChecked) return evmRpcHealthy;
  if (evmRpcCheckPromise) return evmRpcCheckPromise;
  evmRpcCheckPromise = (async () => {
    try {
      if (ENDPOINT_KIND === 'ethereum') {
        const res = await fetchWithAbort(EVM_RPC_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
        });
        if (!res.ok) {
          evmRpcHealthy = false;
          evmRpcChecked = true;
          return false;
        }
        const json = await res.json().catch(() => null);
        const j = json as { result?: unknown };
        evmRpcHealthy = typeof j.result === 'string' && (j.result as string).startsWith('0x');
        evmRpcChecked = true;
        return evmRpcHealthy;
      } else {
        const res2 = await fetchWithAbort(EVM_RPC_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'chain_getFinalizedHead', params: [] }),
        });
        if (!res2.ok) {
          evmRpcHealthy = false;
          evmRpcChecked = true;
          return false;
        }
        const json2 = await res2.json().catch(() => null);
        const j2 = json2 as { result?: unknown };
        const head = typeof j2.result === 'string' ? j2.result : undefined;
        evmRpcHealthy = typeof head === 'string' && head.startsWith('0x');
        evmRpcChecked = true;
        return evmRpcHealthy;
      }
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
      // Avoid probing unsupported method lists; infer from endpoint kind
      reefEvmSupported = ENDPOINT_KIND === 'substrate';
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
      // Avoid unsupported probes; assume eth_call only on Ethereum-like endpoints
      ethCallSupported = ENDPOINT_KIND === 'ethereum';
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

// helpers moved to src/utils (time, object)

function getHttpStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    const s = e['status'];
    if (typeof s === 'number') return s;
    const resp = e['response'];
    if (resp && typeof resp === 'object') {
      const rs = (resp as Record<string, unknown>)['status'];
      if (typeof rs === 'number') return rs;
    }
  }
  return undefined;
}

// parseDataUrlJson moved to src/utils/data-url

// isLikelyRpcEndpoint moved to src/utils/url

// toHex moved to src/utils/abi

function tokenUriCacheKey(contractAddress: string, nftId: string | number): string {
  return `${contractAddress}-${String(nftId)}`;
}

function readTokenUriCache(contractAddress: string, nftId: string | number): string | null {
  return tokenUriTtl.get(tokenUriCacheKey(contractAddress, nftId));
}

function writeTokenUriCache(contractAddress: string, nftId: string | number, uri: string): void {
  tokenUriTtl.set(tokenUriCacheKey(contractAddress, nftId), uri);
}

// Substrate: get the latest finalized block hash to use as `at` parameter
async function getFinalizedHead(): Promise<string | null> {
  try {
    const now = Date.now();
    if (cachedHead && (now - cachedHeadTs) < HEAD_TTL_MS) return cachedHead;
    if (headPending) return await headPending;
    headPending = (async () => {
      try {
        const res = await fetchWithAbort(EVM_RPC_URL, {
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
async function getBlock(at: string): Promise<unknown | null> {
  try {
    if (blockCache.has(at)) return blockCache.get(at);
    if (blockPending.has(at)) return await blockPending.get(at)!;
    const pending = (async () => {
      try {
        const res = await fetchWithAbort(EVM_RPC_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'chain_getBlock', params: [at] }),
        });
        if (!res.ok) return null;
        const json = await res.json();
        const j: unknown = json;
        let block: unknown = null;
        if (j && typeof j === 'object') {
          const r = (j as Record<string, unknown>)['result'];
          if (r && typeof r === 'object') {
            block = (r as Record<string, unknown>)['block'] ?? r;
          } else {
            block = (r as unknown) ?? null;
          }
        }
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

// Reef-specific RPC: estimate resources
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
    const secondParam: Json = block0 as Json;
    const res = await fetchWithAbort(EVM_RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'evm_estimateResources', params: [baseReq, secondParam] }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.error) {
      const code = json?.error?.code;
      if (code === -32601) {
        reefEvmCallDisabled = true;
      }
      return null;
    }
    const result = json?.result ?? {};
    const r = result as Record<string, unknown>;
    const gasRaw = r['gasLimit'] ?? r['gas_limit'] ?? r['gas'];
    const storRaw = r['storageLimit'] ?? r['storage_limit'] ?? r['storage'] ?? 0;
    const gas = toU64(gasRaw, 8_000_000);
    const storage = toU64(storRaw, 0);
    return { gasLimit: gas, storageLimit: storage };
  } catch {
    return null;
  }
}

async function ethCall(to: string, data: string): Promise<string | null> {
  try {
    if (evmEthCallDisabled) return null;
    if (!ethCallSupportChecked) {
      const ok = await checkEthCallSupport();
      if (!ok) return null;
    }
    if (!(await checkEvmRpcHealth())) return null;
    const res = await fetchWithAbort(EVM_RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.error) {
      if (json?.error?.code === -32601) {
        evmEthCallDisabled = true;
        return null;
      }
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

// Reef-specific RPC call
async function reefEvmCall(to: string, data: string): Promise<string | null> {
  try {
    if (reefEvmCallDisabled) return null;
    if (!reefEvmSupportChecked) {
      const ok = await checkReefEvmSupport();
      if (!ok) return null;
    }
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
    const block0 = await getBlock(at);
    if (!block0) return null;
    const secondParam: Json = block0 as Json;
    const res = await fetchWithAbort(EVM_RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'evm_call', params: [callReq, secondParam] }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.error) {
      const code = json?.error?.code;
      const msg = String(json?.error?.message ?? '');
      if (code === -32601) {
        reefEvmCallDisabled = true;
        return null;
      }
      if (/gas|resource|storage/i.test(msg)) {
        const est = await reefEstimateResources(to, data).catch(() => null);
        if (est && (est.gasLimit || est.storageLimit !== undefined)) {
          gasLimit = est.gasLimit ?? gasLimit;
          storageLimit = est.storageLimit ?? storageLimit;
          const callReq2 = { ...callReq, gasLimit, storageLimit } as const;
          const res3 = await fetchWithAbort(EVM_RPC_URL, {
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

// Batched evm_call; falls back if unsupported
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
    const secondParam: Json = block0 as Json;

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

    const res = await fetchWithAbort(EVM_RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(batch),
    });
    if (!res.ok) return results;
    const json = await res.json();
    if (!Array.isArray(json)) return results;

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

// decodeAbiString and applyErc1155Template moved to src/utils/abi

async function resolveTokenURI(contractAddress: string, nftId: string | number, tokenType?: string): Promise<string | null> {
  if (!isValidEvmAddressFormat(contractAddress)) return null;
  const cached = readTokenUriCache(contractAddress, nftId);
  if (cached) return cached;
  const idBig = BigInt(typeof nftId === 'string' ? (nftId.startsWith('0x') ? BigInt(nftId).toString() : nftId) : nftId);
  const arg = toHex(BigInt(idBig));
  const sel721 = '0xc87b56dd';
  const sel1155 = '0x0e89341c';

  async function tryCall(selector: string): Promise<string | null> {
    const data = selector + arg;
    const result = await ethCall(contractAddress, data);
    if (!result) {
      const r2 = await reefEvmCall(contractAddress, data);
      if (!r2) return null;
      const value = decodeAbiString(r2);
      if (value) {
        writeTokenUriCache(contractAddress, nftId, value);
      }
      return value;
    }
    const value = decodeAbiString(result);
    if (value) {
      writeTokenUriCache(contractAddress, nftId, value);
    }
    return value;
  }

  if (tokenType === 'ERC721') {
    return tryCall(sel721);
  }
  if (tokenType === 'ERC1155') {
    return tryCall(sel1155);
  }
  return (await tryCall(sel721)) ?? (await tryCall(sel1155));
}

async function getSqwidMeta(contractAddress: string, nftId: string | number): Promise<SqwidMeta | null> {
  try {
    const tokenIdKey = String(nftId);
    const ttlKey = `${contractAddress}:${tokenIdKey}`;
    const cached = sqwidMetaTtl.get(ttlKey);
    if (cached) return cached;

    let pending = sqwidPending.get(contractAddress);
    if (!pending) {
      pending = (async () => {
        const limit = 200;
        const startFrom = 0;
        const url = `https://sqwid-api-mainnet.reefscan.info/get/marketplace/by-collection/${contractAddress}/0?limit=${limit}&startFrom=${startFrom}`;
        const res = await fetchWithAbort(url, { headers: { accept: 'application/json' } });
        if (!res.ok) return;
        const json = await res.json().catch(() => null);
        const maybeItems = json && typeof json === 'object' ? (json as Record<string, unknown>)['items'] : undefined;
        const items = Array.isArray(maybeItems) ? maybeItems : [];
        for (const it of items) {
          const rawTokenId = get(it, ['tokenId']) ?? get(it, ['itemId']) ?? get(it, ['id']);
          if (rawTokenId === undefined || rawTokenId === null) continue;
          const tid = String(rawTokenId);
          const rawImage = getString(it, ['meta', 'image']) ?? getString(it, ['image']) ?? getString(it, ['meta', 'thumbnail']);
          const rawMedia = getString(it, ['meta', 'media']) ?? getString(it, ['media']) ?? getString(it, ['meta', 'animation_url']) ?? getString(it, ['animation_url']);
          const rawThumb = getString(it, ['meta', 'thumbnail']) ?? getString(it, ['thumbnail']) ?? getString(it, ['meta', 'image_preview']);
          const name = getString(it, ['meta', 'name']) ?? getString(it, ['name']);
          const image = toIpfsHttp(rawImage);
          const media = toIpfsHttp(rawMedia);
          const thumbnail = toIpfsHttp(rawThumb);
          const mimetype = getString(it, ['meta', 'mimetype']) ?? getString(it, ['mimetype']) ?? getString(it, ['meta', 'mimeType']);
          const parsed = getNumber(it, ['amount']) ?? getNumber(it, ['state', 'amount']);
          const amount = typeof parsed === 'number' && !Number.isNaN(parsed) ? parsed : undefined;
          sqwidMetaTtl.set(`${contractAddress}:${tid}`, { name, image, media, thumbnail, mimetype, amount });
        }
      })();
      sqwidPending.set(contractAddress, pending);
    }
    await pending;
    sqwidPending.delete(contractAddress);
    return sqwidMetaTtl.get(ttlKey);
  } catch {
    return null;
  }
}

async function fetchMetadataOnce(contractAddress: string, nftId: string | number, tokenType?: string): Promise<Nft | null> {
  const key = `${contractAddress}-${nftId}`;
  if (inflight.has(key)) return inflight.get(key)!;

  const task = (async () => {
    const sqwidQuick = await getSqwidMeta(contractAddress, nftId);
    if (sqwidQuick && (sqwidQuick.image || sqwidQuick.media || sqwidQuick.thumbnail || sqwidQuick.name)) {
      const name = sqwidQuick.name ?? `Token #${nftId}`;
      const image = sqwidQuick.image;
      const media = sqwidQuick.media;
      const thumbnail = sqwidQuick.thumbnail;
      const mimetype = sqwidQuick.mimetype;
      const amount = sqwidQuick.amount;
      return { id: key, name, image, media, thumbnail, mimetype, amount } as Nft;
    }

    let tokenUri = await resolveTokenURI(contractAddress, nftId, tokenType);
    if (!tokenUri) {
      const sqwid = await getSqwidMeta(contractAddress, nftId);
      if (sqwid) {
        const name = sqwid.name ?? `Token #${nftId}`;
        const image = sqwid.image;
        const media = sqwid.media;
        const thumbnail = sqwid.thumbnail;
        const mimetype = sqwid.mimetype;
        const amount = sqwid.amount;
        return { id: key, name, image, media, thumbnail, mimetype, amount } as Nft;
      }
      return { id: key, name: `Token #${nftId}` } as Nft;
    }
    if (tokenUri.startsWith('data:')) {
      const meta = parseDataUrlJson(tokenUri);
      if (meta && typeof meta === 'object') {
        const name = getString(meta, ['name']) ?? `Token #${nftId}`;
        const image = toIpfsHttp(getString(meta, ['image']) ?? getString(meta, ['image_url']) ?? getString(meta, ['thumbnail']));
        const media = toIpfsHttp(getString(meta, ['media']) ?? getString(meta, ['animation_url']) ?? getString(meta, ['animation']));
        const thumbnail = toIpfsHttp(getString(meta, ['thumbnail']) ?? getString(meta, ['image_preview']) ?? getString(meta, ['image_small']) ?? getString(meta, ['preview_image']));
        const mimetype = getString(meta, ['mimetype']) ?? getString(meta, ['mime_type']) ?? getString(meta, ['mimeType']) ?? getString(meta, ['format']);
        return { id: key, name, image, media, thumbnail, mimetype } as Nft;
      }
      return { id: key, name: `Token #${nftId}` } as Nft;
    }
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
        const amount = sqwid.amount;
        return { id: key, name, image, media, thumbnail, mimetype, amount } as Nft;
      }
      return { id: key, name: `Token #${nftId}` } as Nft;
    }
    const resp = isIpfsLike(tokenUri)
      ? await fetchIpfsWithFallback(tokenUri, { method: 'GET', signal: getAbortSignal() })
      : await fetchWithAbort(httpUri, { method: 'GET' });
    if (!resp || !resp.ok) {
      const sqwid = await getSqwidMeta(contractAddress, nftId);
      if (sqwid) return { id: key, name: sqwid.name ?? `Token #${nftId}`, image: sqwid.image, media: sqwid.media, thumbnail: sqwid.thumbnail, mimetype: sqwid.mimetype } as Nft;
      return { id: key, name: `Token #${nftId}` } as Nft;
    }
    const json = await resp.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      const sqwid = await getSqwidMeta(contractAddress, nftId);
      if (sqwid) return { id: key, name: sqwid.name ?? `Token #${nftId}`, image: sqwid.image, media: sqwid.media, thumbnail: sqwid.thumbnail, mimetype: sqwid.mimetype, amount: sqwid.amount } as Nft;
      return { id: key, name: `Token #${nftId}` } as Nft;
    }
    const name = getString(json, ['name']) ?? `Token #${nftId}`;
    const image = toIpfsHttp(getString(json, ['image']) ?? getString(json, ['image_url']) ?? getString(json, ['thumbnail']));
    const media = toIpfsHttp(getString(json, ['media']) ?? getString(json, ['animation_url']) ?? getString(json, ['animation']));
    const thumbnail = toIpfsHttp(getString(json, ['thumbnail']) ?? getString(json, ['image_preview']) ?? getString(json, ['image_small']) ?? getString(json, ['preview_image']));
    const mimetype = getString(json, ['mimetype']) ?? getString(json, ['mime_type']) ?? getString(json, ['mimeType']) ?? getString(json, ['format']);
    return { id: key, name, image, media, thumbnail, mimetype } as Nft;
  })();

  inflight.set(key, task);
  try {
    return await task;
  } finally {
    inflight.delete(key);
  }
}

async function fetchMetadataWithRetry(contractAddress: string, nftId: string | number, tokenType?: string, retries = 2): Promise<Nft | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchMetadataOnce(contractAddress, nftId, tokenType);
    } catch (err: unknown) {
      const status = getHttpStatus(err);
      const isTransient = status === 503 || status === 502 || status === 429 || status === 500 || !status;
      if (attempt < retries && isTransient) {
        const base = 300 * Math.pow(2, attempt);
        const jitter = Math.floor(Math.random() * 200);
        await sleep(base + jitter);
        continue;
      }
      return { id: `${contractAddress}-${nftId}`, name: 'Loading Failed', error: true } as Nft;
    }
  }
  return { id: `${contractAddress}-${nftId}`, name: 'Loading Failed', error: true } as Nft;
}

/**
 * A custom hook to fetch and process NFT data from the Sqwid API for a given address.
 * @param address The Reef chain address of the owner. Can be Substrate or EVM format.
 * @returns An object containing the list of NFTs, collections, loading state, and any errors.
 */
export const useSqwidNfts = (address: string | null) => {
  const { resolveEvmAddress } = useAddressResolver();

  // IPFS URL normalization is handled via utils/ipfs
  // All helper functions are defined at module scope above.

  /*
   * The following useCallback depends on many stable helpers and refs.
   * Listing all would cause needless identity churn and re-renders.
   * We intentionally scope-disable exhaustive-deps for this block.
   */
  const { data, isPending, error } = useQuery<{ nfts: Nft[]; collections: Collection[] }, unknown>({
    queryKey: ['sqwidNfts', address],
    queryFn: async ({ signal }) => {
      setAbortSignal(signal);
      try {
        const inputAddress = address ?? '';
        if (!inputAddress) return { nfts: [], collections: [] };

        const evmAddress = await resolveEvmAddress(inputAddress);
        if (!evmAddress) return { nfts: [], collections: [] };

        // Page through tokenHolders to stay under Squid size limits
        const pageSize = 100; // keep each response small
        const maxPairs = 300;  // safety cap to avoid hammering downstream metadata API
        const seen = new Set<string>();
        const uniquePairs: { contractAddress: string; nftId: string | number; tokenType?: string; ownedAmount?: number }[] = [];
        let offset = 0;
        for (let page = 0; page < 10; page++) {
          const { data } = await client.query<NftsByOwnerPagedQuery, NftsByOwnerPagedQueryVariables>({
            query: NFTS_BY_OWNER_PAGED_QUERY,
            variables: { owner: evmAddress, limit: pageSize, offset },
            fetchPolicy: 'network-only',
            context: { fetchOptions: { signal: getAbortSignal() } },
          });
          const batch = Array.isArray(data?.tokenHolders) ? data!.tokenHolders : [];
          if (!Array.isArray(batch) || batch.length === 0) break;

          for (const t of batch) {
            const contractId = t?.token?.id ?? undefined;
            const nftIdRaw = t?.nftId as unknown;
            const nftId = typeof nftIdRaw === 'string' || typeof nftIdRaw === 'number' ? nftIdRaw : undefined;
            const tokenType = (t?.token?.type ?? undefined) as unknown as string | undefined;
            const ownedAmount = toU64(t?.balance as unknown, 0);
            if (!contractId || (nftId === undefined || nftId === null)) continue;
            const key = `${contractId}::${nftId}`;
            if (!seen.has(key)) {
              seen.add(key);
              uniquePairs.push({ contractAddress: contractId, nftId, tokenType, ownedAmount });
            }
            if (uniquePairs.length >= maxPairs) break;
          }

          if (uniquePairs.length >= maxPairs) break;
          offset += batch.length;
          if (signal?.aborted) return { nfts: [], collections: [] };
        }

        if (uniquePairs.length === 0) {
          return { nfts: [], collections: [] };
        }

        await checkEvmRpcHealth();
        await checkEthCallSupport();
        await checkReefEvmSupport();

        try {
          const byContract = new Map<string, { nftId: string | number; tokenType?: string }[]>();
          for (const p of uniquePairs) {
            const list = byContract.get(p.contractAddress) ?? [];
            list.push({ nftId: p.nftId, tokenType: p.tokenType });
            byContract.set(p.contractAddress, list);
          }
          const prefetchTasks: Array<() => Promise<void>> = [];
          for (const [contract, items] of byContract) {
            prefetchTasks.push(async () => {
              try { await getSqwidMeta(contract, items[0]?.nftId ?? '0'); } catch (e) { void e; }
              const known = items.filter(it => it.tokenType === 'ERC721' || it.tokenType === 'ERC1155');
              if (known.length === 0) return;
              const datas: string[] = [];
              const keys: (string | number)[] = [];
              for (const it of known) {
                if (readTokenUriCache(contract, it.nftId)) continue;
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
                writeTokenUriCache(contract, nftId, decoded);
              }
            });
          }
          let pIndex = 0;
          async function prefetchWorker() {
            while (pIndex < prefetchTasks.length) {
              const current = pIndex++;
              try { await prefetchTasks[current](); } catch (e) { void e; }
            }
          }
          const prefetchConcurrency = Math.max(1, Math.min(PREFETCH_MAX_WORKERS, prefetchTasks.length));
          await Promise.all(Array.from({ length: prefetchConcurrency }, () => prefetchWorker()));
        } catch (e) { void e; }

        const concurrency = FETCH_CONCURRENCY;
        const results: PromiseSettledResult<Nft | null>[] = [];
        let index = 0;
        async function worker() {
          while (index < uniquePairs.length) {
            const current = index++;
            const { contractAddress, nftId, tokenType, ownedAmount } = uniquePairs[current];
            const value = await fetchMetadataWithRetry(contractAddress, nftId, tokenType);
            if (value && typeof ownedAmount === 'number' && ownedAmount > 0) {
              value.amount = ownedAmount;
            }
            results[current] = { status: 'fulfilled', value } as PromiseFulfilledResult<Nft | null>;
          }
        }
        const workers = Array.from({ length: Math.min(concurrency, uniquePairs.length) }, () => worker());
        await Promise.all(workers);

        const allNfts = results
          .map((r) => (r.status === 'fulfilled' ? (r as PromiseFulfilledResult<Nft | null>).value : null))
          .filter((n): n is Nft => n !== null);

        const normalized = allNfts.map(nft => ({ ...nft, image: normalizeIpfs(nft.image) }));

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
                image: normalizeIpfs(nft.collection.image) ?? normalizeIpfs(nft.image) ?? '',
                itemCount: 1,
              });
            }
          }
        });

        return { nfts: normalized, collections: Array.from(collectionsMap.values()) };
      } finally {
        setAbortSignal(undefined);
      }
    },
  });

  const queryError = error instanceof Error ? error : (error ? new Error('Unknown error') : null);
  return { nfts: data?.nfts ?? [], collections: data?.collections ?? [], isLoading: isPending, error: queryError };
};

// Exported helper to reuse metadata resolution with retries in other hooks
export async function fetchNftMetadata(contractAddress: string, nftId: string | number, tokenType?: string): Promise<Nft | null> {
  return fetchMetadataWithRetry(contractAddress, nftId, tokenType);
}

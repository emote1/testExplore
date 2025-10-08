import { useState, useEffect, useMemo, useCallback } from 'react';
import { parseTimestampToDate } from '@/utils/formatters';
import { useQuery, ApolloError, useApolloClient } from '@apollo/client';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import type { ApolloClient, NormalizedCacheObject } from '@apollo/client';
import { PAGINATED_TRANSFERS_QUERY, PAGINATED_TRANSFERS_MIN_QUERY, TRANSFERS_POLLING_QUERY } from '../data/transfers';
import type { TransferOrderByInput, TransfersFeeQueryQuery as TransfersFeeQuery, TransfersFeeQueryQueryVariables as TransfersFeeQueryVariables } from '@/gql/graphql';
import { mapTransfersToUiTransfers, type UiTransfer, hasTokenMetaCached, primeTokenMetaCacheFromContracts } from '../data/transfer-mapper';
import { VerifiedContractsByIdsDocument } from '@/gql/graphql';
import { useAddressResolver } from './use-address-resolver';
import { buildTransferWhereFilter, type TransactionDirection } from '@/utils/transfer-query';
import { getNumber, getString } from '@/utils/object';

// Normalize timestamps via shared formatter to epoch milliseconds for stable sorting
function toEpochMs(ts: string | number | Date | null | undefined): number {
  if (ts == null) return -Infinity;
  const d = parseTimestampToDate(ts as string | number | Date);
  return d ? d.getTime() : -Infinity;
}


export interface UseTransactionDataReturn {
  transfers: UiTransfer[];
  loading: boolean;
  error?: ApolloError | Error;
  hasMore: boolean;
  fetchMore: () => Promise<void>;
  /** Total number of matching transfers reported by the API (may lag behind subscription cache updates) */
  totalCount?: number;
  /** Fetch a specific window using offset/limit with the same filters and ordering */
  fetchWindow: (offset: number, limit: number, opts?: { fetchFees?: boolean }) => Promise<UiTransfer[]>;
}

export function useTransactionDataWithBlocks(
  accountAddress: string | null | undefined,
  limit: number,
  direction: TransactionDirection = 'any',
  minReefRaw?: string | bigint | null,
  maxReefRaw?: string | bigint | null,
  reefOnly: boolean = false,
  tokenIds: string[] | null = null,
  tokenMinRaw: string | bigint | null = null,
  tokenMaxRaw: string | bigint | null = null,
  erc20Only: boolean = false,
  swapOnly: boolean = false,
): UseTransactionDataReturn {

  const { resolveAddress, resolveEvmAddress } = useAddressResolver();
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [resolvedEvmAddress, setResolvedEvmAddress] = useState<string | null>(null);

  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const client = useApolloClient();
  // Removed per cleanup: local fee/id caches (fees shown from API; modal updates cache on demand)
  // Partner legs for swaps (filled when strict server token filter is active)
  const [partnersByHash, setPartnersByHash] = useState<Record<string, any[]>>({});
  // Bump to force re-map when lazy metadata arrives
  const [metaVersion, setMetaVersion] = useState(0);

  useEffect(() => {
    if (!accountAddress) {
      setResolvedAddress(null);
      setResolvedEvmAddress(null);
      return;
    }

    const resolveAndSet = async () => {
      setIsResolvingAddress(true);
      try {
        const [nativeId, evm] = await Promise.all([
          resolveAddress(accountAddress),
          resolveEvmAddress(accountAddress),
        ]);
        setResolvedAddress(nativeId);
        setResolvedEvmAddress(evm);
      } catch (error) {
        console.error('Failed to resolve address:', error);
        setResolvedAddress(null); // Set to null on error to prevent invalid queries
        setResolvedEvmAddress(null);
      }
      finally {
        setIsResolvingAddress(false);
      }
    };

    resolveAndSet();
  }, [accountAddress, resolveAddress, resolveEvmAddress]);

  const pagedDoc = ((tokenIds && tokenIds.length > 0) || reefOnly || swapOnly)
    ? PAGINATED_TRANSFERS_MIN_QUERY
    : PAGINATED_TRANSFERS_QUERY;

  const { data, loading, error, fetchMore: apolloFetchMore } = 
    useQuery<TransfersFeeQuery, TransfersFeeQueryVariables>(
      pagedDoc as unknown as TypedDocumentNode<TransfersFeeQuery, TransfersFeeQueryVariables>,
      {
        variables: {
          first: limit,
          where: buildTransferWhereFilter({ resolvedAddress, resolvedEvmAddress, direction, minReefRaw, maxReefRaw, reefOnly, tokenIds, tokenMinRaw, tokenMaxRaw, erc20Only, excludeSwapLegs: !swapOnly }),
          orderBy: ((minReefRaw || maxReefRaw || tokenMinRaw || tokenMaxRaw) ? ['amount_ASC', 'id_ASC'] : ['timestamp_DESC', 'id_DESC']) as TransferOrderByInput[],
        },
        skip: !resolvedAddress && !resolvedEvmAddress,
        notifyOnNetworkStatusChange: false,
        fetchPolicy: 'cache-and-network',
      }
    );

  // Reset fees when address changes
  useEffect(() => {
    setPartnersByHash({});
  }, [resolvedAddress, resolvedEvmAddress, direction, minReefRaw, maxReefRaw, reefOnly, tokenIds, tokenMinRaw, tokenMaxRaw]);

  // Fetch partner legs only for Swap view; All/Incoming/Outgoing don't need partner legs
  useEffect(() => {
    // Only when we have page data and Swap view is active
    const wantPartners = !!swapOnly;
    if (!wantPartners) return;
    const edges = data?.transfersConnection.edges || [];
    const nodes = edges.map((e) => e?.node).filter(Boolean) as Array<any>;
    if (nodes.length === 0) return;

    const missing: string[] = [];
    const byHash: Record<string, any[]> = {};
    for (const n of nodes) {
      const h = getString(n, ['extrinsicHash']);
      if (!h) continue;
      (byHash[h] = byHash[h] || []).push(n);
    }
    for (const [h, arr] of Object.entries(byHash)) {
      if (partnersByHash[h]) continue;
      const hasFlag = arr.some((g) => Boolean((g as any)?.reefswapAction));
      // Light mode: only fetch partners for flagged extrinsics
      if (hasFlag) missing.push(h);
    }
    if (missing.length === 0) return;
    const missingLimited = missing.slice(0, 20); // conservative batch size for Swap mode

    (async () => {
      try {
        // Important: do NOT restrict by address here; partner legs may not involve the user
        const where: any = { extrinsicHash_in: missingLimited };
        const { data: q } = await (client as ApolloClient<NormalizedCacheObject>).query(
          {
            query: TRANSFERS_POLLING_QUERY as unknown as TypedDocumentNode<any, any>,
            variables: {
              where,
              // conservative cap: expect a handful of legs per extrinsic
              limit: Math.min(missingLimited.length * 10, 400),
            },
            fetchPolicy: 'network-only',
          }
        );
        const list = (q?.transfers || []) as Array<any>;
        if (!list.length) return;
        const grouped: Record<string, any[]> = {};
        for (const t of list) {
          const h = getString(t, ['extrinsicHash']);
          if (!h) continue;
          (grouped[h] = grouped[h] || []).push(t);
        }
        setPartnersByHash((prev) => {
          const next = { ...prev };
          for (const [h, arr] of Object.entries(grouped)) {
            if (!next[h]) next[h] = arr as any[];
          }
          return next;
        });
      } catch (e) {
        console.warn('[tx][partners] fetch failed', e);
      }
    })();
  }, [client, data, swapOnly, resolvedAddress, resolvedEvmAddress, partnersByHash]);

  // Background fee fetching disabled: fee now loads lazily in TransactionDetailsModal
  // useEffect intentionally removed to reduce list overhead.

  // Background extrinsicId fetching disabled: resolve when needed in details view.

  // Lazy fetch token metadata (contractData) for tokens on current page that lack cached meta
  useEffect(() => {
    const edges = data?.transfersConnection.edges || [];
    const nodes = edges.map((e) => e?.node).filter(Boolean) as Array<any>;
    if (nodes.length === 0) return;

    const ids: string[] = [];
    for (const n of nodes) {
      const id = getString(n, ['token', 'id']);
      if (!id) continue;
      if (!hasTokenMetaCached(id)) ids.push(id);
    }
    const unique = Array.from(new Set(ids));
    if (unique.length === 0) return;

    (async () => {
      try {
        const { data: q } = await (client as ApolloClient<NormalizedCacheObject>).query({
          query: VerifiedContractsByIdsDocument as unknown as TypedDocumentNode<any, any>,
          variables: { ids: unique, first: Math.min(unique.length, 100) },
          fetchPolicy: 'cache-first',
        });
        const list = (q?.verifiedContracts || []) as Array<{ id: string; contractData?: any; name?: string }>;
        if (list.length === 0) return;
        const added = primeTokenMetaCacheFromContracts(list);
        if (added > 0) setMetaVersion((v) => v + 1);
      } catch (e) {
        // ignore, soft optimization
      }
    })();
  }, [client, data]);

  const uiTransfers = useMemo(() => {
    const edges = data?.transfersConnection.edges || [];
    if (edges.length === 0) {
      return [];
    }

    // Merge partner legs (if any) before mapping/aggregation in Swap mode only
    const partnerList = Object.values(partnersByHash).flat();
    const combinedEdges = swapOnly && partnerList.length > 0
      ? [...(edges as unknown as Array<{ node: any }>), ...partnerList.map((n) => ({ node: n }))]
      : (edges as unknown as Array<{ node: any }>);

    const mapped = mapTransfersToUiTransfers(
      combinedEdges,
      resolvedAddress ?? resolvedEvmAddress ?? undefined
    );
    const enriched = mapped;

    // Enforce global stable order matching server order
    if (minReefRaw || maxReefRaw) {
      // amount_ASC, id_ASC
      enriched.sort((a, b) => {
        try {
          const da = BigInt(a.amount || '0');
          const db = BigInt(b.amount || '0');
          if (da !== db) return da < db ? -1 : 1;
        } catch {
          const na = Number(a.amount);
          const nb = Number(b.amount);
          if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na < nb ? -1 : 1;
        }
        if (a.id === b.id) return 0;
        return a.id < b.id ? -1 : 1;
      });
    } else {
      // timestamp_DESC, id_DESC
      enriched.sort((a, b) => {
        const ta = toEpochMs(a.timestamp);
        const tb = toEpochMs(b.timestamp);
        if (tb !== ta) return tb - ta; // newer first
        if (a.id === b.id) return 0;
        return a.id < b.id ? 1 : -1;
      });
    }

    // Belt-and-suspenders: ensure unique transfers by id to protect UI
    // from any rare duplication that might slip through cache merge/reconcile.
    const seen = new Set<string>();
    const unique: UiTransfer[] = [];
    for (const t of enriched) {
      if (t && !seen.has(t.id)) {
        seen.add(t.id);
        unique.push(t);
      }
    }

    // Group by extrinsicHash to detect swaps (incoming + outgoing different tokens). Only for Swap view.
    const byHash = new Map<string, UiTransfer[]>();
    for (const t of unique) {
      const h = t.extrinsicHash || t.id;
      const arr = byHash.get(h) || [];
      arr.push(t);
      byHash.set(h, arr);
    }
    if (!swapOnly) {
      // All/Incoming/Outgoing: return plain transfers without building SWAP rows
      return unique;
    }
    const aggregated: UiTransfer[] = [];
    for (const [hash, group] of byHash.entries()) {
      const fungible = group.filter(g => !g.isNft);
      const incoming = fungible.filter(g => g.type === 'INCOMING');
      const outgoing = fungible.filter(g => g.type === 'OUTGOING');

      if (!(incoming.length > 0 && outgoing.length > 0)) {
        aggregated.push(...group);
        continue;
      }

      // Pick the largest legs per direction by raw amount using cached BigInt when available
      function pickMax(list: UiTransfer[]): UiTransfer {
        let best = list[0]!;
        for (const it of list) {
          const a = (it as any).amountBI ?? BigInt(it.amount || '0');
          const b = (best as any).amountBI ?? BigInt(best.amount || '0');
          if (a > b) best = it;
        }
        return best;
      }
      const maxIn = pickMax(incoming);
      const maxOut = pickMax(outgoing);

      // Build SWAP only if dominant tokens differ; otherwise keep individual legs
      if (maxIn.token.id === maxOut.token.id) {
        aggregated.push(...group);
        continue;
      }

      const ts = maxIn.timestamp || maxOut.timestamp;
      const success = group.every(g => g.success);

      // Try to capture a concrete transfer id for linking (find triple anywhere, strip leading zeros)
      function extractTripleId(src?: string): string | undefined {
        if (!src) return undefined;
        const m = src.match(/0*(\d+)-0*(\d+)-0*(\d+)/);
        if (!m) return undefined;
        const block = String(Number(m[1]));
        const extrinsic = String(Number(m[2]));
        const event = String(Number(m[3]));
        return `${block}-${extrinsic}-${event}`;
      }
      function buildFromExId(leg?: any): string | undefined {
        if (!leg?.extrinsicId || leg?.eventIndex == null) return undefined;
        const m = String(leg.extrinsicId).match(/0*(\d+)-0*(\d+)/);
        if (!m) return undefined;
        const block = String(Number(m[1]));
        const extrinsic = String(Number(m[2]));
        const event = String(Number(leg.eventIndex));
        if (!Number.isFinite(Number(event))) return undefined;
        return `${block}-${extrinsic}-${event}`;
      }
      const preferId = extractTripleId(maxIn.id)
        ?? extractTripleId(maxOut.id)
        ?? buildFromExId(maxIn)
        ?? buildFromExId(maxOut);

      aggregated.push({
        id: `${hash}:swap`,
        from: maxOut.from,
        to: maxIn.to,
        type: 'SWAP',
        method: 'swap',
        amount: maxIn.amount,
        amountBI: (maxIn as any).amountBI ?? (() => { try { return BigInt(maxIn.amount || '0'); } catch { return undefined; } })(),
        isNft: false,
        tokenId: null,
        token: maxIn.token,
        timestamp: ts,
        success,
        extrinsicHash: hash,
        // fee is resolved lazily in modal by extrinsic hash/id
        blockHeight: (maxIn.blockHeight ?? maxOut.blockHeight),
        extrinsicIndex: (maxIn.extrinsicIndex ?? maxOut.extrinsicIndex),
        eventIndex: (maxIn.eventIndex ?? maxOut.eventIndex),
        extrinsicId: (maxIn.extrinsicId ?? maxOut.extrinsicId),
        swapInfo: {
          sold: { amount: maxOut.amount, amountBI: (maxOut as any).amountBI ?? (() => { try { return BigInt(maxOut.amount || '0'); } catch { return undefined; } })(), token: maxOut.token },
          bought: { amount: maxIn.amount, amountBI: (maxIn as any).amountBI ?? (() => { try { return BigInt(maxIn.amount || '0'); } catch { return undefined; } })(), token: maxIn.token },
          preferredTransferId: preferId,
        },
      });
    }

    // Final sort and return
    if (minReefRaw || maxReefRaw) {
      aggregated.sort((a, b) => {
        try {
          const da = BigInt(a.amount || '0');
          const db = BigInt(b.amount || '0');
          if (da !== db) return da < db ? -1 : 1;
        } catch {
          const na = Number(a.amount);
          const nb = Number(b.amount);
          if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na < nb ? -1 : 1;
        }
        if (a.id === b.id) return 0;
        return a.id < b.id ? -1 : 1;
      });
    } else {
      aggregated.sort((a, b) => {
        const ta = toEpochMs(a.timestamp);
        const tb = toEpochMs(b.timestamp);
        if (tb !== ta) return tb - ta;
        if (a.id === b.id) return 0;
        return a.id < b.id ? 1 : -1;
      });
    }

    return aggregated;
  }, [data, resolvedAddress, resolvedEvmAddress, minReefRaw, maxReefRaw, partnersByHash, metaVersion]);

  const fetchMore = useCallback(async () => {
    if (!apolloFetchMore || !data?.transfersConnection.pageInfo.hasNextPage) return;
    await apolloFetchMore({
      variables: {
        after: data.transfersConnection.pageInfo.endCursor,
      },
    });
  }, [apolloFetchMore, data]);

  // Fast windowed fetch by offset/limit with same where/orderBy
  const fetchWindow = useCallback(async (offset: number, limit: number, _opts?: { fetchFees?: boolean }): Promise<UiTransfer[]> => {
    if (!resolvedAddress && !resolvedEvmAddress) return [];
    // Ignored: fees are no longer fetched in windowed path; modal handles it lazily
    try {
      const { data: q } = await (client as ApolloClient<NormalizedCacheObject>).query(
        {
          // Use polling query since it exposes offset/limit on plain list
          query: TRANSFERS_POLLING_QUERY as unknown as TypedDocumentNode<any, any>,
          variables: {
            where: buildTransferWhereFilter({ resolvedAddress, resolvedEvmAddress, direction, minReefRaw, maxReefRaw, reefOnly, tokenIds, tokenMinRaw, tokenMaxRaw, erc20Only, excludeSwapLegs: !swapOnly }),
            orderBy: ((minReefRaw || maxReefRaw || tokenMinRaw || tokenMaxRaw) ? ['amount_ASC', 'id_ASC'] : ['timestamp_DESC', 'id_DESC']) as TransferOrderByInput[],
            offset: Math.max(0, Math.floor(offset) || 0),
            limit: Math.max(1, Math.floor(limit) || 1),
          },
          fetchPolicy: 'network-only',
        }
      );

      let list = (q?.transfers || []) as Array<any>;
      // Light mode: skip partner fetch in window path to avoid extra queries
      if (!swapOnly) {
        try {
          const byHash: Record<string, any[]> = {};
          for (const n of list) {
            const h = getString(n, ['extrinsicHash']);
            if (!h) continue;
            (byHash[h] = byHash[h] || []).push(n);
          }
          const missing: string[] = [];
          for (const [h, arr] of Object.entries(byHash)) {
            const hasFlag = arr.some((g) => Boolean((g as any)?.reefswapAction));
            const fungible = arr.filter((g) => !Boolean((g as any)?.isNft));
            const hasIn = fungible.some((g) => String((g as any)?.type) === 'INCOMING');
            const hasOut = fungible.some((g) => String((g as any)?.type) === 'OUTGOING');
            if (hasFlag || !(hasIn && hasOut)) missing.push(h);
          }
          if (missing.length > 0) {
            // Important: do NOT restrict by address here; partner legs may not involve the user
            const where: any = { extrinsicHash_in: missing, reefswapAction_isNull: false };
            const { data: q2 } = await (client as ApolloClient<NormalizedCacheObject>).query(
              {
                query: TRANSFERS_POLLING_QUERY as unknown as TypedDocumentNode<any, any>,
                variables: { where, limit: Math.min(missing.length * 20, 500) },
                fetchPolicy: 'network-only',
              }
            );
            const partners = (q2?.transfers || []) as Array<any>;
            if (partners.length > 0) {
              const seen = new Set(list.map((n) => n?.id));
              for (const p of partners) {
                if (!p?.id || seen.has(p.id)) continue;
                list.push(p);
                seen.add(p.id);
              }
            }
          }
        } catch (_e) {
          // best-effort; ignore partner errors in window mode
        }
      }
      if (!list.length) return [];

      // Map to UI model
      const mapped = mapTransfersToUiTransfers(
        list.map((n: any) => ({ node: n })),
        resolvedAddress ?? resolvedEvmAddress ?? undefined
      );

      // Inject fees using cache only; do not fetch here (modal handles lazy fetch)
      const enrichedPrimed = mapped.map((t) => {
        // leave fees to modal; no feeAmount on list rows
        return t;
      });

      // Enforce global order consistent with server
      if (minReefRaw || maxReefRaw) {
        enrichedPrimed.sort((a, b) => {
          try {
            const da = BigInt(a.amount || '0');
            const db = BigInt(b.amount || '0');
            if (da !== db) return da < db ? -1 : 1;
          } catch {
            const na = Number(a.amount);
            const nb = Number(b.amount);
            if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na < nb ? -1 : 1;
          }
          if (a.id === b.id) return 0;
          return a.id < b.id ? -1 : 1;
        });
      } else {
        enrichedPrimed.sort((a, b) => {
          const ta = toEpochMs(a.timestamp);
          const tb = toEpochMs(b.timestamp);
          if (tb !== ta) return tb - ta;
          if (a.id === b.id) return 0;
          return a.id < b.id ? 1 : -1;
        });
      }

      // Unique by id
      const seen = new Set<string>();
      const unique: UiTransfer[] = [];
      for (const t of enrichedPrimed) {
        if (!seen.has(t.id)) { seen.add(t.id); unique.push(t); }
      }
      return unique;
    } catch (e) {
      console.warn('[tx][fetchWindow] failed', e);
      return [];
    }
  }, [client, resolvedAddress, resolvedEvmAddress, direction, minReefRaw, maxReefRaw, reefOnly, tokenIds, tokenMinRaw, tokenMaxRaw]);

  const isLoading = loading || isResolvingAddress;
  const totalError = error; // Do not create a new error for the resolving state

  return {
    transfers: uiTransfers,
    loading: isLoading,
    error: totalError,
    hasMore: data?.transfersConnection.pageInfo.hasNextPage || false,
    fetchMore,
    totalCount: getNumber(data as unknown, ['transfersConnection', 'totalCount']),
    fetchWindow,
  };
}

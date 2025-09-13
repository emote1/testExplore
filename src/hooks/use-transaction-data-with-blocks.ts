import { useState, useEffect, useMemo, useCallback } from 'react';
import { parseTimestampToDate } from '@/utils/formatters';
import { useQuery, ApolloError, useApolloClient } from '@apollo/client';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import type { ApolloClient, NormalizedCacheObject } from '@apollo/client';
import { PAGINATED_TRANSFERS_QUERY, TRANSFERS_POLLING_QUERY } from '../data/transfers';
import type { TransferOrderByInput, TransfersFeeQueryQuery as TransfersFeeQuery, TransfersFeeQueryQueryVariables as TransfersFeeQueryVariables } from '@/gql/graphql';
import { mapTransfersToUiTransfers, type UiTransfer } from '../data/transfer-mapper';
import { useAddressResolver } from './use-address-resolver';
import { fetchFeesByExtrinsicHashes, getCachedFee, fetchExtrinsicIdsByHashes, getCachedExtrinsicId } from '../data/transfers';
import { buildTransferWhereFilter } from '@/utils/transfer-query';
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
  limit: number
): UseTransactionDataReturn {

  const { resolveAddress, resolveEvmAddress } = useAddressResolver();
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [resolvedEvmAddress, setResolvedEvmAddress] = useState<string | null>(null);

  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const client = useApolloClient();
  const [feesByHash, setFeesByHash] = useState<Record<string, string>>({});
  const [exIdsByHash, setExIdsByHash] = useState<Record<string, string>>({});

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

  const { data, loading, error, fetchMore: apolloFetchMore } = 
    useQuery<TransfersFeeQuery, TransfersFeeQueryVariables>(
      PAGINATED_TRANSFERS_QUERY as unknown as TypedDocumentNode<TransfersFeeQuery, TransfersFeeQueryVariables>,
      {
        variables: {
          first: limit,
          where: buildTransferWhereFilter({ resolvedAddress, resolvedEvmAddress }),
          orderBy: ['timestamp_DESC', 'id_DESC'] as TransferOrderByInput[],
        },
        skip: !resolvedAddress && !resolvedEvmAddress,
        notifyOnNetworkStatusChange: false,
        fetchPolicy: 'cache-and-network',
      }
    );

  // Reset fees when address changes
  useEffect(() => {
    setFeesByHash({});
    setExIdsByHash({});
  }, [resolvedAddress, resolvedEvmAddress]);

  // Fetch fees for extrinsics present in current edges,
  // but skip ones that already contain inline signedData.fee.partialFee
  useEffect(() => {
    const edges = data?.transfersConnection.edges || [];
    const nodes = edges.map((e) => e?.node).filter(Boolean) as Array<any>;
    if (nodes.length === 0) return;

    // Prime state cache with inline fees from signedData
    const inlineMap: Record<string, string> = {};
    for (const n of nodes) {
      const h = getString(n, ['extrinsicHash']);
      const inlineFee = getString(n, ['signedData', 'fee', 'partialFee']);
      if (h && inlineFee && feesByHash[h] === undefined) {
        inlineMap[h] = inlineFee;
      }
    }
    if (Object.keys(inlineMap).length > 0) {
      setFeesByHash((prev) => ({ ...prev, ...inlineMap }));
    }

    // Build fetch list only for those without inline fee and not cached
    const missing: string[] = [];
    for (const n of nodes) {
      const h = getString(n, ['extrinsicHash']);
      if (!h) continue;
      const hasInline = getString(n, ['signedData', 'fee', 'partialFee']);
      if (hasInline) continue;
      if (feesByHash[h] === undefined && getCachedFee(h) === undefined) {
        missing.push(h);
      }
    }
    if (missing.length === 0) return;

    let cancelled = false;
    fetchFeesByExtrinsicHashes(client as ApolloClient<NormalizedCacheObject>, missing)
      .then((map) => {
        if (cancelled) return;
        setFeesByHash((prev) => ({ ...prev, ...map }));
      })
      .catch((e) => {
        console.warn('[fees] batch fetch failed', e);
      });

    return () => { cancelled = true; };
  }, [client, data, feesByHash]);

  // Fetch extrinsicId (block-extrinsic) for nodes missing it
  useEffect(() => {
    const edges = data?.transfersConnection.edges || [];
    const nodes = edges.map((e) => e?.node).filter(Boolean) as Array<any>;
    if (nodes.length === 0) return;

    const missing: string[] = [];
    for (const n of nodes) {
      const h = getString(n, ['extrinsicHash']);
      const exId = getString(n, ['extrinsicId']);
      if (!h) continue;
      if (exId) {
        if (!exIdsByHash[h]) {
          setExIdsByHash((prev) => ({ ...prev, [h]: exId }));
        }
        continue;
      }
      if (!getCachedExtrinsicId(h) && !exIdsByHash[h]) {
        missing.push(h);
      }
    }
    if (missing.length === 0) return;

    let cancelled = false;
    fetchExtrinsicIdsByHashes(client as ApolloClient<NormalizedCacheObject>, missing)
      .then((map: Record<string, string>) => {
        if (cancelled) return;
        if (Object.keys(map).length > 0) {
          setExIdsByHash((prev) => ({ ...prev, ...map }));
        }
      })
      .catch((e: unknown) => {
        console.warn('[exId] batch fetch failed', e);
      });

    return () => { cancelled = true; };
  }, [client, data, exIdsByHash]);

  const uiTransfers = useMemo(() => {
    const edges = data?.transfersConnection.edges || [];
    if (edges.length === 0) {
      return [];
    }

    const mapped = mapTransfersToUiTransfers(
      edges as unknown as Array<{ node: any }>,
      resolvedAddress ?? resolvedEvmAddress ?? undefined
    );
    // inject fees
    const enriched = mapped.map((t) => ({
      ...t,
      feeAmount: t.extrinsicHash ? (feesByHash[t.extrinsicHash] ?? getCachedFee(t.extrinsicHash) ?? t.feeAmount) : t.feeAmount,
      extrinsicId: t.extrinsicId ?? (t.extrinsicHash ? (exIdsByHash[t.extrinsicHash] ?? getCachedExtrinsicId(t.extrinsicHash)) : undefined),
    }));

    // Enforce global stable order: timestamp_DESC, id_DESC
    enriched.sort((a, b) => {
      const ta = toEpochMs(a.timestamp);
      const tb = toEpochMs(b.timestamp);
      if (tb !== ta) return tb - ta; // newer first
      // tie-break by id DESC
      if (a.id === b.id) return 0;
      return a.id < b.id ? 1 : -1;
    });

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

    // Group by extrinsicHash to detect swaps (incoming + outgoing different tokens)
    const byHash = new Map<string, UiTransfer[]>();
    for (const t of unique) {
      const h = t.extrinsicHash || t.id;
      const arr = byHash.get(h) || [];
      arr.push(t);
      byHash.set(h, arr);
    }

    const aggregated: UiTransfer[] = [];
    for (const [hash, group] of byHash.entries()) {
      const fungible = group.filter(g => !g.isNft);
      const incoming = fungible.filter(g => g.type === 'INCOMING');
      const outgoing = fungible.filter(g => g.type === 'OUTGOING');

      const inTokenIds = Array.from(new Set(incoming.map(g => g.token.id)));
      const outTokenIds = Array.from(new Set(outgoing.map(g => g.token.id)));

      const isSwapCandidate = incoming.length > 0 && outgoing.length > 0 && inTokenIds.length === 1 && outTokenIds.length === 1 && inTokenIds[0] !== outTokenIds[0];
      if (!isSwapCandidate) {
        aggregated.push(...group);
        continue;
      }

      // Pick the largest legs per direction by raw amount (string BigInt compare)
      function pickMax(list: UiTransfer[]): UiTransfer {
        let best = list[0]!;
        for (const it of list) {
          try {
            if (BigInt(it.amount) > BigInt(best.amount)) best = it;
          } catch {
            // Fallback to string compare if BigInt fails (shouldn't)
            if (it.amount > best.amount) best = it;
          }
        }
        return best;
      }
      const maxIn = pickMax(incoming);
      const maxOut = pickMax(outgoing);

      const ts = maxIn.timestamp || maxOut.timestamp;
      const success = group.every(g => g.success);
      const fee = group.find(g => g.feeAmount && g.feeAmount !== '0')?.feeAmount || '0';

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
        isNft: false,
        tokenId: null,
        token: maxIn.token,
        timestamp: ts,
        success,
        extrinsicHash: hash,
        feeAmount: fee,
        blockHeight: (maxIn.blockHeight ?? maxOut.blockHeight),
        extrinsicIndex: (maxIn.extrinsicIndex ?? maxOut.extrinsicIndex),
        eventIndex: (maxIn.eventIndex ?? maxOut.eventIndex),
        extrinsicId: (maxIn.extrinsicId ?? maxOut.extrinsicId),
        swapInfo: {
          sold: { amount: maxOut.amount, token: maxOut.token },
          bought: { amount: maxIn.amount, token: maxIn.token },
          preferredTransferId: preferId,
        },
      });
    }

    // Final sort and return
    aggregated.sort((a, b) => {
      const ta = toEpochMs(a.timestamp);
      const tb = toEpochMs(b.timestamp);
      if (tb !== ta) return tb - ta;
      if (a.id === b.id) return 0;
      return a.id < b.id ? 1 : -1;
    });

    return aggregated;
  }, [data, resolvedAddress, resolvedEvmAddress, feesByHash, exIdsByHash]);

  const fetchMore = useCallback(async () => {
    if (!apolloFetchMore || !data?.transfersConnection.pageInfo.hasNextPage) return;
    await apolloFetchMore({
      variables: {
        after: data.transfersConnection.pageInfo.endCursor,
      },
    });
  }, [apolloFetchMore, data]);

  // Fast windowed fetch by offset/limit with same where/orderBy
  const fetchWindow = useCallback(async (offset: number, limit: number, opts?: { fetchFees?: boolean }): Promise<UiTransfer[]> => {
    if (!resolvedAddress && !resolvedEvmAddress) return [];
    const fetchFees = opts?.fetchFees ?? true;
    try {
      const { data: q } = await (client as ApolloClient<NormalizedCacheObject>).query(
        {
          // Use polling query since it exposes offset/limit on plain list
          query: TRANSFERS_POLLING_QUERY as unknown as TypedDocumentNode<any, any>,
          variables: {
            where: buildTransferWhereFilter({ resolvedAddress, resolvedEvmAddress }),
            orderBy: ['timestamp_DESC', 'id_DESC'] as TransferOrderByInput[],
            offset: Math.max(0, Math.floor(offset) || 0),
            limit: Math.max(1, Math.floor(limit) || 1),
          },
          fetchPolicy: 'network-only',
        }
      );

      const list = (q?.transfers || []) as Array<any>;
      if (!list.length) return [];

      // Map to UI model
      const mapped = mapTransfersToUiTransfers(
        list.map((n: any) => ({ node: n })),
        resolvedAddress ?? resolvedEvmAddress ?? undefined
      );

      // Inject fees using cache, then fetch missing in bulk
      const enrichedPrimed = mapped.map((t) => {
        const inlineFee = getString((t as any), ['signedData', 'fee', 'partialFee']);
        const fee = t.extrinsicHash ? (inlineFee ?? getCachedFee(t.extrinsicHash)) : undefined;
        return { ...t, feeAmount: fee ?? t.feeAmount };
      });

      const missing: string[] = [];
      for (const t of enrichedPrimed) {
        const h = t.extrinsicHash;
        if (!h) continue;
        const already = getCachedFee(h);
        if (already === undefined && (!t.feeAmount || t.feeAmount === '0')) missing.push(h);
      }
      if (fetchFees && missing.length > 0) {
        const feeMap = await fetchFeesByExtrinsicHashes(client as ApolloClient<NormalizedCacheObject>, missing);
        for (const t of enrichedPrimed) {
          const h = t.extrinsicHash;
          if (h && feeMap[h] !== undefined) (t as any).feeAmount = feeMap[h];
        }
      }

      // Enforce global stable DESC order (belt-and-suspenders)
      enrichedPrimed.sort((a, b) => {
        const ta = toEpochMs(a.timestamp);
        const tb = toEpochMs(b.timestamp);
        if (tb !== ta) return tb - ta;
        if (a.id === b.id) return 0;
        return a.id < b.id ? 1 : -1;
      });

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
  }, [client, resolvedAddress, resolvedEvmAddress]);

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

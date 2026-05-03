import { useEffect, useState, useCallback, useRef } from 'react';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { type ApolloClient, type NormalizedCacheObject, useApolloClient } from '@apollo/client';
import { parse } from 'graphql';
import type { UiTransfer } from '@/data/transfer-mapper';
import { parseTokenMetadata, safeBigInt } from '@/utils/token-helpers';
import { useAddressResolver } from './use-address-resolver';
import { isValidEvmAddressFormat } from '@/utils/address-helpers';

export interface UseSwapEventsReturn {
  items: UiTransfer[];
  loading: boolean;
  error?: Error;
  hasMore: boolean;
  fetchMore: () => Promise<void>;
  totalCount: number | undefined;
}

interface SwapLegRow {
  extrinsic_id: string;
  block_height: number;
  extrinsic_index: number;
  event_index: number;
  timestamp: string;
  type: string;
  from_evm_address: string | null;
  to_evm_address: string | null;
  token_id: string;
  amount: string;
  success: boolean;
  verified_contract: { contract_data: unknown } | null;
}

interface SwapsResponse {
  transfers: SwapLegRow[];
  count: { aggregate: { count: number } };
}

const SWAPS_QUERY = parse(`
  query SwapsForAddress($evm: String!, $limit: Int!, $offset: Int!) {
    transfers: transfer(
      where: {
        reefswap_action: { _eq: "Swap" }
        type: { _eq: "ERC20" }
        _or: [
          { from_evm_address: { _eq: $evm } }
          { to_evm_address: { _eq: $evm } }
        ]
      }
      order_by: [
        { block_height: desc }
        { extrinsic_index: asc }
        { event_index: asc }
      ]
      limit: $limit
      offset: $offset
    ) {
      extrinsic_id
      block_height
      extrinsic_index
      event_index
      timestamp
      type
      from_evm_address
      to_evm_address
      token_id
      amount
      success
      verified_contract { contract_data }
    }
    count: transfer_aggregate(
      where: {
        reefswap_action: { _eq: "Swap" }
        type: { _eq: "ERC20" }
        _or: [
          { from_evm_address: { _eq: $evm } }
          { to_evm_address: { _eq: $evm } }
        ]
      }
      distinct_on: extrinsic_id
    ) {
      aggregate { count }
    }
  }
`);

function legsToSwap(extrinsicId: string, legs: SwapLegRow[], userEvm: string): UiTransfer | null {
  if (legs.length === 0) return null;
  const userLower = userEvm.toLowerCase();
  let sold: SwapLegRow | undefined;
  let bought: SwapLegRow | undefined;
  let soldAmt = 0n;
  let boughtAmt = 0n;
  for (const l of legs) {
    const from = (l.from_evm_address || '').toLowerCase();
    const to = (l.to_evm_address || '').toLowerCase();
    const amt = safeBigInt(l.amount, true);
    if (from === userLower && amt > soldAmt) { sold = l; soldAmt = amt; }
    if (to === userLower && amt > boughtAmt) { bought = l; boughtAmt = amt; }
  }
  if (!sold || !bought) return null;
  if (sold.token_id.toLowerCase() === bought.token_id.toLowerCase()) return null;

  const soldMeta = parseTokenMetadata(sold.verified_contract?.contract_data, 'TOKEN');
  const boughtMeta = parseTokenMetadata(bought.verified_contract?.contract_data, 'TOKEN');

  const blockHeight = Number(sold.block_height ?? bought.block_height);
  const extrinsicIndex = Number(sold.extrinsic_index ?? bought.extrinsic_index);
  const eventIndex = Number(sold.event_index ?? bought.event_index);

  return {
    id: `${extrinsicId}:swap`,
    from: sold.from_evm_address || '',
    to: bought.to_evm_address || '',
    type: 'SWAP',
    method: 'swap',
    amount: boughtAmt.toString(),
    isNft: false,
    tokenId: null,
    token: { id: bought.token_id, name: boughtMeta.name, decimals: boughtMeta.decimals },
    timestamp: sold.timestamp ?? bought.timestamp,
    success: !!(sold.success && bought.success),
    extrinsicHash: '',
    blockHeight: Number.isFinite(blockHeight) ? blockHeight : undefined,
    extrinsicIndex: Number.isFinite(extrinsicIndex) ? extrinsicIndex : undefined,
    eventIndex: Number.isFinite(eventIndex) ? eventIndex : undefined,
    extrinsicId,
    swapInfo: {
      sold:   { amount: soldAmt.toString(),   token: { id: sold.token_id,   name: soldMeta.name,   decimals: soldMeta.decimals } },
      bought: { amount: boughtAmt.toString(), token: { id: bought.token_id, name: boughtMeta.name, decimals: boughtMeta.decimals } },
    },
  };
}

function groupLegs(rows: SwapLegRow[]): Map<string, SwapLegRow[]> {
  const map = new Map<string, SwapLegRow[]>();
  for (const r of rows) {
    const arr = map.get(r.extrinsic_id) ?? [];
    arr.push(r);
    map.set(r.extrinsic_id, arr);
  }
  return map;
}

export function useSwapEvents(address: string | null, pageSize: number, enabled: boolean = true): UseSwapEventsReturn {
  const apollo = useApolloClient() as ApolloClient<NormalizedCacheObject>;
  const { resolveEvmAddress } = useAddressResolver();
  const [items, setItems] = useState<UiTransfer[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [legsOffset, setLegsOffset] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [totalCount, setTotalCount] = useState<number | undefined>(undefined);
  const [resolvedUser, setResolvedUser] = useState<string>('');
  const initInFlightRef = useRef(false);
  const fetchMoreInFlightRef = useRef(false);
  const initKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!address) { if (!cancelled) setResolvedUser(''); return; }
        const evm = await resolveEvmAddress(address);
        if (!cancelled) setResolvedUser(evm || '');
      } catch {
        if (!cancelled) setResolvedUser('');
      }
    })();
    return () => { cancelled = true; };
  }, [address, resolveEvmAddress]);

  // Returns parsed swaps and the legs consumed (so we can advance offset
  // without splitting the trailing extrinsic across pages).
  const fetchLegsBatch = useCallback(async (offset: number, want: number): Promise<{
    swaps: UiTransfer[];
    legsConsumed: number;
    moreLegs: boolean;
    total: number;
  }> => {
    // Pull more legs than we strictly need — most swaps have 2 ERC20 legs,
    // multi-hop has more. Over-fetch so a single batch yields >= `want` swaps.
    const limit = Math.max(60, want * 3);
    const { data } = await apollo.query<SwapsResponse>({
      query: SWAPS_QUERY as TypedDocumentNode<SwapsResponse, { evm: string; limit: number; offset: number }>,
      variables: { evm: resolvedUser.toLowerCase(), limit, offset },
      fetchPolicy: 'no-cache',
    });
    const rows = data?.transfers ?? [];
    const total = data?.count?.aggregate?.count ?? 0;
    const moreLegs = rows.length >= limit;

    const grouped = groupLegs(rows);
    const extrinsicIds = Array.from(grouped.keys());

    // If there are likely more legs of the trailing extrinsic in the next
    // batch, drop the last group so we don't render half a swap. Refetch will
    // pick those legs up with a corrected offset.
    let trimmed = extrinsicIds;
    let consumed = rows.length;
    if (moreLegs && extrinsicIds.length > 1) {
      const lastId = extrinsicIds[extrinsicIds.length - 1];
      const lastLegs = grouped.get(lastId)?.length ?? 0;
      trimmed = extrinsicIds.slice(0, -1);
      consumed -= lastLegs;
    }

    const swaps: UiTransfer[] = [];
    for (const id of trimmed) {
      const legs = grouped.get(id) || [];
      const swap = legsToSwap(id, legs, resolvedUser);
      if (swap) swaps.push(swap);
    }
    return { swaps, legsConsumed: consumed, moreLegs, total };
  }, [apollo, resolvedUser]);

  // Initial load
  useEffect(() => {
    if (!enabled) return;
    if (!resolvedUser) return;
    if (!isValidEvmAddressFormat(resolvedUser)) return;
    const key = `${resolvedUser.toLowerCase()}|${pageSize}`;
    if (initKeyRef.current === key || initInFlightRef.current) return;
    initInFlightRef.current = true;
    initKeyRef.current = key;
    let cancelled = false;
    setItems([]);
    setLegsOffset(0);
    setHasMore(false);
    setTotalCount(undefined);
    setError(undefined);
    setLoading(true);
    (async () => {
      try {
        const { swaps, legsConsumed, moreLegs, total } = await fetchLegsBatch(0, pageSize);
        if (cancelled) return;
        setItems(swaps);
        setLegsOffset(legsConsumed);
        setTotalCount(total);
        setHasMore(swaps.length < total);
        // moreLegs alone isn't a reliable hasMore signal because we may have
        // dropped a trailing partial group; rely on swaps.length vs total.
        void moreLegs;
      } catch (e) {
        if (!cancelled) setError(e as Error);
      } finally {
        if (!cancelled) { setLoading(false); initInFlightRef.current = false; }
      }
    })();
    return () => { cancelled = true; };
  }, [resolvedUser, pageSize, enabled, fetchLegsBatch]);

  const fetchMore = useCallback(async () => {
    if (!enabled) return;
    if (!hasMore) return;
    if (fetchMoreInFlightRef.current) return;
    fetchMoreInFlightRef.current = true;
    setLoading(true);
    try {
      const { swaps, legsConsumed, total } = await fetchLegsBatch(legsOffset, pageSize);
      setItems(prev => {
        const seen = new Set(prev.map(p => p.id));
        const next = prev.slice();
        for (const s of swaps) if (!seen.has(s.id)) next.push(s);
        setHasMore(next.length < total);
        return next;
      });
      setLegsOffset(off => off + legsConsumed);
      setTotalCount(total);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
      fetchMoreInFlightRef.current = false;
    }
  }, [enabled, hasMore, legsOffset, pageSize, fetchLegsBatch]);

  return { items, loading, error, hasMore, fetchMore, totalCount };
}

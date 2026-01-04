import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UiTransfer } from '@/data/transfer-mapper';

interface UseAnchorArgs {
  address: string;
  direction: 'any' | 'incoming' | 'outgoing';
  minReefRaw?: string | bigint | null;
  maxReefRaw?: string | bigint | null;
  tokenFilter: string;
  initialTransactions?: UiTransfer[] | null;
  pageIndex: number;
  dbg?: (...args: unknown[]) => void;
}

export function useAnchor({ address, direction, minReefRaw, maxReefRaw, tokenFilter, initialTransactions, pageIndex, dbg }: UseAnchorArgs) {
  const [anchorFirstId, setAnchorFirstId] = useState<string | undefined>(undefined);

  // Reset anchor when address changes
  useEffect(() => {
    dbg?.('anchor: reset due to address change', { address });
    setAnchorFirstId(undefined);
  }, [address]);

  // Reset anchor when filters change
  useEffect(() => {
    dbg?.('anchor: reset due to direction/min/max/token change', { direction, minReefRaw, maxReefRaw, tokenFilter });
    setAnchorFirstId(undefined);
  }, [direction, minReefRaw, maxReefRaw, tokenFilter]);

  // Initialize anchor to current first id once data is available
  useEffect(() => {
    if (!anchorFirstId && initialTransactions && initialTransactions.length > 0) {
      const id = initialTransactions[0]!.id;
      dbg?.('anchor: init to current first id', { id });
      setAnchorFirstId(id);
    }
  }, [anchorFirstId, initialTransactions]);

  // If anchor is no longer found (e.g., cache reset), re-anchor to current first on page 1
  useEffect(() => {
    if (!initialTransactions || initialTransactions.length === 0) return;
    if (!anchorFirstId) return;
    const missing = initialTransactions.findIndex(t => t.id === anchorFirstId) === -1;
    if (!missing) return;
    if (pageIndex === 0) {
      const id = initialTransactions[0]!.id;
      dbg?.('anchor: not found on page 1, re-anchor to current first', { prev: anchorFirstId, next: id });
      setAnchorFirstId(id);
    } else {
      dbg?.('anchor: not found on deep page, keep previous anchor (stability)');
    }
  }, [initialTransactions, anchorFirstId, pageIndex]);

  // Track index of anchor and freeze newItemsCount on deep pages if anchor disappears
  const anchorIndex = useMemo(() => {
    if (!initialTransactions || initialTransactions.length === 0) return -1;
    if (!anchorFirstId) return -1;
    return initialTransactions.findIndex(t => t.id === anchorFirstId);
  }, [initialTransactions, anchorFirstId]);

  const lastKnownNewItemsCountRef = useRef(0);
  useEffect(() => {
    if (anchorIndex >= 0) {
      lastKnownNewItemsCountRef.current = anchorIndex;
    }
  }, [anchorIndex]);

  // Number of new items prepended since anchor was set
  const newItemsCount = useMemo(() => {
    if (!anchorFirstId) return 0;
    if (anchorIndex >= 0) return anchorIndex;
    return pageIndex > 0 ? lastKnownNewItemsCountRef.current : 0;
  }, [anchorFirstId, anchorIndex, pageIndex]);

  // Log when newItemsCount changes
  useEffect(() => {
    const firstId = initialTransactions && initialTransactions[0] ? initialTransactions[0].id : undefined;
    dbg?.('newItemsCount updated', { newItemsCount, anchorFirstId, firstId });
  }, [newItemsCount, anchorFirstId, initialTransactions]);

  const showNewItems = useCallback((anchorId?: string) => {
    if (anchorId) { setAnchorFirstId(anchorId); return; }
    if (initialTransactions && initialTransactions.length > 0) {
      setAnchorFirstId(initialTransactions[0]!.id);
    } else {
      setAnchorFirstId(undefined);
    }
  }, [initialTransactions]);

  // If user is on page 1, always reveal newly prepended items by re-anchoring
  useEffect(() => {
    if (pageIndex !== 0) return;
    if (newItemsCount <= 0) return;
    if (!initialTransactions || initialTransactions.length === 0) return;
    const id = initialTransactions[0]!.id;
    dbg?.('anchor: auto re-anchor on page 1 to reveal new items', { id, newItemsCount });
    setAnchorFirstId(id);
  }, [pageIndex, newItemsCount, initialTransactions]);

  return { newItemsCount, showNewItems } as const;
}

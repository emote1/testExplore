import { useEffect, useMemo, useRef, useState } from 'react';
import type { PaginationState } from '@tanstack/react-table';
import { PAGINATION_CONFIG } from '@/constants/pagination';
import type { UiTransfer } from '@/data/transfer-mapper';

interface UseFastWindowArgs {
  tokenFilter: string;
  swapOnly: boolean;
  pagination: PaginationState;
  fetchWindow: (offset: number, limit: number) => Promise<UiTransfer[]>;
  newItemsCount: number;
  address: string;
}

export function useFastWindow({ tokenFilter, swapOnly, pagination, fetchWindow, newItemsCount, address }: UseFastWindowArgs) {
  const fastModeActive = useMemo(() => {
    return (tokenFilter === 'all' && !swapOnly) && !!PAGINATION_CONFIG.ENABLE_FAST_OFFSET_MODE && (pagination.pageIndex >= PAGINATION_CONFIG.FAST_OFFSET_MODE_THRESHOLD_PAGES);
  }, [pagination.pageIndex, tokenFilter, swapOnly]);

  const [fastPageData, setFastPageData] = useState<UiTransfer[] | null>(null);
  const [isFastLoading, setIsFastLoading] = useState<boolean>(false);
  const fastSeqRef = useRef(0);
  const prevAddressRef = useRef(address);

  useEffect(() => {
    // Clear fast data when leaving fast mode or when address changes
    if (!fastModeActive) {
      setFastPageData(null);
      setIsFastLoading(false);
      return;
    }

    if (prevAddressRef.current !== address) {
      setFastPageData(null);
      setIsFastLoading(false);
      prevAddressRef.current = address;
      return;
    }

    let cancelled = false;
    const seq = ++fastSeqRef.current;
    const { pageIndex, pageSize } = pagination;
    const offset = Math.max(0, (newItemsCount || 0) + pageIndex * pageSize);
    setIsFastLoading(true);
    fetchWindow(offset, pageSize)
      .then((data) => {
        if (cancelled) return;
        if (seq !== fastSeqRef.current) return;
        setFastPageData(data);
      })
      .catch(() => {
        // keep previous data if any; UI will show whatever is available
      })
      .finally(() => {
        if (cancelled) return;
        if (seq !== fastSeqRef.current) return;
        setIsFastLoading(false);
      });

    return () => { cancelled = true; };
  }, [fastModeActive, pagination.pageIndex, pagination.pageSize, newItemsCount, fetchWindow, address]);

  return { fastModeActive, fastPageData, isFastLoading } as const;
}

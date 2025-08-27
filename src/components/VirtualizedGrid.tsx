import React from 'react';
import { Loader2 } from 'lucide-react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';

/**
 * VirtualizedGrid
 * Window-scrolled row virtualization that renders a responsive grid per row.
 *
 * Why scrollMargin is needed:
 * - useWindowVirtualizer computes item positions relative to the document (window scroll).
 * - Our grid rows live inside a nested container card. To anchor rows to that container's top,
 *   we pass the container's absolute top (getBoundingClientRect().top + window.scrollY) as scrollMargin.
 * - When rendering each row, we subtract the same margin from row.start in translateY so that
 *   the rows align with the container instead of the document.
 *
 * Measuring strategy:
 * - useLayoutEffect measures:
 *   - container.clientWidth -> columnCount from minColumnWidth
 *   - container absolute top -> scrollMargin for the virtualizer
 * - We update on resize and scroll to handle layout shifts above the grid (e.g. headers becoming sticky).
 *
 * Manual offset (offsetTop):
 * - Additional manual offset applied to the measured absolute top. Useful to compensate sticky headers
 *   or fine-tune the anchoring point without changing layout.
 */

interface VirtualizedGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number, info?: { near: boolean; rowIndex: number; colIndex: number }) => React.ReactNode;
  estimateRowHeight?: number;
  minColumnWidth?: number;
  gap?: number;
  overscan?: number;
  className?: string;
  onEndReached?: () => void;
  isFetching?: boolean;
  testId?: string;
  // Additional manual offset applied to the measured absolute top
  // Useful if you have sticky headers or want to nudge the anchor point.
  offsetTop?: number;
  // Limit the number of rows rendered. Useful to reveal more rows progressively (e.g., 4 at a time).
  // When defined, onEndReached will only fire if there are more rows to reveal beyond maxRows.
  maxRows?: number;
}

// Responsive, window-scrolled virtualized grid by rows.
// - Measures container width to compute column count from minColumnWidth
// - Virtualizes vertical rows; each row renders N items as a CSS grid
// - Triggers onEndReached when last row appears in viewport
export function VirtualizedGrid<T>(props: VirtualizedGridProps<T>) {
  const {
    items,
    renderItem,
    estimateRowHeight = 300,
    minColumnWidth = 200,
    gap = 16,
    overscan = 4,
    className,
    onEndReached,
    isFetching = false,
    testId,
    offsetTop = 0,
    maxRows,
  } = props;

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  const firstRowGridRef = React.useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = React.useState<number>(0);
  const [scrollMargin, setScrollMargin] = React.useState<number>(0);
  const hasUserScrolledRef = React.useRef<boolean>(false);
  const initialScrollYRef = React.useRef<number>(0);
  const revealPendingRef = React.useRef<boolean>(false);
  const [measuredRowHeight, setMeasuredRowHeight] = React.useState<number | null>(null);
  // Whether overscan was explicitly provided; if not, we'll compute a dynamic one
  const overscanExplicit = Object.prototype.hasOwnProperty.call(props, 'overscan');
  // Adaptive scroll delta needed between reveals: max(12px, 1% of viewport height)
  function getScrollDeltaNeeded(): number {
    try {
      return Math.max(12, Math.round(window.innerHeight * 0.01));
    } catch {
      return 12;
    }
  }
  // Measure container width and its absolute top (for window-based virtualizer scrollMargin)
  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      setWidth(el.clientWidth);
      const rect = el.getBoundingClientRect();
      setScrollMargin(rect.top + window.scrollY);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    // Keep absolute-top recalculated on scroll in case layout above changes
    window.addEventListener('scroll', update, { passive: true });
    // Track whether the user has actually scrolled past baseline to prevent instant auto-reveal
    initialScrollYRef.current = window.scrollY;
    const onScrollFlag = () => {
      if (!hasUserScrolledRef.current) {
        const dy = Math.abs(window.scrollY - initialScrollYRef.current);
        const need = getScrollDeltaNeeded();
        if (dy > need) hasUserScrolledRef.current = true;
      }
    };
    window.addEventListener('scroll', onScrollFlag, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update as any);
      window.removeEventListener('scroll', update as any);
      window.removeEventListener('scroll', onScrollFlag as any);
    };
  }, []);

  const columnCount = React.useMemo(() => {
    const w = Math.max(0, width);
    const cols = Math.max(1, Math.floor(w / Math.max(1, minColumnWidth)));
    return cols;
  }, [width, minColumnWidth]);

  const rowCount = React.useMemo(() => {
    return Math.ceil(items.length / columnCount);
  }, [items.length, columnCount]);

  const visibleRowCount = React.useMemo(() => {
    if (typeof maxRows === 'number' && Number.isFinite(maxRows)) {
      return Math.max(0, Math.min(rowCount, Math.floor(maxRows)));
    }
    return rowCount;
  }, [rowCount, maxRows]);

  const effectiveScrollMargin = scrollMargin + offsetTop;
  // Dynamic overscan if not explicitly provided via props
  const computedOverscan = React.useMemo(() => {
    if (overscanExplicit) return overscan;
    const w = Math.max(0, width);
    if (w < 480) return 2;      // small phones
    if (w < 768) return 3;      // phones / small tablets
    if (w < 1024) return 4;     // tablets / small desktops
    return 6;                   // larger desktops
  }, [overscanExplicit, overscan, width]);
  // Do not underestimate: prefer actual measured row height if available
  const effectiveRowHeight = React.useMemo(() => {
    return Math.max(estimateRowHeight, measuredRowHeight ?? 0);
  }, [estimateRowHeight, measuredRowHeight]);
  const virtualizer = useWindowVirtualizer({
    count: visibleRowCount,
    // Include gap into row estimate so totalSize matches actual row box (content + bottom gap)
    estimateSize: () => effectiveRowHeight + gap,
    overscan: computedOverscan,
    scrollMargin: effectiveScrollMargin,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const [showLoader, setShowLoader] = React.useState(false);
  const loaderStartRef = React.useRef<number>(0);

  // Measure the first row grid height to avoid container underflow in single-row cases
  React.useLayoutEffect(() => {
    const el = firstRowGridRef.current;
    if (!el) return;
    const read = () => {
      try {
        const h = el.getBoundingClientRect().height;
        if (h && h > 0) setMeasuredRowHeight(prev => (prev === h ? prev : h));
      } catch {}
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items, columnCount, gap]);

  // Unified guarded trigger to prevent burst calls across multiple observers
  const fireEndReached = React.useCallback(() => {
    if (!onEndReached) return;
    if (isFetching || revealPendingRef.current) return;
    revealPendingRef.current = true;
    onEndReached();
    // Require additional user scroll before next chunk
    hasUserScrolledRef.current = false;
    initialScrollYRef.current = window.scrollY;
  }, [onEndReached, isFetching]);

  // Clear the local pending guard as soon as the parent marks fetching
  React.useEffect(() => {
    if (revealPendingRef.current && isFetching) {
      revealPendingRef.current = false;
    }
  }, [isFetching]);

  // Notify end reached when last row is visible AND user scrolled near grid bottom (limited mode)
  React.useEffect(() => {
    if (!onEndReached || isFetching) return;
    if (virtualRows.length === 0) return;
    const limited = typeof maxRows === 'number' && Number.isFinite(maxRows);
    const last = virtualRows[virtualRows.length - 1];
    if (limited) {
      // Only if there are hidden rows and user has performed a scroll gesture
      if (!(visibleRowCount < rowCount)) return;
      if (!hasUserScrolledRef.current) return;
      if (last.index >= visibleRowCount - 1) fireEndReached();
    } else {
      if (last.index >= rowCount - 1) onEndReached();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [virtualRows, rowCount, visibleRowCount, onEndReached, isFetching, maxRows, effectiveScrollMargin, fireEndReached]);

  // Removed window near-bottom polling in favor of IntersectionObserver + virtual rows triggers
  // This reduces global listeners and simplifies the reveal logic.

  // Temporarily lock window scrolling when we reached the bottom and we are revealing more rows
  React.useEffect(() => {
    const limited = typeof maxRows === 'number' && Number.isFinite(maxRows);
    if (!limited) return;
    let prevBodyOverflow: string | null = null;
    const keys = new Set(['PageDown', 'End', 'ArrowDown', 'ArrowUp', 'Space', ' ']);
    const prevent = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
    const preventKeys = (e: KeyboardEvent) => { if (keys.has(e.key)) { e.preventDefault(); e.stopPropagation(); } };
    if (isFetching && !!onEndReached) {
      window.addEventListener('wheel', prevent as any, { passive: false });
      window.addEventListener('touchmove', prevent as any, { passive: false });
      window.addEventListener('keydown', preventKeys as any, true);
      try {
        prevBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
      } catch {}
    }
    return () => {
      window.removeEventListener('wheel', prevent as any);
      window.removeEventListener('touchmove', prevent as any);
      window.removeEventListener('keydown', preventKeys as any, true);
      try {
        if (prevBodyOverflow !== null) document.body.style.overflow = prevBodyOverflow;
      } catch {}
    };
  }, [isFetching, maxRows, onEndReached]);

  // IntersectionObserver sentinel near the bottom of the current grid window
  React.useEffect(() => {
    if (!onEndReached) return;
    const limited = typeof maxRows === 'number' && Number.isFinite(maxRows);
    if (!limited) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry || !entry.isIntersecting) return;
        if (isFetching) return;
        if (!(visibleRowCount < rowCount)) return;
        if (!hasUserScrolledRef.current) return;
        fireEndReached();
      },
      { root: null, rootMargin: '0px 0px 12% 0px', threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [onEndReached, isFetching, visibleRowCount, rowCount, maxRows]);

  // Debounced loader show (120ms) + keep visible minimum 300ms to reduce flicker
  React.useEffect(() => {
    const limited = typeof maxRows === 'number' && Number.isFinite(maxRows);
    const hasHidden = visibleRowCount < rowCount;
    if (!limited || !hasHidden) { setShowLoader(false); return; }
    const minMs = 300;
    const debounceMs = 120;
    let showTimer: any | null = null;
    let hideTimer: any | null = null;
    const now = () => (typeof performance !== 'undefined' && (performance as any).now) ? performance.now() : Date.now();
    if (isFetching) {
      showTimer = setTimeout(() => {
        loaderStartRef.current = now();
        setShowLoader(true);
      }, debounceMs);
    } else {
      // Cancel pending show if any and hide with minimum visibility window
      const elapsed = now() - (loaderStartRef.current || 0);
      if (showLoader && elapsed < minMs) {
        hideTimer = setTimeout(() => setShowLoader(false), minMs - elapsed);
      } else {
        setShowLoader(false);
      }
    }
    return () => {
      if (showTimer) clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [isFetching, maxRows, visibleRowCount, rowCount, showLoader]);

  const gapPx = gap;

  return (
    <div
      ref={containerRef}
      className={className}
      data-testid={testId}
      style={{ position: 'relative' }}
      aria-busy={isFetching}
      data-total-items={items.length}
      data-row-count={rowCount}
      data-visible-row-count={visibleRowCount}
    >
      {(() => {
        const containerHeight = Math.max(0, totalSize - gapPx);
        return (
          <div style={{ height: containerHeight, position: 'relative' }}>
            {virtualRows.map((row) => {
              const startIndex = row.index * columnCount;
              const maxItems = (visibleRowCount > 0 ? visibleRowCount : 0) * columnCount;
              const rowItems = items.slice(startIndex, Math.min(startIndex + columnCount, maxItems));
              const lastIndex = (typeof maxRows === 'number' && Number.isFinite(maxRows)) ? (visibleRowCount - 1) : (rowCount - 1);
              const padBottom = row.index === lastIndex ? 0 : gapPx;
              // Compute whether this row is near the viewport (with extra margin)
              const winTop = (() => { try { return window.scrollY; } catch { return 0; } })();
              const winH = (() => { try { return window.innerHeight || 0; } catch { return 0; } })();
              const nearMarginPx = Math.max(600, Math.round(winH * 0.6));
              const rowTopDoc = row.start; // absolute doc top for this row per virtualizer
              const rowSize = effectiveRowHeight + gapPx;
              const nearTop = winTop - nearMarginPx;
              const nearBottom = winTop + winH + nearMarginPx;
              const isNearRow = (rowTopDoc + rowSize) >= nearTop && rowTopDoc <= nearBottom;
              return (
                <div
                  key={row.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    // Translate relative to container: subtract effectiveScrollMargin per TanStack docs
                    transform: `translateY(${row.start - effectiveScrollMargin}px)`,
                    // add row gap as bottom padding to emulate grid gap between rows (not after the last row)
                    paddingBottom: padBottom,
                  }}
                >
                  <div
                    ref={row.index === 0 ? firstRowGridRef : undefined}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                      gap: gapPx,
                    }}
                  >
                    {rowItems.map((item, i) => renderItem(item, startIndex + i, { near: isNearRow, rowIndex: row.index, colIndex: i }))}
                  </div>
                </div>
              );
            })}
            {/* Sentinel at the bottom of the currently rendered window */}
            <div
              ref={sentinelRef}
              aria-hidden
              style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 1, transform: `translateY(${Math.max(0, containerHeight - 1)}px)` }}
            />
          </div>
        );
      })()}
      {/* Fixed bottom loader overlay with fade transitions and a11y */}
      {(() => {
        const limited = typeof maxRows === 'number' && Number.isFinite(maxRows);
        const hasHidden = visibleRowCount < rowCount;
        if (!(limited && hasHidden)) return null;
        return (
          <div
            style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 12, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 1000 }}
          >
            <div
              className="inline-flex items-center gap-2 rounded-full bg-white/90 backdrop-blur px-3 py-1 shadow border text-sm text-gray-600 transition-opacity transition-transform duration-200 ease-out"
              style={{ opacity: showLoader ? 1 : 0, transform: showLoader ? 'translateY(0)' : 'translateY(6px)' }}
              role="status"
              aria-live="polite"
              aria-atomic="true"
              aria-hidden={!showLoader}
              data-testid="bottom-loader-overlay"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading more</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

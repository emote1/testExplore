import React from 'react';
import { Loader2, AlertTriangle, Grid3x3, Layers, Video, Image as ImageIcon } from 'lucide-react';
import { Nft, Collection, useSqwidNfts } from '../hooks/use-sqwid-nfts';
import { useSqwidCollectionInfinite } from '../hooks/use-sqwid-collection';
import { useSqwidNftsInfinite } from '../hooks/use-sqwid-nfts-infinite';
import { NftImage } from './NftImage';
import { useSqwidCollectionsByOwner } from '../hooks/use-sqwid-collections-by-owner';
// owned-count via Subsquid is removed; no useNftsByOwner import
import { useAddressResolver } from '../hooks/use-address-resolver';
import { NftMediaViewer } from './media/nft-media-viewer';
import { Skeleton } from './ui/skeleton';
import { PreviewPlaybackProvider } from './preview-playback';
import { NftVideoThumb } from './media/nft-video-thumb';
import { normalizeIpfs, toCidPath } from '../utils/ipfs';
import { VirtualizedGrid } from './VirtualizedGrid';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface NftGalleryProps {
  address: string | null;
  enableOwnerInfinite?: boolean;
  onCountsChange?: (count: number) => void;
  totalCount?: number | null;
}

// Minimal NFT shape used for grouping/aggregation within this component
type NftLite = Pick<Nft, 'id' | 'name' | 'image' | 'media' | 'thumbnail' | 'mimetype' | 'amount' | 'collection'>;

// IPFS helpers are imported from '../utils/ipfs'
// Video thumbnail component moved to './media/nft-video-thumb'

function looksVideoUrl(u?: string): boolean {
  try {
    return typeof u === 'string' && /\.(mp4|webm|ogv|ogg|mov|mkv|m4v)(\?|#|$)/i.test(u);
  } catch {
    return false;
  }
}

function looksImageUrl(u?: string): boolean {
  try {
    return typeof u === 'string' && /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i.test(u);
  } catch {
    return false;
  }
}

function isVideoNft(nft: Nft): boolean {
  const mediaUrl = nft.media as string | undefined;
  const imageUrl = nft.image as string | undefined;
  if (typeof nft.mimetype === 'string' && nft.mimetype.startsWith('video/') && !!mediaUrl) {
    if (looksImageUrl(mediaUrl)) return false;
    return true;
  }
  return looksVideoUrl(mediaUrl) || looksVideoUrl(imageUrl);
}

function NftCard({ nft, onPreview, priority, onThumbReady, suspended }: { nft: Nft; onPreview: (n: Nft) => void; priority?: boolean; onThumbReady?: (id: string) => void; suspended?: boolean }) {
  if (nft.error) {
    return (
      <div className="border rounded-lg p-4 flex flex-col items-center justify-center bg-gray-50 aspect-square" data-testid="nft-card" data-nft-id={nft.id}>
        <p className="text-red-500 text-sm font-semibold">Loading Failed</p>
        <p className="text-xs text-gray-500 truncate w-full text-center mt-1">{nft.id}</p>
      </div>
    );
  }

  const showAmount = typeof nft.amount === 'number' && nft.amount > 1;
  const amount = showAmount ? nft.amount : undefined;
  // Detect video cautiously:
  // - Trust mimetype only when an explicit media URL is present
  // - Otherwise rely on URL extension for media or image
  const isVideo = isVideoNft(nft);
  const mediaSrc = (nft.media ?? nft.image) as string | undefined;
  const posterCandidate = (nft.thumbnail ?? nft.image) as string | undefined;
  const previewImageSrc = (nft.thumbnail ?? nft.image ?? (!isVideo ? nft.media : undefined)) as string | undefined;
  const mediaCid = toCidPath(mediaSrc);
  const posterCid = toCidPath(posterCandidate);
  const posterMatchesMedia = !!posterCandidate && (
    (mediaCid && posterCid ? mediaCid === posterCid : posterCandidate === mediaSrc)
  );
  const videoPoster = posterMatchesMedia ? undefined : posterCandidate;

  if (!nft.image && !nft.thumbnail && !nft.media) {
    return (
      <div className="border rounded-lg p-4 flex flex-col items-center justify-center bg-gray-50 aspect-square" data-testid="nft-card" data-nft-id={nft.id}>
        <div className="w-16 h-16 rounded bg-gray-200 mb-2" />
        <p className="text-gray-600 text-sm">{nft.name || 'Unnamed NFT'}</p>
        {showAmount ? (
          <span data-testid="nft-amount-badge-fallback" className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">x{amount}</span>
        ) : null}
      </div>
    );
  }
  return (
    <div className="border rounded-lg overflow-hidden bg-white" data-testid="nft-card" data-nft-id={nft.id}>
      <div className="relative">
        {isVideo ? (
          <NftVideoThumb
            src={mediaSrc as string}
            poster={videoPoster}
            name={nft.name || nft.id}
            className="w-full h-44 sm:h-52 md:h-56 bg-black"
            priority={priority}
            onClick={() => onPreview(nft)}
            onReady={onThumbReady ? (() => onThumbReady(nft.id)) : undefined}
            suspended={suspended}
          />
        ) : (
          <NftImage
            imageUrl={previewImageSrc ?? null}
            onClick={(nft.media || nft.image) ? (() => onPreview(nft)) : undefined}
            name={nft.name || nft.id}
            className="w-full h-44 sm:h-52 md:h-56 object-cover"
            priority={priority}
            onReady={onThumbReady ? (() => onThumbReady(nft.id)) : undefined}
          />
        )}
        {showAmount ? (
          <span data-testid="nft-amount-badge-overlay" className="absolute top-2 right-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-black/70 text-white">
            x{amount}
          </span>
        ) : null}
      </div>
      <div className="p-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm truncate flex-1">{nft.name || 'Unnamed NFT'}</h3>
          {showAmount ? (
            <span data-testid="nft-amount-badge-inline" className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">x{amount}</span>
          ) : null}
        </div>
        {nft.collection?.name ? (
          <p className="text-xs text-gray-500 truncate">{nft.collection.name}</p>
        ) : null}
      </div>
    </div>
  );
}

function NftCardSkeleton() {
  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <Skeleton className="w-full h-44 sm:h-52 md:h-56" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

function CollectionOpenPanel({ collectionIdInput, onChangeInput, onOpen, isOpening, showHelpLink = true, onChangeAddress, 'data-testid': dataTestId }: { collectionIdInput: string; onChangeInput: (v: string) => void; onOpen: (id: string) => void; isOpening: boolean; showHelpLink?: boolean; onChangeAddress: () => void; 'data-testid'?: string; }) {
  return (
    <div className="mt-4 space-y-2" data-testid={dataTestId ?? 'collection-open-panel'}>
      <label className="text-sm font-medium text-gray-700" htmlFor="collectionId">Open a collection by ID</label>
      <div className="flex gap-2">
        <input
          id="collectionId"
          aria-label="Collection ID"
          placeholder="Enter collection ID (e.g., Jz41NjucSzaXUQ45Hjk1)"
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={collectionIdInput}
          onChange={(e) => onChangeInput(e.target.value.trim())}
        />
        <button
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          type="button"
          onClick={() => onOpen(collectionIdInput)}
          disabled={!collectionIdInput || isOpening}
        >
          {isOpening ? 'Opening...' : 'Open'}
        </button>
      </div>
      <div className="mt-2 flex items-center gap-4 text-xs text-gray-600">
        {showHelpLink ? (
          <a
            className="underline hover:text-gray-800"
            href="https://www.youtube.com/watch?v=jdgVZP0v30w"
            target="_blank"
            rel="noopener noreferrer"
          >
            What’s EVM mapping?
          </a>
        ) : null}
        <button
          type="button"
          className="inline-flex items-center rounded-lg border border-blue-400 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 underline"
          onClick={onChangeAddress}
        >
          Change address
        </button>
      </div>
    </div>
  );
}

function CollectionCard({ col, onClick }: { col: Collection; onClick: (c: Collection) => void }) {
  return (
    <button
      type="button"
      onClick={() => onClick(col)}
      className="text-left border rounded-lg overflow-hidden bg-white hover:shadow focus:shadow outline-none"
      title={col.name}
      data-testid="collection-card"
    >
      <div className="w-full h-32 sm:h-36 md:h-44 bg-gray-100 overflow-hidden">
        {col.image ? (
          <NftImage imageUrl={col.image} name={col.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No image</div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-sm truncate">{col.name}</h3>
        <p className="text-xs text-gray-500">{col.itemCount} items</p>
      </div>
    </button>
  );
}

export function NftGallery({ address, enableOwnerInfinite = false, onCountsChange, totalCount = null }: NftGalleryProps) {
  const [selectedCollection, setSelectedCollection] = React.useState<Collection | null>(null);
  const [viewer, setViewer] = React.useState<{ src: string; poster?: string; mime?: string; name?: string } | null>(null);
  const { collections: ownerCollections, error: ownerError } = useSqwidCollectionsByOwner(address);
  const [limit, setLimit] = React.useState<number>(12);
  const [collectionIdInput, setCollectionIdInput] = React.useState<string>("");
  const [isOpening, setIsOpening] = React.useState<boolean>(false);
  // Removed GraphQL owned-count request; rely on Sqwid REST only or infinite hook
  // Owner-infinite page size override via URL (for E2E): ?ownerLimit=24 or ?infiniteLimit=24
  const ownerInfPageSize = React.useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('ownerLimit') ?? params.get('infiniteLimit');
      const n = raw ? Number(raw) : NaN;
      if (Number.isFinite(n)) return Math.min(120, Math.max(8, Math.floor(n)));

      const w = typeof window !== 'undefined' ? window.innerWidth : 1024;
      if (w >= 1536) return 96;
      if (w >= 1280) return 80;
      if (w >= 1024) return 72;
      if (w >= 768) return 56;
      return 40;
    } catch {
      return 48;
    }
  }, []);
  const {
    nfts: infiniteNfts,
    isLoading: isOwnerInfLoading,
    isFetchingNextPage: isOwnerInfFetchingNext,
    hasNextPage: ownerHasNextPage,
    fetchNextPage: fetchOwnerNextPage,
    error: ownerInfError,
  } = useSqwidNftsInfinite({ owner: enableOwnerInfinite ? address : null, limit: ownerInfPageSize });
  const { nfts: fallbackNfts, isLoading: isFallbackLoading, error: fallbackError } = useSqwidNfts(address);
  const ownerSourceNfts = enableOwnerInfinite ? ((Array.isArray(infiniteNfts) && infiniteNfts.length > 0) ? infiniteNfts : fallbackNfts) : fallbackNfts;
  const isOwnerNftsLoading = enableOwnerInfinite
    ? (isOwnerInfLoading && (!Array.isArray(fallbackNfts) || fallbackNfts.length === 0))
    : isFallbackLoading;
  const loadedInfiniteCount = Array.isArray(infiniteNfts) ? infiniteNfts.length : 0;
  const loadedOwnerCount = Array.isArray(ownerSourceNfts) ? ownerSourceNfts.length : 0;
  const ownerTotalCount = typeof totalCount === 'number' && Number.isFinite(totalCount) ? totalCount : null;
  const ownerPrefetchTargetCount = React.useMemo(() => {
    const baseTarget = Math.max(120, ownerInfPageSize * 3);
    return ownerTotalCount !== null ? Math.min(ownerTotalCount, baseTarget) : baseTarget;
  }, [ownerInfPageSize, ownerTotalCount]);
  const { getAddressType } = useAddressResolver();
  const pagingRef = React.useRef<boolean>(false);
  const ownerPrefetchKeyRef = React.useRef<string | null>(null);
  const [showOwnerLoader, setShowOwnerLoader] = React.useState<boolean>(false);
  const ownerLoaderShownAtRef = React.useRef<number>(0);

  React.useEffect(() => {
    ownerPrefetchKeyRef.current = null;
  }, [address, enableOwnerInfinite, ownerInfPageSize]);

  React.useEffect(() => {
    if (!enableOwnerInfinite) return;
    if (!address) return;
    if (isOwnerInfLoading || isOwnerInfFetchingNext) return;
    if (!ownerHasNextPage) return;
    if (loadedInfiniteCount === 0) return;
    if (loadedInfiniteCount >= ownerPrefetchTargetCount) return;

    const key = `${address.toLowerCase()}::${ownerInfPageSize}::${loadedInfiniteCount}`;
    if (ownerPrefetchKeyRef.current === key) return;
    ownerPrefetchKeyRef.current = key;

    const prefetch = () => {
      void fetchOwnerNextPage().catch(() => {
        ownerPrefetchKeyRef.current = null;
      });
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number })
        .requestIdleCallback(prefetch, { timeout: 600 });
      return () => {
        try {
          (window as Window & { cancelIdleCallback: (idleId: number) => void }).cancelIdleCallback(id);
        } catch {
          // ignore
        }
      };
    }

    const t = setTimeout(prefetch, 120);
    return () => clearTimeout(t);
  }, [
    address,
    enableOwnerInfinite,
    isOwnerInfLoading,
    isOwnerInfFetchingNext,
    ownerHasNextPage,
    loadedInfiniteCount,
    ownerInfPageSize,
    ownerPrefetchTargetCount,
    fetchOwnerNextPage,
  ]);

  React.useEffect(() => {
    const debounceMs = 120;
    const minVisibleMs = 280;
    let showTimer: number | null = null;
    let hideTimer: number | null = null;
    const now = () => (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();

    if (isOwnerNftsLoading) {
      showTimer = window.setTimeout(() => {
        ownerLoaderShownAtRef.current = now();
        setShowOwnerLoader(true);
      }, debounceMs);
    } else {
      const elapsed = now() - (ownerLoaderShownAtRef.current || 0);
      if (showOwnerLoader && elapsed < minVisibleMs) {
        hideTimer = window.setTimeout(() => setShowOwnerLoader(false), minVisibleMs - elapsed);
      } else {
        setShowOwnerLoader(false);
      }
    }

    return () => {
      if (showTimer) window.clearTimeout(showTimer);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, [isOwnerNftsLoading, showOwnerLoader]);

  // Overview Tabs & row-chunked reveal
  const [overviewTab, setOverviewTab] = React.useState<'collections' | 'video' | 'other'>('video');
  const ROWS_CHUNK = 4;
  const GATE_ROWS = 4; // number of rows that must be fully ready to unlock scroll on video grids
  // Overlay UI: change text here. To tweak opacity/blur/colors, edit Tailwind classes
  // on the overlay containers where they are rendered below.
  const OVERLAY_TEXT = 'Preparing thumbnails…';
  const [videoRows, setVideoRows] = React.useState<number>(ROWS_CHUNK);
  const [otherRows, setOtherRows] = React.useState<number>(ROWS_CHUNK);
  const [revealVideo, setRevealVideo] = React.useState<boolean>(false);
  const [revealOther, setRevealOther] = React.useState<boolean>(false);
  const [collectionFilter, setCollectionFilter] = React.useState<'all' | 'video'>('all');
  // Scroll gate: block scroll until first 4 rows of thumbnails are ready (video grids only)
  const gateIdsRef = React.useRef<Set<string>>(new Set());
  const gateReadyRef = React.useRef<Set<string>>(new Set());
  const [scrollGateActive, setScrollGateActive] = React.useState<boolean>(false);
  const gateTimeoutRef = React.useRef<number | null>(null);
  const prevOverflowRef = React.useRef<string | null>(null);
  const isVideoGridActive = selectedCollection ? (collectionFilter === 'video') : (overviewTab === 'video');

  const resetGate = React.useCallback(() => {
    gateIdsRef.current = new Set();
    gateReadyRef.current = new Set();
    setScrollGateActive(false);
    if (gateTimeoutRef.current) {
      try { window.clearTimeout(gateTimeoutRef.current); } catch { /* ignore */ }
      gateTimeoutRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    // Reset gate when context changes (tab/filter/collection)
    resetGate();
  }, [overviewTab, collectionFilter, selectedCollection?.id, resetGate]);

  React.useEffect(() => {
    // Lock/unlock body scroll
    if (typeof document === 'undefined') return;
    const body = document.body;
    if (!body) return;
    if (scrollGateActive) {
      if (prevOverflowRef.current === null) prevOverflowRef.current = body.style.overflow;
      body.style.overflow = 'hidden';
    } else if (prevOverflowRef.current !== null) {
      body.style.overflow = prevOverflowRef.current;
      prevOverflowRef.current = null;
    }
    return () => {
      // Cleanup on unmount
      if (prevOverflowRef.current !== null) {
        body.style.overflow = prevOverflowRef.current;
        prevOverflowRef.current = null;
      }
    };
  }, [scrollGateActive]);

  function ensureGateTimeout() {
    if (gateTimeoutRef.current) return;
    try {
      gateTimeoutRef.current = window.setTimeout(() => {
        setScrollGateActive(false);
        gateTimeoutRef.current = null;
      }, 2500);
    } catch { /* ignore setTimeout errors */ }
  }

  function registerGateRowId(id: string) {
    if (!isVideoGridActive) return;
    const ids = gateIdsRef.current;
    if (!ids.has(id)) {
      ids.add(id);
      if (!scrollGateActive) {
        try {
          // Defer to avoid setState during render of VirtualizedGrid
          window.setTimeout(() => setScrollGateActive(true), 0);
        } catch {
          Promise.resolve().then(() => setScrollGateActive(true));
        }
      }
      ensureGateTimeout();
    }
  }

  function onGateThumbReady(id: string) {
    const ready = gateReadyRef.current;
    if (!ready.has(id)) {
      ready.add(id);
      const ids = gateIdsRef.current;
      if (ids.size > 0 && ready.size >= ids.size) {
        setScrollGateActive(false);
        if (gateTimeoutRef.current) {
          try { window.clearTimeout(gateTimeoutRef.current); } catch { /* ignore */ }
          gateTimeoutRef.current = null;
        }
      }
    }
  }
  React.useEffect(() => {
    // Reset row windows when address changes
    setVideoRows(ROWS_CHUNK);
    setOtherRows(ROWS_CHUNK);
  }, [address]);

  // No EVM mapping resolution needed for empty-state copy anymore
  // NOTE (RU): Подсчёт без GraphQL-owned
  // - Полностью отказались от запроса Subsquid на owned-count; ориентируемся на Sqwid REST.
  // - Шапка коллекции: берём useSqwidCollection.total, иначе selectedCollection.itemCount,
  //   иначе displayedNfts.length (фолбэк).
  // - Секция "Other NFTs" строится только по Sqwid REST; элементы группируются по id
  //   с суммированием amount, минимально нормализуются медиа-поля (image/thumbnail/media/mimetype).
  const { nftsWithoutCollection, collectionsWithCount }: { nftsWithoutCollection: Nft[]; collectionsWithCount: Collection[] } = React.useMemo(() => {
    const ownerCols = Array.isArray(ownerCollections) ? ownerCollections : [];
    const ownerColIdSet = new Set(ownerCols.map(c => (c.id || '').toLowerCase()));

    // Build "Other NFTs" from owner NFTs source (infinite or fallback)
    const sourceNfts = ownerSourceNfts;
    const nftsWithoutCollectionRaw = (Array.isArray(sourceNfts) ? sourceNfts : []).filter((it: Nft) => {
      const explicit = it?.collection?.id as string | undefined;
      const derived = (!explicit && typeof it?.id === 'string' && it.id.includes('-')) ? it.id.split('-')[0] : undefined;
      const colId = explicit ?? derived;
      const key = (colId || '').toLowerCase();
      return !colId || !ownerColIdSet.has(key);
    });
    const grouped = new Map<string, NftLite>();
    for (const it of nftsWithoutCollectionRaw) {
      const key = typeof it?.id === 'string' ? it.id : String(it?.id ?? Math.random());
      const prev = grouped.get(key);
      const amt = typeof it?.amount === 'number' && !Number.isNaN(it.amount as number) ? (it.amount as number) : 0;
      if (!prev) {
        grouped.set(key, { id: key, name: it.name, image: it.image, media: it.media, thumbnail: it.thumbnail, mimetype: it.mimetype, amount: amt || undefined, collection: it.collection });
      } else {
        const next: NftLite = { ...prev };
        next.amount = ((prev.amount ?? 0) + (amt || 0)) || undefined;
        if (!next.image && it.image) next.image = it.image;
        if (!next.thumbnail && it.thumbnail) next.thumbnail = it.thumbnail;
        if (!next.media && it.media) next.media = it.media;
        if (!next.mimetype && it.mimetype) next.mimetype = it.mimetype;
        grouped.set(key, next);
      }
    }
    const nftsWithoutCollection = Array.from(grouped.values()) as Nft[];

    // Only itemCount on collection cards (no owned count)
    const collectionsWithItemCount: Collection[] = ownerCols.map(c => {
      const itemCount = typeof c?.itemCount === 'number' ? c.itemCount : 0;
      return { ...c, itemCount } as Collection;
    });

    return { nftsWithoutCollection, collectionsWithCount: collectionsWithItemCount };
  }, [ownerSourceNfts, ownerCollections]);

  const videoNfts = React.useMemo(() => nftsWithoutCollection.filter(isVideoNft), [nftsWithoutCollection]);
  const otherNonVideoNfts = React.useMemo(() => nftsWithoutCollection.filter(n => !isVideoNft(n)), [nftsWithoutCollection]);

  function badgeClass(isActive: boolean): string {
    return isActive ? 'bg-white/20 text-white border-white/20' : 'bg-gray-100 text-gray-600 border-gray-200';
  }

  function pillClass(isActive: boolean, active: string, inactive: string): string {
    return `rounded-full transition-all duration-300 ${isActive ? active : inactive}`;
  }

  function sanitizeName(name?: string): string | undefined {
    if (!name) return name;
    return name.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  React.useEffect(() => {
    // No local pagination state with useInfiniteQuery
  }, [address, selectedCollection, limit]);

  // Responsive row height estimate for Collections grid to avoid underestimating
  // the single-row container on wider viewports.
  const [viewportWidth, setViewportWidth] = React.useState<number>(() => {
    try { return window.innerWidth; } catch { return 1024; }
  });
  React.useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const estimateCollectionRowHeight = React.useMemo(() => {
    // Add a small safety margin to avoid clipping when only one row is present
    if (viewportWidth < 640) return 200; // 128 + ~72
    if (viewportWidth < 768) return 218; // 144 + ~74
    return 248; // 176 + ~72
  }, [viewportWidth]);

  function openViewer(nft: Nft) {
    // Prewarm media and poster to reduce first-load latency
    function prewarmMedia(raw?: string | null) {
      if (!raw) return;
      try {
        const url = normalizeIpfs(raw) ?? raw;
        const head = document.head;
        if (!head) return;
        let origin: string | null = null;
        try { const u = new URL(url, window.location.href); origin = u.origin; } catch { /* ignore invalid */ }
        const links: HTMLLinkElement[] = [];
        if (origin) {
          try {
            const preconnect = document.createElement('link');
            preconnect.rel = 'preconnect';
            preconnect.href = origin;
            preconnect.crossOrigin = 'anonymous';
            head.appendChild(preconnect); links.push(preconnect);
          } catch { /* ignore */ }
          try {
            const dns = document.createElement('link');
            dns.rel = 'dns-prefetch';
            dns.href = origin;
            head.appendChild(dns); links.push(dns);
          } catch { /* ignore */ }
        }
        try {
          window.setTimeout(() => { for (const el of links) { try { el.remove(); } catch { /* ignore */ } } }, 15000);
        } catch { /* ignore */ }
      } catch { /* ignore */ }
    }
    const srcRaw = nft.media ?? nft.image;
    if (!srcRaw) return;
    const posterRaw = nft.thumbnail ?? nft.image;
    // Kick off prewarm immediately (does not block viewer open)
    prewarmMedia(srcRaw);
    prewarmMedia(posterRaw);
    const src = normalizeIpfs(srcRaw) ?? srcRaw;
    const poster = normalizeIpfs(posterRaw) ?? posterRaw;
    const mime = nft.mimetype;
    setViewer({ src, poster, mime, name: nft.name });
  }

  // Thumbnails network suspension is now driven by a "suspended" prop, see NftVideoThumb

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setViewer(null);
    }
    if (viewer) {
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
    return () => { /* no cleanup when viewer not open */ };
  }, [viewer]);

  // Derived data above via useMemo; no effect needed to set state

  const {
    nfts: collectionPageNfts,
    isLoading: isCollectionLoadingBase,
    isFetching: isCollectionFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error: collectionError,
  } = useSqwidCollectionInfinite({ collectionId: selectedCollection?.id ?? null, limit });

  const isCollectionLoading = isCollectionLoadingBase || (collectionPageNfts.length === 0 && isCollectionFetching);
  const displayedNfts: Nft[] = React.useMemo(() => {
    if (!selectedCollection) return [];
    return collectionPageNfts.map((it) => ({
      id: it.id,
      name: it.name ?? 'Unnamed NFT',
      image: it.image,
      media: it.media,
      thumbnail: it.thumbnail,
      mimetype: it.mimetype,
      amount: it.amount,
      collection: { id: selectedCollection.id, name: selectedCollection.name, itemCount: selectedCollection.itemCount },
    }));
  }, [selectedCollection, collectionPageNfts]);

  const selectedCollectionVideoCount = React.useMemo(() => {
    try { return displayedNfts.filter(isVideoNft).length; } catch { return 0; }
  }, [displayedNfts]);

  const displayedFiltered: Nft[] = React.useMemo(() => {
    return collectionFilter === 'video' ? displayedNfts.filter(isVideoNft) : displayedNfts;
  }, [displayedNfts, collectionFilter]);

  // Infinite scroll now handled by VirtualizedGrid.onEndReached

  async function openCollectionById(id: string) {
    if (!id) return;
    setIsOpening(true);
    try {
      const found = collectionsWithCount.find(c => c.id === id);
      const name = sanitizeName(found?.name || 'Collection') || 'Collection';
      const image = normalizeIpfs(found?.image);
      setSelectedCollection({ id, name, image, itemCount: found?.itemCount ?? 0 });
    } finally {
      setIsOpening(false);
    }
  }

  function handleSelectCollection(col: Collection) {
    setSelectedCollection(col);
  }

  function focusAddressInput() {
    try {
      const el = document.querySelector('[data-testid="address-input"]') as HTMLInputElement | null;
      if (el) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        el.focus();
        try { el.select(); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }

  const overviewTotalItems = collectionsWithCount.reduce((sum, c) => sum + (typeof c.itemCount === 'number' ? c.itemCount : 0), 0) + nftsWithoutCollection.length;

  React.useEffect(() => {
    if (!onCountsChange) return;
    if (isOwnerNftsLoading) return;
    if (!Number.isFinite(overviewTotalItems)) return;
    onCountsChange(overviewTotalItems);
  }, [onCountsChange, overviewTotalItems, isOwnerNftsLoading]);

  if (!address) {
    return (
      <div className="relative bg-white rounded-xl border border-gray-200 shadow-sm p-6 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-blue-500/40 to-transparent opacity-60" />
        <div className="text-center py-8">
          <p className="text-gray-500">Please enter an address to view NFTs.</p>
        </div>
      </div>
    );
  }

  // Show an explanatory note for any non-EVM input (covers addresses that are not 0x-format
  // but might still pass backend validation and land in empty state UI).
  const isNonEvmInput = address ? getAddressType(address) !== 'evm' : false;

  if (isOwnerNftsLoading) {
    return (
      <div className="relative bg-white rounded-xl border border-gray-200 shadow-sm p-6 overflow-hidden" role="status" aria-live="polite" aria-busy="true">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-blue-500/40 to-transparent opacity-60" />
        <div className="flex items-center justify-center p-8">
          {showOwnerLoader ? <Loader2 className="h-6 w-6 animate-spin" /> : null}
        </div>
      </div>
    );
  }

  if (ownerError) {
    return (
      <div className="relative bg-white rounded-xl border border-gray-200 shadow-sm p-6 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-blue-500/40 to-transparent opacity-60" />
        <div className="flex items-center gap-3 p-4 text-red-700 bg-red-100 rounded-lg">
          <AlertTriangle className="h-5 w-5" />
          <div>
            <h3 className="font-semibold">Error Fetching Collections</h3>
            <p className="text-sm">{ownerError.message}</p>
          </div>
        </div>
      </div>
    );
  }

  // displayedNfts computed above for selected collection; overview renders collections and Other NFTs

  const totalItems = selectedCollection
    ? displayedNfts.length
    : overviewTotalItems;

  const sourceError = ownerInfError ?? fallbackError;
  if (!selectedCollection && sourceError && totalItems === 0) {
    return (
      <div className="relative bg-white rounded-xl border border-gray-200 shadow-sm p-6 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-blue-500/40 to-transparent opacity-60" />
        <div className="flex items-center gap-3 p-4 text-red-700 bg-red-100 rounded-lg">
          <AlertTriangle className="h-5 w-5" />
          <div>
            <h3 className="font-semibold">Error Fetching NFTs</h3>
            <p className="text-sm">{sourceError.message}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedCollection && totalItems === 0) {
    return (
      <div className="relative bg-white rounded-xl border border-gray-200 shadow-sm p-6 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-blue-500/40 to-transparent opacity-60" />
        <h3 className="text-base font-semibold text-gray-900">No NFTs found for this address</h3>
        {isNonEvmInput ? (
          <p className="mt-1 text-sm text-gray-600" data-testid="nft-non-evm-note">
            This Reef address isn’t mapped to an EVM account, so we can’t show EVM-based NFTs.
          </p>
        ) : null}

        <CollectionOpenPanel
          collectionIdInput={collectionIdInput}
          onChangeInput={(v) => setCollectionIdInput(v)}
          onOpen={openCollectionById}
          isOpening={isOpening}
          showHelpLink={true}
          onChangeAddress={focusAddressInput}
          data-testid="empty-open-panel"
        />
      </div>
    );
  }

  return (
    <PreviewPlaybackProvider maxConcurrent={1}>
    <div className="relative bg-white rounded-xl border border-gray-200 shadow-sm p-6 overflow-hidden space-y-6">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-blue-500/40 to-transparent opacity-60" />
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold" data-testid="nft-header">{selectedCollection ? selectedCollection.name : 'NFTs'}</h2>
            <p className="text-sm text-gray-500">Collections and items with media preview</p>
          </div>

          {selectedCollection ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="h-9 px-4 py-2 text-sm font-medium rounded-full" onClick={() => setSelectedCollection(null)} data-testid="back-to-collections">
                <Grid3x3 className="w-3.5 h-3.5" />
                Overview
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className={`h-9 px-4 py-2 text-sm font-medium ${pillClass(collectionFilter === 'all', 'bg-black text-white border-black', 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50')}`}
                onClick={() => setCollectionFilter('all')}
                data-testid="filter-all"
              >
                All
                <Badge variant="secondary" className={`ml-2 ${badgeClass(collectionFilter === 'all')}`}>{displayedNfts.length}</Badge>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={`h-9 px-4 py-2 text-sm font-medium ${pillClass(collectionFilter === 'video', 'bg-pink-600 hover:bg-pink-700 text-white border-pink-600', 'bg-white text-gray-700 border-gray-200 hover:bg-pink-50 hover:text-pink-700 hover:border-pink-300')}`}
                onClick={() => setCollectionFilter('video')}
                data-testid="filter-video"
              >
                <Video className="w-3.5 h-3.5" />
                Videos
                <Badge variant="secondary" className={`ml-2 ${badgeClass(collectionFilter === 'video')}`}>{selectedCollectionVideoCount}</Badge>
              </Button>

              <select
                className="ml-2 border rounded-md px-2 py-1.5 text-sm bg-white"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                disabled={isCollectionLoading}
                aria-label="Items per page"
                data-testid="items-per-page"
              >
                <option value={12}>12</option>
                <option value={24}>24</option>
                <option value={48}>48</option>
              </select>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Overview sections">
              <Button
                type="button"
                role="tab"
                aria-selected={overviewTab === 'collections'}
                variant="outline"
                size="sm"
                className={`h-9 px-4 py-2 text-sm font-medium ${pillClass(overviewTab === 'collections', 'bg-purple-600 hover:bg-purple-700 text-white border-purple-600', 'bg-white text-gray-700 border-gray-200 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300')}`}
                onClick={() => setOverviewTab('collections')}
                data-testid="tab-collections"
              >
                <Layers className="w-3.5 h-3.5" />
                Collections
                <Badge variant="secondary" className={`ml-2 ${badgeClass(overviewTab === 'collections')}`}>{collectionsWithCount.length}</Badge>
              </Button>
              <Button
                type="button"
                role="tab"
                aria-selected={overviewTab === 'video'}
                variant="outline"
                size="sm"
                className={`h-9 px-4 py-2 text-sm font-medium ${pillClass(overviewTab === 'video', 'bg-pink-600 hover:bg-pink-700 text-white border-pink-600', 'bg-white text-gray-700 border-gray-200 hover:bg-pink-50 hover:text-pink-700 hover:border-pink-300')}`}
                onClick={() => setOverviewTab('video')}
                data-testid="tab-video"
              >
                <Video className="w-3.5 h-3.5" />
                Video NFTs
                <Badge variant="secondary" className={`ml-2 ${badgeClass(overviewTab === 'video')}`}>{videoNfts.length}</Badge>
              </Button>
              <Button
                type="button"
                role="tab"
                aria-selected={overviewTab === 'other'}
                variant="outline"
                size="sm"
                className={`h-9 px-4 py-2 text-sm font-medium ${pillClass(overviewTab === 'other', 'bg-orange-600 hover:bg-orange-700 text-white border-orange-600', 'bg-white text-gray-700 border-gray-200 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-300')}`}
                onClick={() => setOverviewTab('other')}
                data-testid="tab-other"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                Other NFTs
                <Badge variant="secondary" className={`ml-2 ${badgeClass(overviewTab === 'other')}`}>{otherNonVideoNfts.length}</Badge>
              </Button>
            </div>
          )}
        </div>

        {!selectedCollection && ownerTotalCount !== null && ownerTotalCount > 0 ? (
          <div className="mt-2 text-xs text-gray-500" data-testid="owner-nfts-progress">
            Loaded {Math.min(loadedOwnerCount, ownerTotalCount)} of {ownerTotalCount} owner NFTs
          </div>
        ) : null}

        {collectionError && selectedCollection ? (
          <div className="flex items-center gap-3 p-4 text-red-700 bg-red-100 rounded-lg">
            <AlertTriangle className="h-5 w-5" />
            <div><h3 className="font-semibold">Error Fetching Collection</h3><p className="text-sm">{collectionError.message}</p></div>
          </div>
        ) : selectedCollection ? (
          <>
            {displayedFiltered.length === 0 && isCollectionLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {Array.from({ length: limit }).map((_, i) => <NftCardSkeleton key={`sk-${i}`} />)}
              </div>
            ) : (
              <>
                <div className="relative">
                  <VirtualizedGrid<Nft>
                    items={displayedFiltered}
                    estimateRowHeight={320}
                    minColumnWidth={200}
                    gap={16}
                    overscan={8}
                    isFetching={isFetchingNextPage}
                    onEndReached={() => {
                      if (!selectedCollection) return;
                      if (!hasNextPage) return;
                      if (isCollectionLoading) return;
                      if (pagingRef.current) return;
                      if (isFetchingNextPage) return;
                      pagingRef.current = true;
                      void fetchNextPage().finally(() => { pagingRef.current = false; });
                    }}
                    renderItem={(nft, idx, info) => {
                      const withinGate = (info?.rowIndex ?? 0) < GATE_ROWS;
                      if (withinGate && isVideoGridActive) registerGateRowId(nft.id);
                      return (
                        <NftCard
                          key={nft.id}
                          nft={nft}
                          onPreview={openViewer}
                          priority={(info?.near ?? false) || idx < 4}
                          onThumbReady={withinGate && isVideoGridActive ? onGateThumbReady : undefined}
                          suspended={!!viewer}
                        />
                      );
                    }}
                  />
                  {scrollGateActive ? (
                  <>
                    {/* Overlay customization: adjust opacity/blur/colors via classNames below. Text comes from OVERLAY_TEXT. */}
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[1px] pointer-events-auto" role="status" aria-live="polite" aria-busy="true" data-testid="row-gate-overlay">
                      <div className="flex items-center gap-3 text-gray-700 rounded-full bg-white/90 shadow px-4 py-2">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="text-sm">{OVERLAY_TEXT}</span>
                      </div>
                    </div>
                  </>
                ) : null}
                </div>
                {isFetchingNextPage ? (
                  <div className="flex justify-center py-2 text-sm text-gray-500">Loading more...</div>
                ) : null}
              </>
            )}
          </>
        ) : (
          <div className="space-y-8">
            {overviewTab === 'collections' && collectionsWithCount.length > 0 && (
              <div>
                <h3 className="text-md font-semibold mb-2" data-testid="collections-title">Collections ({collectionsWithCount.length})</h3>
                <VirtualizedGrid<Collection>
                  items={collectionsWithCount}
                  estimateRowHeight={estimateCollectionRowHeight}
                  minColumnWidth={220}
                  gap={16}
                  renderItem={(col) => (
                    <CollectionCard key={col.id} col={col} onClick={handleSelectCollection} />
                  )}
                  className="w-full"
                  testId="collections-grid"
                  offsetTop={0}
                />
              </div>
            )}
            {overviewTab === 'collections' && collectionsWithCount.length === 0 && (
              <div>
                <div className="text-sm text-gray-600" data-testid="no-collections-note">
                  No collections found for this address.
                </div>
                <CollectionOpenPanel
                  collectionIdInput={collectionIdInput}
                  onChangeInput={(v) => setCollectionIdInput(v)}
                  onOpen={openCollectionById}
                  isOpening={isOpening}
                  showHelpLink={false}
                  onChangeAddress={focusAddressInput}
                  data-testid="no-collections-open-panel"
                />
              </div>
            )}
            {overviewTab === 'video' && videoNfts.length > 0 && (
              <div className="relative">
                <h3 className="text-md font-semibold mb-2">Video NFTs ({videoNfts.length})</h3>
                <VirtualizedGrid<Nft>
                  items={videoNfts}
                  estimateRowHeight={320}
                  minColumnWidth={200}
                  gap={16}
                  overscan={8}
                  maxRows={enableOwnerInfinite ? undefined : videoRows}
                  isFetching={enableOwnerInfinite ? isOwnerInfFetchingNext : revealVideo}
                  onEndReached={() => {
                    if (enableOwnerInfinite) {
                      if (isOwnerInfFetchingNext) return;
                      if (!ownerHasNextPage) return;
                      void fetchOwnerNextPage();
                      return;
                    }
                    if (revealVideo) return;
                    // Defer state updates to avoid setState during VirtualizedGrid render
                    requestAnimationFrame(() => {
                      setRevealVideo(true);
                      setVideoRows(v => v + ROWS_CHUNK);
                      setTimeout(() => setRevealVideo(false), 500);
                    });
                  }}
                  renderItem={(nft, idx, info) => {
                    const withinGate = (info?.rowIndex ?? 0) < GATE_ROWS;
                    if (withinGate && isVideoGridActive) registerGateRowId(nft.id);
                    return (
                      <NftCard
                        key={nft.id}
                        nft={nft}
                        onPreview={openViewer}
                        priority={(info?.near ?? false) || idx < 4}
                        onThumbReady={withinGate && isVideoGridActive ? onGateThumbReady : undefined}
                        suspended={!!viewer}
                      />
                    );
                  }}
                  className="w-full"
                  testId="video-nfts-grid"
                  offsetTop={0}
                />
                {scrollGateActive ? (
                  <>
                    {/* Overlay customization: adjust opacity/blur/colors via classNames below. Text comes from OVERLAY_TEXT. */}
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[1px] pointer-events-auto" role="status" aria-live="polite" aria-busy="true" data-testid="row-gate-overlay">
                      <div className="flex items-center gap-3 text-gray-700 rounded-full bg-white/90 shadow px-4 py-2">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="text-sm">{OVERLAY_TEXT}</span>
                      </div>
                    </div>
                  </>
                ) : null}
                {revealVideo ? (
                  <div className="flex justify-center py-2 text-sm text-gray-500" data-testid="row-loader-video">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading...
                  </div>
                ) : null}
              </div>
            )}
            {overviewTab === 'other' && otherNonVideoNfts.length > 0 && (
              <div>
                <h3 className="text-md font-semibold mb-2">Other NFTs ({otherNonVideoNfts.length})</h3>
                <VirtualizedGrid<Nft>
                  items={otherNonVideoNfts}
                  estimateRowHeight={320}
                  minColumnWidth={200}
                  gap={16}
                  overscan={8}
                  maxRows={enableOwnerInfinite ? undefined : otherRows}
                  isFetching={enableOwnerInfinite ? isOwnerInfFetchingNext : revealOther}
                  onEndReached={() => {
                    if (enableOwnerInfinite) {
                      if (isOwnerInfFetchingNext) return;
                      if (!ownerHasNextPage) return;
                      void fetchOwnerNextPage();
                      return;
                    }
                    if (revealOther) return;
                    // Defer state updates to avoid setState during VirtualizedGrid render
                    requestAnimationFrame(() => {
                      setRevealOther(true);
                      setOtherRows(v => v + ROWS_CHUNK);
                      setTimeout(() => setRevealOther(false), 500);
                    });
                  }}
                  renderItem={(nft, idx, info) => (
                    <NftCard key={nft.id} nft={nft} onPreview={openViewer} priority={(info?.near ?? false) || idx < 4} />
                  )}
                  className="w-full"
                  testId="other-nfts-grid"
                  offsetTop={0}
                />
                {revealOther ? (
                  <div className="flex justify-center py-2 text-sm text-gray-500" data-testid="row-loader-other">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading...
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>

      {viewer ? (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          data-testid="viewer-overlay"
          onClick={() => setViewer(null)}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl ring-1 ring-black/10 p-4 md:p-6 max-w-[min(92vw,860px)] max-h-[88vh] overflow-auto"
            data-testid="viewer-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute top-3 right-3 px-3 py-1.5 text-xs rounded-full bg-gray-900/80 text-white hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-white/40"
              data-testid="viewer-close"
              onClick={() => setViewer(null)}
              aria-label="Close"
            >
              Close
            </button>
            {viewer.name ? (
              <div className="mb-3 pr-14">
                <h3 className="text-sm font-medium text-gray-900 truncate">{viewer.name}</h3>
              </div>
            ) : null}
            <NftMediaViewer
              src={viewer.src}
              poster={viewer.poster ?? null}
              mime={viewer.mime ?? null}
              name={viewer.name ?? null}
              className="block mx-auto w-full h-auto max-w-[560px] sm:max-w-[640px] md:max-w-[720px] lg:max-w-[800px] max-h-[70vh] rounded-xl shadow-lg bg-black"
            />
          </div>
        </div>
      ) : null}
      {/* Global overlay removed; loader is localized within grid containers */}
    </div>
    </PreviewPlaybackProvider>
  );
}

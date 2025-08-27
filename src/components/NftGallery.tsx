import React from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
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
import { normalizeIpfs } from '../utils/ipfs';
import { VirtualizedGrid } from './VirtualizedGrid';

interface NftGalleryProps {
  address: string | null;
  enableOwnerInfinite?: boolean;
}

// Minimal NFT shape used for grouping/aggregation within this component
type NftLite = Pick<Nft, 'id' | 'name' | 'image' | 'media' | 'thumbnail' | 'mimetype' | 'amount' | 'collection'>;

// IPFS helpers are imported from '../utils/ipfs'
// Video thumbnail component moved to './media/nft-video-thumb'

function PreloadTopVideos({ nfts, count = 4 }: { nfts: Nft[]; count?: number }) {
  React.useEffect(() => {
    const head = document.head;
    if (!head) return;
    const toPreload = nfts
      .filter(n => {
        const byMime = typeof n.mimetype === 'string' && n.mimetype.startsWith('video/');
        const u = (n.media ?? n.image) as string | undefined;
        const byExt = typeof u === 'string' && /(\.mp4|\.webm|\.ogv|\.ogg|\.mov|\.mkv|\.m4v)(\?|#|$)/i.test(u);
        return byMime || byExt;
      })
      .slice(0, Math.max(0, count))
      .map(n => normalizeIpfs(n.media ?? n.image) ?? (n.media ?? n.image))
      .filter((href): href is string => typeof href === 'string' && href.length > 0);
    const created: HTMLLinkElement[] = [];
    const seen = new Set<string>();
    for (const href of toPreload) {
      if (seen.has(href)) continue;
      seen.add(href);
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'video';
      link.href = href;
      try {
        const u = new URL(href, window.location.href);
        if (u.origin !== window.location.origin) {
          // Align with <video crossOrigin="anonymous"> to enable reuse
          link.crossOrigin = 'anonymous';
        }
      } catch {}
      // Avoid leaking referrer to gateways
      link.setAttribute('referrerpolicy', 'no-referrer');
      head.appendChild(link);
      created.push(link);
    }
    return () => {
      for (const el of created) {
        try { el.remove(); } catch (e) { void e; }
      }
    };
  }, [nfts, count]);
  return null;
}

function looksVideoUrl(u?: string): boolean {
  try {
    return typeof u === 'string' && /\.(mp4|webm|ogv|ogg|mov|mkv|m4v)(\?|#|$)/i.test(u);
  } catch {
    return false;
  }
}

function isVideoNft(nft: Nft): boolean {
  const mediaUrl = nft.media as string | undefined;
  const imageUrl = nft.image as string | undefined;
  if (typeof nft.mimetype === 'string' && nft.mimetype.startsWith('video/') && !!mediaUrl) return true;
  return looksVideoUrl(mediaUrl) || looksVideoUrl(imageUrl);
}

function NftCard({ nft, onPreview, priority, onThumbReady }: { nft: Nft; onPreview: (n: Nft) => void; priority?: boolean; onThumbReady?: (id: string) => void }) {
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

  if (!nft.image && !nft.thumbnail) {
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
            src={(nft.media ?? nft.image) as string}
            poster={nft.thumbnail ?? nft.image}
            name={nft.name || nft.id}
            className="w-full h-44 sm:h-52 md:h-56 bg-black"
            priority={priority}
            onClick={() => onPreview(nft)}
            onReady={onThumbReady ? (() => onThumbReady(nft.id)) : undefined}
          />
        ) : (
          <NftImage
            imageUrl={nft.thumbnail ?? nft.image ?? null}
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

export function NftGallery({ address, enableOwnerInfinite = false }: NftGalleryProps) {
  const [selectedCollection, setSelectedCollection] = React.useState<Collection | null>(null);
  const [viewer, setViewer] = React.useState<{ src: string; poster?: string; mime?: string; name?: string } | null>(null);
  const { collections: ownerCollections, isLoading: isOwnerLoading, error: ownerError } = useSqwidCollectionsByOwner(address);
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
      if (!Number.isFinite(n)) return 48;
      return Math.min(96, Math.max(8, Math.floor(n)));
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
  } = useSqwidNftsInfinite({ owner: enableOwnerInfinite ? address : null, limit: ownerInfPageSize });
  const { nfts: fallbackNfts, isLoading: isFallbackLoading } = useSqwidNfts(enableOwnerInfinite ? null : address);
  const { resolveEvmAddress, getAddressType, isResolving: isAddrResolving } = useAddressResolver();
  const [resolvedEvm, setResolvedEvm] = React.useState<string | null | undefined>(undefined);
  const pagingRef = React.useRef<boolean>(false);
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
  const isVideoGridActive = !!selectedCollection ? (collectionFilter === 'video') : (overviewTab === 'video');

  const resetGate = React.useCallback(() => {
    gateIdsRef.current = new Set();
    gateReadyRef.current = new Set();
    setScrollGateActive(false);
    if (gateTimeoutRef.current) {
      try { window.clearTimeout(gateTimeoutRef.current); } catch {}
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
    } catch {}
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
          try { window.clearTimeout(gateTimeoutRef.current); } catch {}
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

  React.useEffect(() => {
    let canceled = false;
    if (!address) {
      setResolvedEvm(undefined);
      return () => { canceled = true; };
    }
    const type = getAddressType(address);
    if (type === 'evm') {
      setResolvedEvm(address);
      return () => { canceled = true; };
    }
    (async () => {
      try {
        const evm = await resolveEvmAddress(address);
        if (!canceled) setResolvedEvm(evm);
      } catch {
        if (!canceled) setResolvedEvm(null);
      }
    })();
    return () => { canceled = true; };
  }, [address, getAddressType, resolveEvmAddress]);
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
    const sourceNfts = enableOwnerInfinite ? infiniteNfts : fallbackNfts;
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
  }, [fallbackNfts, ownerCollections]);

  const videoNfts = React.useMemo(() => nftsWithoutCollection.filter(isVideoNft), [nftsWithoutCollection]);
  const otherNonVideoNfts = React.useMemo(() => nftsWithoutCollection.filter(n => !isVideoNft(n)), [nftsWithoutCollection]);

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
    const srcRaw = nft.media ?? nft.image;
    if (!srcRaw) return;
    const posterRaw = nft.thumbnail ?? nft.image;
    const src = normalizeIpfs(srcRaw) ?? srcRaw;
    const poster = normalizeIpfs(posterRaw) ?? posterRaw;
    const mime = nft.mimetype;
    setViewer({ src, poster, mime, name: nft.name });
  }

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setViewer(null);
    }
    if (viewer) {
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
    return () => {};
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
  const displayedNfts: Nft[] = selectedCollection
    ? collectionPageNfts.map((it) => ({
        id: it.id,
        name: it.name ?? 'Unnamed NFT',
        image: it.image,
        media: it.media,
        thumbnail: it.thumbnail,
        mimetype: it.mimetype,
        amount: it.amount,
        collection: selectedCollection ? { id: selectedCollection.id, name: selectedCollection.name, itemCount: selectedCollection.itemCount } : undefined,
      }))
    : [];
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

  if (!address) {
    return (
      <div className="text-center py-8 bg-white rounded-lg shadow">
        <p className="text-gray-500">Please enter an address to view NFTs.</p>
      </div>
    );
  }

  const isSubstrate = address ? getAddressType(address) === 'substrate' : false;
  if (isSubstrate && !isAddrResolving && resolvedEvm === null) {
    return (
      <div className="flex items-center gap-3 p-4 mb-4 text-blue-800 bg-blue-100 rounded-lg" data-testid="nft-requires-evm">
        <AlertTriangle className="h-5 w-5" />
        <div>
          <p>No NFTs available: the provided address is not EVM-mapped.</p>
          <p>Bind an EVM address in your Reef wallet to view NFTs.</p>
        </div>
      </div>
    );
  }

  const isOwnerNftsLoading = enableOwnerInfinite ? isOwnerInfLoading : isFallbackLoading;
  if (isOwnerLoading || isOwnerNftsLoading) {
    return (
      <div className="flex items-center justify-center p-8" role="status" aria-live="polite" aria-busy="true">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (ownerError) {
    return (
      <div className="flex items-center gap-3 p-4 mb-4 text-red-700 bg-red-100 rounded-lg">
        <AlertTriangle className="h-5 w-5" />
        <div>
          <h3 className="font-semibold">Error Fetching Collections</h3>
          <p className="text-sm">{ownerError.message}</p>
        </div>
      </div>
    );
  }

  // displayedNfts computed above for selected collection; overview renders collections and Other NFTs

  const totalItems = selectedCollection
    ? displayedNfts.length
    : (collectionsWithCount.reduce((sum, c) => sum + (typeof c.itemCount === 'number' ? c.itemCount : 0), 0) + nftsWithoutCollection.length);

  if (!selectedCollection && totalItems === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <p className="text-gray-500">No collections or NFTs found for this address. You can open a collection by ID:</p>
        <div className="flex items-center gap-2 mt-2">
          <input
            className="border rounded px-2 py-1 text-sm w-full"
            placeholder="Paste Collection ID (e.g. Jz14NjucSzaXUQ45Hjk1)"
            value={collectionIdInput}
            onChange={(e) => setCollectionIdInput(e.target.value.trim())}
          />
          <button
            type="button"
            className="px-3 py-1 border rounded disabled:opacity-50"
            onClick={() => openCollectionById(collectionIdInput)}
            disabled={!collectionIdInput || isOpening}
          >
            {isOpening ? 'Opening...' : 'Open'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <PreviewPlaybackProvider maxConcurrent={1}>
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold" data-testid="nft-header">
            {selectedCollection ? selectedCollection.name : 'NFTs'}
          </h2>
          {selectedCollection && (
            <div className="flex items-center gap-2">
              <button type="button" className="inline-flex items-center gap-1 px-2 py-1 border rounded" onClick={() => setSelectedCollection(null)} data-testid="back-to-collections">
                Back to Overview
              </button>
              <div className="inline-flex rounded border overflow-hidden" role="tablist" aria-label="Filter items">
                <button
                  type="button"
                  className={`px-2 py-1 text-sm ${collectionFilter === 'all' ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                  onClick={() => setCollectionFilter('all')}
                  data-testid="filter-all"
                >
                  All
                </button>
                <button
                  type="button"
                  className={`px-2 py-1 text-sm border-l ${collectionFilter === 'video' ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                  onClick={() => setCollectionFilter('video')}
                  data-testid="filter-video"
                >
                  Videos
                </button>
                <select
                  className="ml-2 border rounded px-2 py-1 text-sm"
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
            </div>
          )}
          {!selectedCollection && (
            <div className="flex items-center gap-2" role="tablist" aria-label="Overview sections">
              <button
                type="button"
                role="tab"
                aria-selected={overviewTab === 'collections'}
                className={`px-2 py-1 border rounded ${overviewTab === 'collections' ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                onClick={() => setOverviewTab('collections')}
                data-testid="tab-collections"
              >
                Collections
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={overviewTab === 'video'}
                className={`px-2 py-1 border rounded ${overviewTab === 'video' ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                onClick={() => setOverviewTab('video')}
                data-testid="tab-video"
              >
                Video NFTs
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={overviewTab === 'other'}
                className={`px-2 py-1 border rounded ${overviewTab === 'other' ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                onClick={() => setOverviewTab('other')}
                data-testid="tab-other"
              >
                Other NFTs
              </button>
            </div>
          )}
        </div>

        {collectionError && selectedCollection ? (
          <div className="flex items-center gap-3 p-4 text-red-700 bg-red-100 rounded-lg">
            <AlertTriangle className="h-5 w-5" />
            <div><h3 className="font-semibold">Error Fetching Collection</h3><p className="text-sm">{collectionError.message}</p></div>
          </div>
        ) : selectedCollection ? (
          <>
            <PreloadTopVideos nfts={displayedFiltered} count={4} />
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
                          priority={Boolean(info?.near) || idx < 6}
                          onThumbReady={withinGate && isVideoGridActive ? onGateThumbReady : undefined}
                        />
                      );
                    }}
                    className="w-full"
                    testId="nft-grid"
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
            {overviewTab === 'video' && videoNfts.length > 0 && (
              <div className="relative">
                <h3 className="text-md font-semibold mb-2">Video NFTs ({videoNfts.length})</h3>
                <VirtualizedGrid<Nft>
                  items={videoNfts}
                  estimateRowHeight={320}
                  minColumnWidth={200}
                  gap={16}
                  overscan={8}
                  maxRows={videoRows}
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
                        priority={Boolean(info?.near) || idx < 4}
                        onThumbReady={withinGate && isVideoGridActive ? onGateThumbReady : undefined}
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
                  maxRows={otherRows}
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
                    <NftCard key={nft.id} nft={nft} onPreview={openViewer} priority={Boolean(info?.near) || idx < 4} />
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
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          data-testid="viewer-overlay"
          onClick={() => setViewer(null)}
        >
          <div
            className="relative bg-white rounded-md p-3 max-w-[90vw] max-h-[90vh] overflow-auto"
            data-testid="viewer-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              data-testid="viewer-close"
              onClick={() => setViewer(null)}
              aria-label="Close"
            >
              Close
            </button>
            <NftMediaViewer src={viewer.src} poster={viewer.poster ?? null} mime={viewer.mime ?? null} name={viewer.name ?? null} />
          </div>
        </div>
      ) : null}
      {/* Global overlay removed; loader is localized within grid containers */}
    </div>
    </PreviewPlaybackProvider>
  );
}

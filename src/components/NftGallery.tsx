import React from 'react';
import { Loader2, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Nft, Collection, useSqwidNfts } from '../hooks/use-sqwid-nfts';
import { useSqwidCollection } from '../hooks/use-sqwid-collection';
import { NftImage } from './NftImage';
import { useSqwidCollectionsByOwner } from '../hooks/use-sqwid-collections-by-owner';
import { useNftsByOwner } from '../hooks/use-nfts-by-owner';
import { useAddressResolver } from '../hooks/use-address-resolver';
import { NftMediaViewer } from './NftMediaViewer';

interface NftGalleryProps {
  address: string | null;
}

function NftCard({ nft, onPreview }: { nft: Nft; onPreview: (n: Nft) => void }) {
  if (nft.error) {
    return (
      <div className="border rounded-lg p-4 flex flex-col items-center justify-center bg-gray-50 aspect-square">
        <p className="text-red-500 text-sm font-semibold">Loading Failed</p>
        <p className="text-xs text-gray-500 truncate w-full text-center mt-1">{nft.id}</p>
      </div>
    );
  }

  const showAmount = typeof (nft as any).amount === 'number' && (nft as any).amount > 1;
  const amount = showAmount ? (nft as any).amount as number : undefined;

  if (!nft.image && !nft.thumbnail) {
    return (
      <div className="border rounded-lg p-4 flex flex-col items-center justify-center bg-gray-50 aspect-square">
        <div className="w-16 h-16 rounded bg-gray-200 mb-2" />
        <p className="text-gray-600 text-sm">{nft.name || 'Unnamed NFT'}</p>
        {showAmount ? (
          <span className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">x{amount}</span>
        ) : null}
      </div>
    );
  }
  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <div className="relative">
        <NftImage
          imageUrl={nft.thumbnail ?? nft.image ?? null}
          onClick={(nft.media || nft.image) ? (() => onPreview(nft)) : undefined}
          name={nft.name || nft.id}
          className="w-full h-48 object-cover"
        />
        {showAmount ? (
          <span className="absolute top-2 right-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-black/70 text-white">
            x{amount}
          </span>
        ) : null}
      </div>
      <div className="p-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm truncate flex-1">{nft.name || 'Unnamed NFT'}</h3>
          {showAmount ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">x{amount}</span>
          ) : null}
        </div>
        {nft.collection?.name ? (
          <p className="text-xs text-gray-500 truncate">{nft.collection.name}</p>
        ) : null}
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
      <div className="w-full h-32 bg-gray-100 overflow-hidden">
        {col.image ? (
          <img src={col.image} alt={col.name} className="w-full h-full object-cover" loading="lazy" />
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

export function NftGallery({ address }: NftGalleryProps) {
  const [selectedCollection, setSelectedCollection] = React.useState<Collection | null>(null);
  const [viewer, setViewer] = React.useState<{ src: string; poster?: string; mime?: string; name?: string } | null>(null);
  const { collections: ownerCollections, isLoading: isOwnerLoading, error: ownerError } = useSqwidCollectionsByOwner(address);
  const [limit, setLimit] = React.useState<number>(12);
  const [startFrom, setStartFrom] = React.useState<number>(0);
  const [collectionIdInput, setCollectionIdInput] = React.useState<string>("");
  const [isOpening, setIsOpening] = React.useState<boolean>(false);
  const { nfts, isLoading: isNftsLoading } = useNftsByOwner(address || '');
  const { nfts: fallbackNfts, isLoading: isFallbackLoading } = useSqwidNfts(address);
  const { resolveEvmAddress, getAddressType, isResolving: isAddrResolving } = useAddressResolver();
  const [resolvedEvm, setResolvedEvm] = React.useState<string | null | undefined>(undefined);

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
  // NOTE (RU): Логика подсчёта itemCount и бейджа xN
  // - Раньше: полагались на pagination.lowest из REST (часто занижен), что давало расхождения в UI.
  // - Сейчас: считаем total через REST (где доступен) либо пагинируем и дедуплицируем токены
  //   (tokenId -> itemId -> positionId -> id). Для очень малых значений fallback на GraphQL distinct.
  // - В шапке коллекции показываем максимум из (marketplace total) и (число у владельца по GraphQL).
  // - Для секции "Other NFTs" мержим GraphQL-элементы с REST-метаданными Sqwid (вкл. amount),
  //   чтобы бейдж количества xN на карточках был одинаков и внутри коллекции, и вне её.
  const { nftsWithoutCollection, collectionsWithCount }: { nftsWithoutCollection: any[]; collectionsWithCount: Collection[] } = React.useMemo(() => {
    const ownerCols = Array.isArray(ownerCollections) ? ownerCollections : [];
    const hasGraphql = Array.isArray(nfts) && nfts.length > 0;
    const sourceNfts: any[] = hasGraphql ? (nfts as any[]) : (Array.isArray(fallbackNfts) ? (fallbackNfts as any[]) : []);

    // Build helper structures
    const ownerColIdSet = new Set(ownerCols.map(c => c.id)); // REST collection IDs minted by this address
    const fallbackMap = new Map<string, any>(); // `${contract}-${nftId}` -> fallback NFT with collection metadata
    (Array.isArray(fallbackNfts) ? fallbackNfts : []).forEach((it: any) => {
      if (it && typeof it.id === 'string') fallbackMap.set(it.id, it);
    });
    const fallbackCountsByCol = new Map<string, number>();
    (Array.isArray(fallbackNfts) ? fallbackNfts : []).forEach((it: any) => {
      const explicit = it?.collection?.id as string | undefined;
      const derived = (!explicit && typeof it?.id === 'string' && it.id.includes('-')) ? it.id.split('-')[0] : undefined;
      const colId = explicit ?? derived;
      if (!colId || !ownerColIdSet.has(colId)) return;
      fallbackCountsByCol.set(colId, (fallbackCountsByCol.get(colId) ?? 0) + 1);
    });

    if (hasGraphql) {
      // Count owned NFTs per minted collection using GraphQL token.contractId directly
      const countsByCol = new Map<string, number>();
      const othersGraphql: any[] = [];
      for (const nft of sourceNfts) {
        const colId = nft?.token?.id as string | undefined;
        if (colId && ownerColIdSet.has(colId)) {
          countsByCol.set(colId, (countsByCol.get(colId) ?? 0) + 1);
        } else {
          othersGraphql.push(nft);
        }
      }
      // Merge fallback metadata for Other NFTs where available and inject owner's balance as amount
      const mergedOthers = othersGraphql.map((nft: any) => {
        const key = `${nft.token.id}-${nft.nftId}`;
        const fb = fallbackMap.get(key);
        if (!fb) return nft;
        const parsedBal = typeof nft?.balance === 'string' ? Number(nft.balance) : (typeof nft?.balance === 'number' ? nft.balance : undefined);
        const fbAmt = typeof (fb as any)?.amount === 'number' && !Number.isNaN((fb as any).amount) ? (fb as any).amount as number : undefined;
        const amount = typeof parsedBal === 'number' && !Number.isNaN(parsedBal)
          ? (typeof fbAmt === 'number' ? Math.max(fbAmt, parsedBal) : parsedBal)
          : fbAmt;
        return amount !== undefined ? { ...fb, amount } : fb;
      });

      // Prefer larger of: marketplace total (possibly global) vs owner-held count from GraphQL
      const collectionsWithItemCount: Collection[] = ownerCols.map(collection => {
        const baseCount = typeof (collection as any)?.itemCount === 'number' ? (collection as any).itemCount as number : 0;
        const ownedCount = countsByCol.get(collection.id) ?? 0;
        const itemCount = Math.max(baseCount, ownedCount);
        return { ...collection, itemCount } as Collection;
      });
      return { nftsWithoutCollection: mergedOthers, collectionsWithCount: collectionsWithItemCount };
    }

    // Fallback path: GraphQL returned empty; derive classification and counts from fallback NFTs
    const collectionsWithItemCount: Collection[] = ownerCols.map(c => ({
      ...c,
      itemCount: fallbackCountsByCol.get(c.id) ?? 0,
    }));
    const nftsWithoutCollection = (Array.isArray(fallbackNfts) ? fallbackNfts : []).filter((it: any) => {
      const explicit = it?.collection?.id as string | undefined;
      const derived = (!explicit && typeof it?.id === 'string' && it.id.includes('-')) ? it.id.split('-')[0] : undefined;
      const colId = explicit ?? derived;
      return !colId || !ownerColIdSet.has(colId);
    });
    return { nftsWithoutCollection, collectionsWithCount: collectionsWithItemCount };
  }, [nfts, fallbackNfts, ownerCollections]);

  function sanitizeName(name?: string): string | undefined {
    if (!name) return name;
    return name.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function normalizeIpfs(url?: string | null): string | undefined {
    if (!url) return undefined;
    if (url.startsWith('ipfs://')) return `https://reef.infura-ipfs.io/ipfs/${url.slice('ipfs://'.length)}`;
    return url;
  }

  React.useEffect(() => {
    setStartFrom(0);
  }, [address]);

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

  const { nfts: collectionNfts, total: collectionTotal, isLoading: isCollectionLoading, error: collectionError } =
    useSqwidCollection({ collectionId: selectedCollection?.id ?? null, limit, startFrom });

  async function openCollectionById(id: string) {
    if (!id) return;
    setIsOpening(true);
    try {
      const found = collectionsWithCount.find(c => c.id === id);
      const name = sanitizeName(found?.name || 'Collection') || 'Collection';
      const image = normalizeIpfs(found?.image);
      setStartFrom(0);
      setSelectedCollection({ id, name, image, itemCount: found?.itemCount ?? 0 });
    } finally {
      setIsOpening(false);
    }
  }

  function handleSelectCollection(col: Collection) {
    setStartFrom(0);
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

  if (isOwnerLoading || isNftsLoading || isFallbackLoading) {
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

  const displayedNfts: Nft[] = selectedCollection
    ? collectionNfts.map((it) => ({
        id: it.id,
        name: it.name ?? 'Unnamed NFT',
        image: it.image,
        media: (it as any).media,
        thumbnail: (it as any).thumbnail,
        mimetype: (it as any).mimetype,
        amount: (it as any).amount,
        collection: selectedCollection ? { id: selectedCollection.id, name: selectedCollection.name, itemCount: selectedCollection.itemCount } : undefined,
      }))
    : [];

  const totalItems = selectedCollection
    ? (typeof collectionTotal === 'number' ? collectionTotal : displayedNfts.length)
    : (collectionsWithCount.reduce((sum, c) => sum + (typeof c.itemCount === 'number' ? c.itemCount : 0), 0) + nftsWithoutCollection.length);
  const headerCount = selectedCollection
    ? (typeof collectionTotal === 'number' ? collectionTotal : (selectedCollection.itemCount ?? displayedNfts.length))
    : totalItems;

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
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold" data-testid="nft-header">
            {selectedCollection ? `${selectedCollection.name} (${headerCount})` : 'NFTs'}
          </h2>
          {selectedCollection && (
            <div className="flex items-center gap-2">
              <button type="button" className="inline-flex items-center gap-1 px-2 py-1 border rounded" onClick={() => setSelectedCollection(null)} data-testid="back-to-collections">
                Back to Overview
              </button>
              <button type="button" className="inline-flex items-center gap-1 px-2 py-1 border rounded disabled:opacity-50" onClick={() => setStartFrom(Math.max(0, startFrom - limit))} disabled={isCollectionLoading || startFrom === 0}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <button type="button" className="inline-flex items-center gap-1 px-2 py-1 border rounded disabled:opacity-50" onClick={() => setStartFrom(startFrom + limit)} disabled={isCollectionLoading || (typeof collectionTotal === 'number' && startFrom + limit >= collectionTotal)}>
                Next <ChevronRight className="h-4 w-4" />
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
          )}
        </div>

        {isCollectionLoading && selectedCollection ? (
          <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : collectionError && selectedCollection ? (
          <div className="flex items-center gap-3 p-4 text-red-700 bg-red-100 rounded-lg">
            <AlertTriangle className="h-5 w-5" />
            <div><h3 className="font-semibold">Error Fetching Collection</h3><p className="text-sm">{collectionError.message}</p></div>
          </div>
        ) : selectedCollection ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {displayedNfts.map(nft => <NftCard key={nft.id} nft={nft} onPreview={openViewer} />)}
          </div>
        ) : (
          <div className="space-y-8">
            {collectionsWithCount.length > 0 && (
              <div>
                <h3 className="text-md font-semibold mb-2" data-testid="collections-title">Collections ({collectionsWithCount.length})</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {collectionsWithCount.map(col => <CollectionCard key={col.id} col={col} onClick={handleSelectCollection} />)}
                </div>
              </div>
            )}
            {nftsWithoutCollection.length > 0 && (
              <div>
                <h3 className="text-md font-semibold mb-2">Other NFTs ({nftsWithoutCollection.length})</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {nftsWithoutCollection.map((nft: any) => {
                    const isPreMapped = nft && typeof nft.image === 'string' && !nft.token;
                    const nftToRender: Nft = isPreMapped
                      ? nft
                      : {
                          id: nft.id,
                          name: nft?.nftId ? `Token #${nft.nftId}` : 'Unnamed NFT',
                          image: undefined,
                          // NOTE: derive amount from Subsquid balance for GraphQL-only items (ERC1155 > 1)
                          amount: (() => {
                            const raw = typeof nft?.balance === 'string' ? Number(nft.balance) : (typeof nft?.balance === 'number' ? nft.balance : undefined);
                            return typeof raw === 'number' && !Number.isNaN(raw) ? raw : undefined;
                          })(),
                          collection: undefined,
                        };
                    return <NftCard key={nftToRender.id} nft={nftToRender} onPreview={openViewer} />;
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {viewer ? (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setViewer(null)}>
          <div className="relative bg-white rounded-md p-3 max-w-[90vw] max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              onClick={() => setViewer(null)}
              aria-label="Close"
            >
              Close
            </button>
            <NftMediaViewer src={viewer.src} poster={viewer.poster ?? null} mime={viewer.mime ?? null} name={viewer.name ?? null} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

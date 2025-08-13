import React from 'react';
import { Loader2, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Nft, Collection } from '../hooks/use-sqwid-nfts';
import { useSqwidCollection } from '../hooks/use-sqwid-collection';
import { NftImage } from './NftImage';
import { useSqwidCollectionsByOwner } from '../hooks/use-sqwid-collections-by-owner';

interface NftGalleryProps {
  address: string | null;
}

function NftCard({ nft }: { nft: Nft }) {
  if (nft.error) {
    return (
      <div className="border rounded-lg p-4 flex flex-col items-center justify-center bg-gray-50 aspect-square">
        <p className="text-red-500 text-sm font-semibold">Loading Failed</p>
        <p className="text-xs text-gray-500 truncate w-full text-center mt-1">{nft.id}</p>
      </div>
    );
  }

  if (!nft.image) {
    return (
      <div className="border rounded-lg p-4 flex flex-col items-center justify-center bg-gray-50 aspect-square">
        <div className="w-16 h-16 rounded bg-gray-200 mb-2" />
        <p className="text-gray-600 text-sm">{nft.name || 'Unnamed NFT'}</p>
      </div>
    );
  }

  const showAmount = typeof (nft as any).amount === 'number' && (nft as any).amount > 1;
  const amount = showAmount ? (nft as any).amount as number : undefined;
  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <div className="relative">
        <NftImage imageUrl={nft.image ?? null} name={nft.name || nft.id} className="w-full h-48 object-cover" />
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
  const { collections: ownerCollections, total: ownerTotal, isLoading: isOwnerLoading, error: ownerError } = useSqwidCollectionsByOwner(
    address,
    { limit: 50, startFrom: 0, disableCounts: !!selectedCollection }
  );
  // Start with collections overview; select a collection to open its NFTs
  const [limit, setLimit] = React.useState<number>(12);
  const [startFrom, setStartFrom] = React.useState<number>(0);
  const [collectionIdInput, setCollectionIdInput] = React.useState<string>("");
  const [isOpening, setIsOpening] = React.useState<boolean>(false);

  // Helpers: sanitize names and normalize IPFS urls
  function sanitizeName(name?: string): string | undefined {
    if (!name) return name;
    // remove zero-width, non-breaking spaces and trim
    return name.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function normalizeIpfs(url?: string | null): string | undefined {
    if (!url) return undefined;
    if (url.startsWith('ipfs://')) return `https://reef.infura-ipfs.io/ipfs/${url.slice('ipfs://'.length)}`;
    return url;
  }

  React.useEffect(() => {
    // When the address changes, keep the selected collection but reset pagination
    setStartFrom(0);
  }, [address]);

  // Removed effect-based reset to avoid intermediate query keys causing double fetches

  // Load NFTs by collection when a collection is selected
  const collectionId = selectedCollection?.id ?? null;
  const { nfts: collectionNfts, total: collectionTotal, isLoading: isCollectionLoading, error: collectionError } =
    useSqwidCollection({ collectionId, limit, startFrom });

  async function openCollectionById(id: string) {
    if (!id) return;
    setIsOpening(true);
    try {
      // Reuse data from ownerCollections if present; avoid extra network prefetch
      const found = ownerCollections.find(c => c.id === id);
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



  if (!address && !selectedCollection) {
    return (
      <div className="text-center py-8 bg-white rounded-lg shadow">
        <p className="text-gray-500">Please enter an address to view NFTs.</p>
      </div>
    );
  }

  if (!selectedCollection && isOwnerLoading) {
    return (
      <div className="flex items-center justify-center p-8" role="status" aria-live="polite" aria-busy="true">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!selectedCollection && ownerError) {
    return (
      <div className="flex items-center gap-3 p-4 mb-4 text-red-700 bg-red-100 rounded-lg">
        <AlertTriangle className="h-5 w-5" />
        <div>
          <h3 className="font-semibold">Error Fetching NFTs</h3>
          <p className="text-sm">{ownerError.message}</p>
        </div>
      </div>
    );
  }

  // Display list depends on mode
  const displayed: Nft[] = selectedCollection
    ? collectionNfts.map((it) => ({
        id: it.id,
        name: it.name ?? 'Unnamed NFT',
        image: it.image,
        // pass through amount so the badge can render
        amount: (it as any).amount,
        collection: selectedCollection ? { id: selectedCollection.id, name: selectedCollection.name, itemCount: selectedCollection.itemCount } : undefined,
      }))
    : [];
  const total = selectedCollection ? (collectionTotal ?? displayed.length) : (ownerTotal ?? ownerCollections.length);
  const showLoader = !!selectedCollection && isCollectionLoading;
  const showError = !!selectedCollection && !!collectionError;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center flex-wrap gap-2">
          {ownerCollections.map(col => (
            <button
              key={col.id}
              type="button"
              onClick={() => handleSelectCollection(col as Collection)}
              className={`px-3 py-1 rounded border text-sm ${selectedCollection?.id === col.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
              title={col.name}
            >
              {col.name}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold" data-testid="collections-title">
            {selectedCollection ? selectedCollection.name : 'Collections'} ({total})
          </h2>
          {selectedCollection ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 px-2 py-1 border rounded"
                onClick={() => setSelectedCollection(null)}
                aria-label="Back to collections"
                data-testid="back-to-collections"
              >
                Collections
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 px-2 py-1 border rounded disabled:opacity-50"
                onClick={() => setStartFrom(Math.max(0, startFrom - limit))}
                disabled={showLoader || startFrom === 0}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 px-2 py-1 border rounded disabled:opacity-50"
                onClick={() => setStartFrom(startFrom + limit)}
                disabled={showLoader || (typeof total === 'number' && startFrom + limit >= total)}
                aria-label="Next page"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
              <select
                className="ml-2 border rounded px-2 py-1 text-sm"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                disabled={showLoader}
                aria-label="Items per page"
                data-testid="items-per-page"
              >
                <option value={12}>12</option>
                <option value={24}>24</option>
                <option value={48}>48</option>
              </select>
            </div>
          ) : null}
        </div>

        {showLoader ? (
          <div className="flex items-center justify-center p-8" role="status" aria-live="polite" aria-busy="true">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : showError ? (
          <div className="flex items-center gap-3 p-4 mb-4 text-red-700 bg-red-100 rounded-lg">
            <AlertTriangle className="h-5 w-5" />
            <div>
              <h3 className="font-semibold">Error Fetching Collection</h3>
              <p className="text-sm">{collectionError?.message}</p>
            </div>
          </div>
        ) : (
          !selectedCollection ? (
            ownerCollections.length === 0 ? (
              <div className="space-y-3" data-testid="no-collections">
                <p className="text-gray-500">No collections found for this address. You can open a collection by ID:</p>
                <div className="flex items-center gap-2">
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
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {ownerCollections.map(col => (
                  <CollectionCard key={col.id} col={col as Collection} onClick={setSelectedCollection} />
                ))}
              </div>
            )
          ) : (
            displayed.length === 0 ? (
              <p className="text-gray-500">No NFTs found.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {displayed.map(nft => (
                  <NftCard key={nft.id} nft={nft} />
                ))}
              </div>
            )
          )
        )}
      </div>
    </div>
  );
}

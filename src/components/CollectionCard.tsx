import React from 'react';
import { buildCandidates, normalizeIpfs } from '../utils/ipfs';

interface Collection {
  id: string;
  name: string;
  image: string;
}

interface CollectionCardProps {
  collection: Collection;
  onClick: (collection: Collection) => void;
}

export const CollectionCard: React.FC<CollectionCardProps> = ({ collection, onClick }) => {
  const candidates = React.useMemo(() => buildCandidates(collection.image), [collection.image]);
  const [idx, setIdx] = React.useState(0);
  const [failed, setFailed] = React.useState(false);
  const imgSrc = failed
    ? 'https://via.placeholder.com/192x192?text=No+Image'
    : (candidates[idx] ?? (normalizeIpfs(collection.image) ?? 'https://via.placeholder.com/192x192?text=No+Image'));
  return (
    <div 
      className="w-48 h-64 border rounded-lg overflow-hidden cursor-pointer transform transition-transform hover:scale-105 shadow-md hover:shadow-lg flex flex-col justify-between bg-white" 
      onClick={() => onClick(collection)}
    >
      <div className="w-full h-48 bg-gray-200">
        <img 
          src={imgSrc}
          alt={collection.name} 
          className="w-full h-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setIdx((i) => {
            const next = i + 1;
            if (next < candidates.length) return next;
            setFailed(true);
            return i;
          })}
        />
      </div>
      <div className="p-2 text-center">
        <h3 className="font-bold text-sm truncate">{collection.name || 'Unnamed Collection'}</h3>
      </div>
    </div>
  );
};

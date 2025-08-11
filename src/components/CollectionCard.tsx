import React from 'react';

const toIpfsUrl = (ipfsUri: string): string => {
  if (!ipfsUri) return '';
  if (ipfsUri.startsWith('ipfs://')) {
    return `https://reef.infura-ipfs.io/ipfs/${ipfsUri.split('ipfs://')[1]}`;
  }
  return ipfsUri;
};

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
  return (
    <div 
      className="w-48 h-64 border rounded-lg overflow-hidden cursor-pointer transform transition-transform hover:scale-105 shadow-md hover:shadow-lg flex flex-col justify-between bg-white" 
      onClick={() => onClick(collection)}
    >
      <div className="w-full h-48 bg-gray-200">
        <img 
          src={toIpfsUrl(collection.image)} 
          alt={collection.name} 
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/192x192?text=No+Image'; }}
        />
      </div>
      <div className="p-2 text-center">
        <h3 className="font-bold text-sm truncate">{collection.name || 'Unnamed Collection'}</h3>
      </div>
    </div>
  );
};

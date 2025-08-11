import React from 'react';

const toIpfsUrl = (ipfsUri: string): string => {
  if (!ipfsUri) return '';
  if (ipfsUri.startsWith('ipfs://')) {
    return `https://reef.infura-ipfs.io/ipfs/${ipfsUri.split('ipfs://')[1]}`;
  }
  return ipfsUri;
};

interface Nft {
  id: string;
  name: string;
  image: string;
}

interface NftCardProps {
  nft: Nft;
}

export const NftCard: React.FC<NftCardProps> = ({ nft }) => {
  return (
    <div className="w-full border rounded-lg overflow-hidden shadow-md bg-white">
      <div className="w-full aspect-square bg-gray-200">
        <img 
          src={toIpfsUrl(nft.image)} 
          alt={nft.name} 
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=No+Image'; }}
        />
      </div>
      <div className="p-2">
        <h3 className="font-bold text-sm truncate">{nft.name || 'Unnamed NFT'}</h3>
      </div>
    </div>
  );
};

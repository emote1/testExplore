import React from 'react';
interface NftImageProps {
  imageUrl: string | null;
  name: string;
  className?: string;
}

function toCidPath(url: string): string | null {
  if (!url) return null;
  if (url.startsWith('ipfs://')) return url.replace('ipfs://', '');
  const m = url.match(/\/ipfs\/([^?#]+)/);
  return m ? m[1] : null;
}

function buildCandidates(url: string): string[] {
  const cidPath = toCidPath(url);
  if (!cidPath) return [url];
  const gateways = [
    'https://reef.infura-ipfs.io/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
  ];
  return gateways.map((g) => `${g}${cidPath}`);
}

export function NftImage({ imageUrl, name, className }: NftImageProps) {
  const fallbackBox = (
    <div className="h-10 w-10 rounded-md bg-gray-100 text-xs flex items-center justify-center text-gray-500">No img</div>
  );
  if (!imageUrl) return fallbackBox;

  const candidates = buildCandidates(imageUrl);
  const [idx, setIdx] = React.useState(0);
  const src = candidates[idx] ?? imageUrl;

  function onError() {
    setIdx((i) => (i + 1 < candidates.length ? i + 1 : i));
  }

  return (
    <a href={src} target="_blank" rel="noopener noreferrer">
      <img src={src} alt={name} onError={onError} className={className ?? 'h-10 w-10 rounded-md object-cover'} loading="lazy" />
    </a>
  );
}

import React from 'react';
import { buildCandidates } from '../utils/ipfs';
interface NftImageProps {
  imageUrl: string | null;
  name: string;
  className?: string;
  onClick?: () => void;
  priority?: boolean;
  sizes?: string;
  onReady?: () => void;
}

export function NftImage({ imageUrl, name, className, onClick, priority, sizes, onReady }: NftImageProps) {
  const [idx, setIdx] = React.useState(0);
  const [failed, setFailed] = React.useState(false);
  const readySentRef = React.useRef(false);
  const fireReady = React.useCallback(() => {
    if (readySentRef.current) return;
    readySentRef.current = true;
    if (onReady) onReady();
  }, [onReady]);
  // If no image URL, consider ready to avoid indefinite gating
  React.useEffect(() => {
    if (!imageUrl) fireReady();
  }, [imageUrl, fireReady]);
  // When all candidates fail, mark ready (we show fallback)
  React.useEffect(() => {
    if (failed) fireReady();
  }, [failed, fireReady]);
  const fallbackBox = (
    <div className="h-10 w-10 rounded-md bg-gray-100 text-xs flex items-center justify-center text-gray-500">No img</div>
  );
  if (!imageUrl || failed) return fallbackBox;

  const candidates = buildCandidates(imageUrl);
  const src = candidates[idx] ?? imageUrl;
  const cn = `${className ?? 'h-10 w-10 rounded-md object-cover'}${onClick ? ' cursor-pointer' : ''}`;

  function onError() {
    setIdx((i) => {
      const next = i + 1;
      if (next < candidates.length) return next;
      setFailed(true);
      return i;
    });
  }

  return (
    <img
      src={src}
      alt={name}
      onError={onError}
      onLoad={fireReady}
      onClick={onClick}
      className={cn}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      sizes={sizes ?? '(min-width: 1280px) 16vw, (min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw'}
      draggable={false}
      referrerPolicy="no-referrer"
      style={{ contentVisibility: 'auto' }}
    />
  );
}

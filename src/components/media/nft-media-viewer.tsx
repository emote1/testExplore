import React from 'react';
import { buildCandidates } from '../../utils/ipfs';

interface NftMediaViewerProps {
  src?: string | null;
  poster?: string | null;
  mime?: string | null;
  name?: string | null;
  className?: string;
}

function getKindFromMime(mime?: string | null): 'video' | 'audio' | 'image' | null {
  if (!mime) return null;
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('image/')) return 'image';
  return null;
}

function getKindFromUrl(url?: string | null): 'video' | 'audio' | 'image' | null {
  if (!url) return null;
  const u = url.split('?')[0].toLowerCase();
  if (/(\.mp4|\.webm|\.ogg|\.ogv|\.mov|\.mkv|\.m4v)$/.test(u)) return 'video';
  if (/(\.mp3|\.wav|\.m4a|\.oga|\.ogg|\.flac|\.aac)$/.test(u)) return 'audio';
  if (/(\.png|\.jpg|\.jpeg|\.gif|\.webp|\.avif|\.bmp|\.svg)$/.test(u)) return 'image';
  return null;
}

export function NftMediaViewer({ src, poster, mime, name, className }: NftMediaViewerProps) {
  const kindHint = getKindFromMime(mime) ?? getKindFromUrl(src);
  const [videoFailed, setVideoFailed] = React.useState(false);
  const [imgIdx, setImgIdx] = React.useState(0);
  const vidRef = React.useRef<HTMLVideoElement | null>(null);
  const [mutedAuto, setMutedAuto] = React.useState(false);

  React.useEffect(() => {
    setVideoFailed(false);
    setImgIdx(0);
  }, [src, mime]);

  // IPFS candidates via shared helper

  const srcCandidates = buildCandidates(src);
  const posterCandidates = buildCandidates(poster);
  const posterSrc = posterCandidates[0] ?? undefined;
  const imgCandidates = srcCandidates.length ? srcCandidates : (src ? [src] : []);
  const imgSrc = imgCandidates[imgIdx];
  const [vidIdx, setVidIdx] = React.useState(0);
  const [audIdx, setAudIdx] = React.useState(0);
  const videoSrc = (srcCandidates[vidIdx] ?? src) ?? undefined;
  const audioSrc = (srcCandidates[audIdx] ?? src) ?? undefined;

  if (!src) {
    return (
      <div className={className ?? 'w-full h-64 bg-gray-100 rounded-md flex items-center justify-center text-gray-500'}>
        No media
      </div>
    );
  }

  // Prefer video if explicit or if type unknown; fall back to image on error
  if (!videoFailed && (kindHint === 'video' || kindHint == null)) {
    return (
      <video
        ref={vidRef}
        className={className ?? 'max-w-full max-h-[80vh] rounded-md bg-black'}
        data-testid="viewer-video"
        controls
        autoPlay
        loop
        preload="auto"
        playsInline
        muted={mutedAuto}
        poster={posterSrc}
        aria-label={name ?? 'NFT video'}
        src={videoSrc}
        onLoadedData={() => {
          const el = vidRef.current;
          if (!el) return;
          const p = el.play();
          if (p && typeof p.catch === 'function') {
            p.catch(() => {
              try {
                el.muted = true;
                setMutedAuto(true);
                el.play().catch(() => undefined);
              } catch (e) { void e; }
            });
          }
        }}
        onError={() => {
          setVidIdx((i) => {
            const next = i + 1;
            if (next < srcCandidates.length) return next;
            setVideoFailed(true);
            return i;
          });
        }}
      >
        Your browser does not support the video tag.
      </video>
    );
  }

  if (kindHint === 'audio') {
    return (
      <div className={className ?? 'w-full max-w-2xl'}>
        {posterSrc ? (
          <img src={posterSrc} alt={name ?? 'NFT poster'} className="w-full max-h-[50vh] object-contain rounded-md mb-2" />
        ) : null}
        <audio
          className="w-full"
          controls
          preload="metadata"
          aria-label={name ?? 'NFT audio'}
          src={audioSrc}
          onError={() => setAudIdx((i) => (i + 1 < srcCandidates.length ? i + 1 : i))}
        >
          Your browser does not support the audio element.
        </audio>
      </div>
    );
  }

  return (
    <img
      src={imgSrc}
      alt={name ?? 'NFT image'}
      className={className ?? 'max-w-full max-h-[80vh] object-contain rounded-md'}
      loading="lazy"
      onError={() => setImgIdx((i) => (i + 1 < imgCandidates.length ? i + 1 : i))}
    />
  );
}

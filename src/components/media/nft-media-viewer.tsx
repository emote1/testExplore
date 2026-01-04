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
  const [ratio, setRatio] = React.useState<number | null>(null);
  const [showPoster, setShowPoster] = React.useState(false);
  const [snapshotUrl, setSnapshotUrl] = React.useState<string | null>(null);

  function restoreAndPlay() {
    const el = vidRef.current;
    if (!el) return;
    if (!el.getAttribute('src') && videoSrc) {
      try { el.setAttribute('src', videoSrc); } catch { /* ignore */ }
      try { el.load(); } catch { /* ignore */ }
    }
    setShowPoster(false);
    setSnapshotUrl(null);
    try {
      const p = el.play();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (p && typeof (p as any).catch === 'function') (p as any).catch(() => undefined);
    } catch { /* ignore play errors */ }
  }

  React.useEffect(() => {
    setVideoFailed(false);
    setImgIdx(0);
    setRatio(null);
    setShowPoster(false);
    setSnapshotUrl(null);
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
      <div className={className ?? 'max-w-full max-h-[80vh] rounded-md bg-black'} style={{ aspectRatio: ratio ?? '16 / 9', minHeight: 200, position: 'relative' }}>
        <button
          type="button"
          aria-label="Replay"
          title="Replay"
          onClick={restoreAndPlay}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); restoreAndPlay(); } }}
          className="absolute inset-0 z-10"
          style={{ opacity: showPoster ? 1 : 0, pointerEvents: showPoster ? 'auto' : 'none', transition: 'opacity 150ms ease', background: 'transparent' }}
        >
          {posterSrc || snapshotUrl ? (
            <img
              src={snapshotUrl ?? posterSrc}
              alt={name ?? 'NFT poster'}
              className="w-full h-full object-contain rounded-md"
              draggable={false}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="px-3 py-1 rounded-full bg-white/80 text-gray-800 text-sm shadow">Replay</div>
            </div>
          )}
        </button>
        <video
          ref={vidRef}
          className={'w-full h-full rounded-md bg-black'}
          data-testid="viewer-video"
          crossOrigin="anonymous"
          controls={!showPoster}
          autoPlay
          preload="metadata"
          playsInline
          muted={mutedAuto}
          poster={posterSrc}
          aria-label={name ?? 'NFT video'}
          src={videoSrc}
          onLoadedMetadata={() => {
            const el = vidRef.current;
            if (!el) return;
            const vw = el.videoWidth;
            const vh = el.videoHeight;
            if (vw > 0 && vh > 0) setRatio(vw / vh);
          }}
        onClick={restoreAndPlay}
        onPlay={() => {
          const el = vidRef.current;
          if (!el) return;
          if (!el.getAttribute('src') && videoSrc) {
            try { el.setAttribute('src', videoSrc); } catch { /* ignore */ }
            try { el.load(); } catch { /* ignore */ }
            const p = el.play();
            if (p && typeof p.catch === 'function') p.catch(() => undefined);
          }
          setShowPoster(false);
          setSnapshotUrl(null);
        }}
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
        onEnded={() => {
          const el = vidRef.current;
          if (!el) return;
          // Try to capture last frame as data URL to show as overlay
          try {
            const vw = el.videoWidth;
            const vh = el.videoHeight;
            if (vw > 0 && vh > 0) {
              const canvas = document.createElement('canvas');
              canvas.width = vw; canvas.height = vh;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(el, 0, 0, vw, vh);
                try {
                  const url = canvas.toDataURL('image/webp', 0.85);
                  if (url && url.startsWith('data:image')) setSnapshotUrl(url);
                } catch { /* canvas may be tainted by CORS; ignore */ }
              }
            }
          } catch { /* ignore snapshot errors */ }
          try { el.pause(); } catch { /* ignore */ }
          try { el.autoplay = false; } catch { /* ignore */ }
          try { el.loop = false; } catch { /* ignore */ }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          try { (el as any).preload = 'none'; } catch { /* ignore */ }
          try { el.currentTime = 0; } catch { /* ignore */ }
          try { el.removeAttribute('src'); } catch { /* ignore */ }
          try { el.load(); } catch { /* ignore */ }
          setShowPoster(true);
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
      </div>
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

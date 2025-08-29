import React from 'react';
import { buildCandidates } from '../../utils/ipfs';
import { useInView } from '../../hooks/use-in-view';
import { usePreviewPlayback } from '../../hooks/use-preview-playback';

interface NftVideoThumbProps {
  src: string;
  poster?: string;
  name?: string;
  className?: string;
  onClick?: () => void;
  priority?: boolean;
  onReady?: () => void;
}

export function NftVideoThumb({ src, poster, name, className, onClick, priority, onReady }: NftVideoThumbProps) {
  const srcCandidates = buildCandidates(src);
  const posterCandidates = buildCandidates(poster);
  const [idx, setIdx] = React.useState(0);
  const videoSrc = srcCandidates[idx] ?? src;
  const cn = `${className ?? 'w-full h-48'} bg-black${onClick ? ' cursor-pointer' : ''}`;
  const vidRef = React.useRef<HTMLVideoElement | null>(null);
  const { ref: containerRef, inView } = useInView<HTMLDivElement>({ rootMargin: '2200px', threshold: 0.1, once: true });
  const { ref: visibleRef, inView: isVisible } = useInView<HTMLDivElement>({ rootMargin: '0px', threshold: 0.5, once: false });
  const [isHovering, setIsHovering] = React.useState(false);
  const lastTapRef = React.useRef<number>(0);
  const { register, unregister, ensureExclusive } = usePreviewPlayback();
  const seekRef = React.useRef<number>(0.25);
  const [videoFailed, setVideoFailed] = React.useState(false);
  const readySentRef = React.useRef(false);
  const fireReady = React.useCallback(() => {
    if (readySentRef.current) return;
    readySentRef.current = true;
    if (onReady) onReady();
  }, [onReady]);
  const poster0 = posterCandidates[0] ?? '';
  const posterLooksVideo = /(.mp4|.webm|.mov|.m4v)(\?|#|$)/i.test(poster0);
  const hasValidPoster = !!poster0 && !posterLooksVideo;
  const posterUrl = hasValidPoster ? poster0 : undefined;
  const [forceLoad, setForceLoad] = React.useState(false);
  const shouldLoad = !!priority || inView || forceLoad;
  const [posterFailed, setPosterFailed] = React.useState(false);
  const [showPoster, setShowPoster] = React.useState<boolean>(!!posterUrl);

  const startHover = React.useCallback(() => {
    setForceLoad(true);
    setIsHovering(true);
    setShowPoster(false);
    const el = vidRef.current;
    if (!el) return;
    el.muted = true;
    ensureExclusive(el);
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => undefined);
  }, [ensureExclusive]);

  const endHover = React.useCallback(() => {
    setIsHovering(false);
    setShowPoster(!!posterUrl && !posterFailed);
    const el = vidRef.current;
    if (!el) return;
    try { el.pause(); } catch { /* ignore: pausing preview video not critical */ }
    try { el.currentTime = seekRef.current; } catch { /* ignore: seeking can fail on some browsers */ }
  }, [posterUrl, posterFailed]);

  React.useEffect(() => {
    const el = vidRef.current;
    if (el) register(el);
    return () => { if (el) unregister(el); };
  }, [register, unregister]);

  // Do not autoplay based on visibility; only play on hover/tap. Always pause when not hovering.
  React.useEffect(() => {
    const el = vidRef.current;
    if (!el) return;
    if (!isHovering) {
      try { el.pause(); } catch { /* ignore */ }
      try { el.currentTime = seekRef.current; } catch { /* ignore */ }
    }
  }, [isVisible, isHovering]);

  if (videoFailed) {
    if (posterUrl && !posterFailed) {
      return (
        <div ref={(el) => { containerRef(el); visibleRef(el); }} className="relative">
          <img
            src={posterUrl}
            alt={name ?? 'NFT preview'}
            className={cn + ' object-cover rounded-none'}
            onClick={onClick}
            onMouseEnter={startHover}
            onMouseLeave={endHover}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            draggable={false}
            referrerPolicy="no-referrer"
            onLoad={fireReady}
            onError={() => { setPosterFailed(true); fireReady(); }}
          />
        </div>
      );
    }
    // Fallback placeholder when both video and poster failed
    return (
      <div ref={(el) => { containerRef(el); visibleRef(el); if (el) fireReady(); }} className="relative">
        <div className={cn + ' rounded-none flex items-center justify-center text-[11px] text-white/70 bg-black select-none'}>
          Video unavailable
        </div>
      </div>
    );
  }

  return (
    <div
      ref={(el) => { containerRef(el); visibleRef(el); }}
      className="relative"
      onMouseEnter={startHover}
      onMouseLeave={endHover}
    >
      {posterUrl ? (
        <img
          src={posterUrl}
          alt={name ?? 'NFT preview'}
          className={cn + ' object-cover rounded-none absolute inset-0 z-10'}
          data-testid="nft-thumb-poster"
          onClick={onClick}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          referrerPolicy="no-referrer"
          style={{ opacity: showPoster ? 1 : 0, transition: 'opacity 150ms ease', pointerEvents: showPoster ? 'auto' : 'none' }}
          onLoad={fireReady}
          onError={() => { setPosterFailed(true); setShowPoster(false); }}
          onMouseEnter={startHover}
          onMouseLeave={endHover}
        />
      ) : null}
      <video
        ref={vidRef}
        className={cn + ' object-cover rounded-none relative z-0'}
        data-testid="nft-thumb-video"
        preload={shouldLoad ? 'auto' : (hasValidPoster ? 'metadata' : 'none')}
        crossOrigin="anonymous"
        muted
        playsInline
        loop={isHovering}
        controls={false}
        disablePictureInPicture
        aria-label={name ?? 'NFT video preview'}
        poster={posterFailed ? undefined : posterUrl}
        src={shouldLoad ? videoSrc : undefined}
        onClick={onClick}
        onPlay={() => { setShowPoster(false); }}
        onPause={() => { setShowPoster(!!posterUrl && !posterFailed); }}
        onLoadedMetadata={() => {
          const el = vidRef.current;
          if (!el) return;
          const d = Number.isFinite(el.duration) ? el.duration : undefined;
          const t = d ? Math.min(1, Math.max(0.2, d * 0.1)) : 0.5;
          seekRef.current = t;
          try { el.currentTime = t; } catch { /* ignore: some platforms block programmatic seek pre-play */ }
        }}
        onLoadedData={() => {
          const el = vidRef.current;
          if (!el) return;
          try {
            if (el.currentTime < seekRef.current - 0.01) el.currentTime = seekRef.current;
          } catch { /* ignore: best-effort to pre-seek */ }
          if (!isHovering) {
            try { el.pause(); } catch { /* ignore */ }
            try { el.currentTime = seekRef.current; } catch { /* ignore */ }
          } else {
            // If we initiated hover before src was set, ensure playback starts now.
            el.muted = true;
            ensureExclusive(el);
            const p = el.play();
            if (p && typeof p.catch === 'function') p.catch(() => undefined);
          }
          if (!hasValidPoster || posterFailed) {
            try { el.removeAttribute('poster'); } catch { /* ignore */ }
          }
          fireReady();
        }}
        
        onTouchEnd={(e) => {
          const el = vidRef.current;
          const now = Date.now();
          const dblTap = now - (lastTapRef.current || 0) < 300;
          lastTapRef.current = now;
          if (dblTap) {
            if (onClick) onClick();
          } else {
            if (el) {
              if (el.paused) {
                setForceLoad(true);
                setIsHovering(true);
                setShowPoster(false);
                el.muted = true;
                ensureExclusive(el);
                const p = el.play();
                if (p && typeof p.catch === 'function') p.catch(() => undefined);
              } else {
                setIsHovering(false);
                setShowPoster(!!posterUrl);
                try { el.pause(); } catch { /* ignore */ }
                try { el.currentTime = seekRef.current; } catch { /* ignore */ }
              }
            }
          }
          e.preventDefault();
          e.stopPropagation();
        }}
        onError={() => {
          setIdx((i) => {
            const next = i + 1;
            if (next < srcCandidates.length) return next;
            setVideoFailed(true);
            fireReady();
            return i;
          });
        }}
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
}

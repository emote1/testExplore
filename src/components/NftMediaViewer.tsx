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
  const kind = getKindFromMime(mime) ?? getKindFromUrl(src) ?? 'image';

  function toCidPath(url?: string | null): string | null {
    if (!url) return null;
    if (url.startsWith('ipfs://')) return url.replace('ipfs://', '');
    const m = url.match(/\/ipfs\/([^?#]+)/);
    return m ? m[1] : null;
  }

  function buildCandidates(url?: string | null): string[] {
    if (!url) return [];
    const cid = toCidPath(url);
    if (!cid) return [url];
    const gateways = [
      'https://reef.infura-ipfs.io/ipfs/',
      'https://ipfs.io/ipfs/',
      'https://cloudflare-ipfs.com/ipfs/',
      'https://gateway.pinata.cloud/ipfs/',
    ];
    return gateways.map((g) => `${g}${cid}`);
  }

  const srcCandidates = buildCandidates(src);
  const posterCandidates = buildCandidates(poster);
  const posterSrc = posterCandidates[0] ?? undefined;

  if (!src) {
    return (
      <div className={className ?? 'w-full h-64 bg-gray-100 rounded-md flex items-center justify-center text-gray-500'}>
        No media
      </div>
    );
  }

  if (kind === 'video') {
    return (
      <video
        className={className ?? 'max-w-full max-h-[80vh] rounded-md bg-black'}
        controls
        preload="metadata"
        playsInline
        poster={posterSrc}
        aria-label={name ?? 'NFT video'}
      >
        {(srcCandidates.length ? srcCandidates : (src ? [src] : [])).map((u, i) => (
          <source key={i} src={u} type={mime ?? undefined} />
        ))}
        Your browser does not support the video tag.
      </video>
    );
  }

  if (kind === 'audio') {
    return (
      <div className={className ?? 'w-full max-w-2xl'}>
        {posterSrc ? (
          <img src={posterSrc} alt={name ?? 'NFT poster'} className="w-full max-h-[50vh] object-contain rounded-md mb-2" />
        ) : null}
        <audio className="w-full" controls preload="metadata" aria-label={name ?? 'NFT audio'}>
          {(srcCandidates.length ? srcCandidates : (src ? [src] : [])).map((u, i) => (
            <source key={i} src={u} type={mime ?? undefined} />
          ))}
          Your browser does not support the audio element.
        </audio>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name ?? 'NFT image'}
      className={className ?? 'max-w-full max-h-[80vh] object-contain rounded-md'}
      loading="lazy"
    />
  );
}

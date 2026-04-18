import { useEffect, useRef, useState } from 'react';
import { Heart, Eye, ChevronLeft, ChevronRight, Flame, Crown, Tag, ArrowUpRight, Play, Timer } from 'lucide-react';

// Mock data — will be replaced with real data from Hasura
const MOCK_NFTS = [
  { id: 1, name: 'ReefShark #6', collection: 'ReefSharks', image: 'https://ipfs.io/ipfs/QmUuEQNbLaG25eTocWRd4c22ZcHr84eUpD9BWd6MprHqNk', price: '1,250', likes: 342, views: 1205 },
  { id: 2, name: 'UkrainePunk #1', collection: 'UkrainePunks', image: 'https://ipfs.io/ipfs/QmW3PdMXTUMKNuqpdDZuxgR9hb6Xx7dkdk5kp3qpiEt7aC', price: '800', likes: 128, views: 890 },
  { id: 3, name: 'SKELETRON #93', collection: 'Reef Skeletrons', image: 'https://ipfs.io/ipfs/QmWznHXnoEvYuJRS5f7X42L4EQAW36qmp6eVQnM7xxnXfH', price: null, likes: 56, views: 432 },
  { id: 4, name: 'Health Capsule 50', collection: 'OpenBiSea', image: 'https://openbisea.mypinata.cloud/ipfs/QmQWJNzPhyMSpaE6Wwaxry46AuAG1bpWrQoG3PpotLbjzY/health50.gif', price: '5', likes: 891, views: 3201 },
  { id: 5, name: 'Genius of Art 16', collection: 'Genius of Art', image: 'https://ipfs.io/ipfs/QmeBET1BPw2shyfudRih4fConupgmD7AejpH7nHgWfbLPa', price: '2,100', likes: 203, views: 1567 },
];

// Hook: animate element when scrolled into view
function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}


// Featured Hero
function FeaturedNft() {
  const nft = MOCK_NFTS[0];
  const [liked, setLiked] = useState(false);
  const { ref, visible } = useScrollReveal(0.2);

  return (
    <div
      ref={ref}
      className={`relative h-[280px] md:h-[320px] rounded-2xl overflow-hidden group transition-all duration-1000 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <img src={nft.image} alt={nft.name} className="w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-105" referrerPolicy="no-referrer" />
      <div className="absolute inset-0 bg-gradient-to-r from-[hsl(222,20%,8%)]/90 via-[hsl(222,20%,8%)]/50 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-brand/20 via-transparent to-transparent" />
      <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-gradient-to-b from-transparent via-brand to-transparent rounded-full" />

      <div className="absolute inset-0 flex items-center">
        <div className="max-w-md ml-6 md:ml-12">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand/15 border border-brand/30 rounded-full mb-3 backdrop-blur-sm">
            <Crown className="w-3.5 h-3.5 text-brand-light" />
            <span className="text-brand-light text-[10px] font-bold uppercase tracking-[0.15em]">Featured</span>
          </div>

          <h2 className="text-2xl md:text-3xl font-black text-white leading-tight">{nft.name}</h2>
          <p className="text-white/50 text-sm mt-1">{nft.collection}</p>

          {nft.price && (
            <div className="flex items-center gap-4 mt-4 py-2 px-3 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 w-fit">
              <div>
                <p className="text-white/40 text-[9px] uppercase tracking-wider">Price</p>
                <p className="text-white text-lg font-black">{nft.price} <span className="text-xs text-white/40">REEF</span></p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2.5 mt-4">
            <button className="px-5 py-2.5 bg-brand text-white text-xs font-bold rounded-xl hover:bg-brand-light transition-colors flex items-center gap-1.5 shadow-lg shadow-brand/20">
              <Tag className="w-3.5 h-3.5" /> Buy Now
            </button>
            <button className="px-4 py-2.5 bg-white/10 border border-white/20 text-white text-xs font-bold rounded-xl hover:bg-white/20 transition-colors flex items-center gap-1.5 backdrop-blur-sm">
              <Play className="w-3.5 h-3.5" /> View
            </button>
            <button
              onClick={() => setLiked(!liked)}
              className={`p-2.5 rounded-xl border transition-all ${liked ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-white/5 border-white/20 text-white/50 hover:text-white'}`}
            >
              <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
            </button>
          </div>

          <div className="flex items-center gap-4 mt-3 text-white/30 text-[10px]">
            <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {nft.likes + (liked ? 1 : 0)}</span>
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {nft.views.toLocaleString()}</span>
            <span className="flex items-center gap-1"><Timer className="w-3 h-3" /> 2h ago</span>
          </div>
        </div>
      </div>

      <div className="hidden md:flex absolute right-6 top-1/2 -translate-y-1/2 flex-col gap-1.5">
        {MOCK_NFTS.slice(1, 4).map((n) => (
          <div key={n.id} className="w-12 h-12 rounded-lg overflow-hidden border-2 border-white/20 hover:border-brand/60 transition-colors cursor-pointer">
            <img src={n.image} alt={n.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
        ))}
      </div>
    </div>
  );
}

// NFT Card with stagger reveal
function NftCard({ nft, index }: { nft: typeof MOCK_NFTS[0]; index: number }) {
  const [liked, setLiked] = useState(false);
  const { ref, visible } = useScrollReveal(0.1);

  return (
    <div
      ref={ref}
      className={`group cursor-pointer transition-all duration-700 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      }`}
      style={{ transitionDelay: visible ? `${index * 100}ms` : '0ms' }}
    >
      <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-card border border-border shadow-md hover:shadow-xl dark:shadow-black/20 transition-all duration-500 hover:-translate-y-1">
        <img src={nft.image} alt={nft.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" referrerPolicy="no-referrer" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-70 group-hover:opacity-90 transition-opacity duration-500" />

        <div className="absolute top-0 right-0 p-2.5">
          <button
            onClick={(e) => { e.stopPropagation(); setLiked(!liked); }}
            className={`p-1.5 rounded-full backdrop-blur-md transition-all duration-300 ${liked ? 'bg-red-500/30' : 'bg-black/30 hover:bg-black/50'}`}
          >
            <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-red-400 text-red-400' : 'text-white'}`} />
          </button>
        </div>

        <div className="absolute bottom-0 inset-x-0 p-3">
          <h3 className="text-white text-sm font-bold truncate">{nft.name}</h3>
          <div className="flex items-center justify-between mt-2">
            {nft.price ? (
              <span className="text-white text-xs font-bold">{nft.price} <span className="text-white/40">REEF</span></span>
            ) : (
              <span className="text-white/40 text-xs">Not listed</span>
            )}
            <div className="flex items-center gap-2 text-white/40 text-[10px]">
              <span className="flex items-center gap-0.5">
                <Heart className={`w-3 h-3 ${liked ? 'fill-red-400 text-red-400' : ''}`} />
                {nft.likes + (liked ? 1 : 0)}
              </span>
              <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{nft.views}</span>
            </div>
          </div>
          {nft.price && (
            <button className="w-full mt-2 py-1.5 bg-brand text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-brand-light flex items-center justify-center gap-1 shadow-lg shadow-brand/20">
              Buy <ArrowUpRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function TrendingNfts() {
  return (
    <section className="relative overflow-hidden">
      {/* Static gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-brand-accent/30 to-transparent dark:via-brand/5" />

      {/* Static decorative blobs — no JS, pure CSS */}
      <div className="absolute top-20 -left-32 w-96 h-96 rounded-full blur-[120px] bg-blue-400/15 dark:bg-brand/10" />
      <div className="absolute bottom-20 -right-32 w-96 h-96 rounded-full blur-[120px] bg-violet-400/10 dark:bg-purple-500/5" />

      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Featured */}
        <FeaturedNft />

        {/* Trending grid */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-brand-light flex items-center justify-center shadow-md shadow-brand/20">
                <Flame className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Trending NFTs</h3>
                <p className="text-[10px] text-muted-foreground">Most popular in 24h</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-brand/10 text-brand text-[10px] font-bold rounded-full">Hot</span>
              <button className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
                <ChevronLeft className="w-4 h-4 text-foreground" />
              </button>
              <button className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
                <ChevronRight className="w-4 h-4 text-foreground" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {MOCK_NFTS.map((nft, i) => <NftCard key={nft.id} nft={nft} index={i} />)}
          </div>
        </div>
      </div>
    </section>
  );
}

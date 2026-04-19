import React from 'react';
import { Heart, Eye, ChevronLeft, ChevronRight, Flame, Crown, Zap, Timer, Tag, ArrowUpRight, Play, Shield, TrendingUp, Star, ExternalLink } from 'lucide-react';

const MOCK_NFTS = [
  { id: 1, name: 'ReefShark #6', collection: 'ReefSharks', artist: '0x55fc...b977', image: 'https://ipfs.io/ipfs/QmUuEQNbLaG25eTocWRd4c22ZcHr84eUpD9BWd6MprHqNk', price: '1,250', likes: 342, views: 1205, floor: '800', lastSale: '980', change: '+27%' },
  { id: 2, name: 'UkrainePunk #1', collection: 'UkrainePunks', artist: '0xedaf...3511', image: 'https://ipfs.io/ipfs/QmW3PdMXTUMKNuqpdDZuxgR9hb6Xx7dkdk5kp3qpiEt7aC', price: '800', likes: 128, views: 890, floor: '500', lastSale: '650', change: '+23%' },
  { id: 3, name: 'SKELETRON #93', collection: 'Reef Skeletrons', artist: '0x0601...60e4', image: 'https://ipfs.io/ipfs/QmWznHXnoEvYuJRS5f7X42L4EQAW36qmp6eVQnM7xxnXfH', price: null, likes: 56, views: 432, floor: '200', lastSale: null, change: null },
  { id: 4, name: 'Health Capsule 50', collection: 'OpenBiSea', artist: '0xfa82...96c9', image: 'https://openbisea.mypinata.cloud/ipfs/QmQWJNzPhyMSpaE6Wwaxry46AuAG1bpWrQoG3PpotLbjzY/health50.gif', price: '5', likes: 891, views: 3201, floor: '2', lastSale: '4', change: '+25%' },
  { id: 5, name: 'Simpsons #553', collection: 'Simpsons Relife', artist: '0x55fc...b977', image: 'https://ipfs.io/ipfs/QmfPaqChBWL3Zf55xz4oTtu1WKT16CDmSzikTw3TSo6BiP', price: '320', likes: 45, views: 210, floor: '150', lastSale: '280', change: '+14%' },
  { id: 6, name: 'Genius of Art 16', collection: 'Genius of Art', artist: '0x81b2...220b', image: 'https://ipfs.io/ipfs/QmeBET1BPw2shyfudRih4fConupgmD7AejpH7nHgWfbLPa', price: '2,100', likes: 203, views: 1567, floor: '1,500', lastSale: '1,800', change: '+17%' },
  { id: 7, name: 'ReefShark #42', collection: 'ReefSharks', artist: '0x55fc...b977', image: 'https://ipfs.io/ipfs/QmUuEQNbLaG25eTocWRd4c22ZcHr84eUpD9BWd6MprHqNk', price: '950', likes: 178, views: 920, floor: '800', lastSale: '820', change: '+16%' },
  { id: 8, name: 'Punk #777', collection: 'UkrainePunks', artist: '0xedaf...3511', image: 'https://ipfs.io/ipfs/QmW3PdMXTUMKNuqpdDZuxgR9hb6Xx7dkdk5kp3qpiEt7aC', price: null, likes: 412, views: 2100, floor: '500', lastSale: null, change: null },
];

function FeaturedHero() {
  const featured = MOCK_NFTS[0];
  const [heroLiked, setHeroLiked] = React.useState(false);

  return (
    <div className="relative h-[420px] md:h-[460px] rounded-3xl overflow-hidden group">
      {/* Background with parallax effect */}
      <img src={featured.image} alt={featured.name} className="w-full h-full object-cover transition-transform [transition-duration:2000ms] group-hover:scale-105" referrerPolicy="no-referrer" />

      {/* Multi-layer gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

      {/* Decorative accent line */}
      <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-gradient-to-b from-transparent via-brand to-transparent rounded-full" />

      <div className="absolute inset-0 flex items-center">
        <div className="max-w-xl ml-8 md:ml-16">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/15 border border-amber-500/30 rounded-full mb-5 backdrop-blur-sm">
            <Crown className="w-4 h-4 text-amber-400" />
            <span className="text-amber-400 text-xs font-bold uppercase tracking-[0.2em]">Featured Collection</span>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-[1.1] tracking-tight">
            {featured.name}
          </h1>

          {/* Collection + Artist */}
          <div className="flex items-center gap-3 mt-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand to-brand-light border-2 border-white/20" />
            <div>
              <p className="text-white/90 text-sm font-medium">{featured.collection}</p>
              <p className="text-white/40 text-xs font-mono">{featured.artist}</p>
            </div>
            <Shield className="w-4 h-4 text-blue-400 ml-1" aria-label="Verified" />
          </div>

          {/* Price info */}
          <div className="flex items-center gap-6 mt-6 py-3 px-4 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 w-fit">
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-wider">Current Price</p>
              <p className="text-white text-xl font-black">{featured.price} <span className="text-sm text-white/50">REEF</span></p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-wider">Last Sale</p>
              <p className="text-white text-xl font-black">{featured.lastSale} <span className="text-sm text-emerald-400">{featured.change}</span></p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-6">
            <button className="px-8 py-3.5 bg-white text-black font-bold rounded-xl hover:bg-white/90 transition-all hover:shadow-xl hover:shadow-white/10 flex items-center gap-2 text-sm">
              <Tag className="w-4 h-4" />
              Buy Now
            </button>
            <button className="px-6 py-3.5 bg-white/10 border border-white/20 text-white font-bold rounded-xl hover:bg-white/20 transition-colors flex items-center gap-2 text-sm backdrop-blur-sm">
              <Play className="w-4 h-4" />
              Details
            </button>
            <button
              onClick={() => setHeroLiked(!heroLiked)}
              className={`p-3.5 rounded-xl border transition-all ${heroLiked ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-white/5 border-white/20 text-white/60 hover:text-white hover:bg-white/10'}`}
            >
              <Heart className={`w-5 h-5 ${heroLiked ? 'fill-current' : ''}`} />
            </button>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-5 mt-5 text-white/40 text-xs">
            <span className="flex items-center gap-1.5"><Heart className="w-3.5 h-3.5" /> {featured.likes + (heroLiked ? 1 : 0)} likes</span>
            <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> {featured.views.toLocaleString()} views</span>
            <span className="flex items-center gap-1.5"><Timer className="w-3.5 h-3.5" /> Listed 2h ago</span>
          </div>
        </div>
      </div>

      {/* Right side preview thumbnails */}
      <div className="hidden lg:flex absolute right-8 top-1/2 -translate-y-1/2 flex-col gap-2">
        {MOCK_NFTS.slice(1, 4).map((nft) => (
          <div key={nft.id} className="w-16 h-16 rounded-lg overflow-hidden border-2 border-white/20 hover:border-white/60 transition-colors cursor-pointer shadow-lg">
            <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
        ))}
        <div className="w-16 h-16 rounded-lg bg-white/10 border-2 border-white/20 flex items-center justify-center text-white/50 text-xs font-bold backdrop-blur-sm">
          +{MOCK_NFTS.length - 4}
        </div>
      </div>
    </div>
  );
}

function CardCinematic({ nft }: { nft: typeof MOCK_NFTS[0] }) {
  const [liked, setLiked] = React.useState(false);

  return (
    <div className="group relative cursor-pointer">
      <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-lg dark:shadow-black/40 ring-1 ring-black/5 dark:ring-white/5 transition-all duration-500 hover:shadow-2xl">
        <img src={nft.image} alt={nft.name} className="w-full h-full object-cover transition-transform duration-1000 ease-out group-hover:scale-110" loading="lazy" referrerPolicy="no-referrer" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-70 group-hover:opacity-90 transition-opacity duration-500" />
        <div className="absolute top-0 right-0 p-3">
          <button
            onClick={(e) => { e.stopPropagation(); setLiked(!liked); }}
            className={`p-2 rounded-full backdrop-blur-md transition-all duration-300 ${liked ? 'bg-red-500/30 scale-110' : 'bg-black/30 hover:bg-black/50'}`}
          >
            <Heart className={`w-4 h-4 transition-all duration-300 ${liked ? 'fill-red-400 text-red-400' : 'text-white'}`} />
          </button>
        </div>

        {/* Bottom content */}
        <div className="absolute bottom-0 inset-x-0 p-4">
          {/* Collection avatar + name */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-brand to-brand-light ring-1 ring-white/20" />
            <span className="text-white/60 text-[11px] font-medium">{nft.collection}</span>
            <Shield className="w-3 h-3 text-blue-400" />
          </div>
          <h3 className="text-white text-base font-bold leading-tight truncate">{nft.name}</h3>

          {/* Price bar — slides in */}
          <div className="mt-3 flex items-center justify-between translate-y-1 group-hover:translate-y-0 transition-all duration-500">
            <div>
              {nft.price ? (
                <div className="flex items-baseline gap-1">
                  <span className="text-white font-bold text-lg">{nft.price}</span>
                  <span className="text-white/40 text-xs">REEF</span>
                </div>
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-white/50 text-xs">Floor:</span>
                  <span className="text-white/70 font-semibold">{nft.floor}</span>
                  <span className="text-white/40 text-xs">REEF</span>
                </div>
              )}
              <div className="flex items-center gap-2 mt-0.5">
                <span className="flex items-center gap-1 text-white/40 text-[10px]">
                  <Heart className={`w-3 h-3 ${liked ? 'fill-red-400 text-red-400' : ''}`} />
                  {nft.likes + (liked ? 1 : 0)}
                </span>
                <span className="flex items-center gap-1 text-white/40 text-[10px]">
                  <Eye className="w-3 h-3" />
                  {nft.views.toLocaleString()}
                </span>
                {nft.change && (
                  <span className="text-emerald-400 text-[10px] font-semibold flex items-center gap-0.5">
                    <TrendingUp className="w-3 h-3" />{nft.change}
                  </span>
                )}
              </div>
            </div>
            {nft.price && (
              <button className="px-4 py-2 bg-white text-black text-xs font-bold rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-white/90 shadow-xl flex items-center gap-1.5 hover:scale-105">
                Buy <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CardCyber({ nft }: { nft: typeof MOCK_NFTS[0] }) {
  const [liked, setLiked] = React.useState(false);

  return (
    <div className="group relative">
      <div className="relative bg-card dark:bg-[hsl(222,20%,11%)] rounded-xl overflow-hidden border border-border/30 dark:border-white/5 hover:border-brand/30 transition-colors">
        <div className="relative aspect-square overflow-hidden">
          <img src={nft.image} alt={nft.name} className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105 group-hover:saturate-[1.3]" loading="lazy" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
               style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(6,182,212,0.03) 2px, rgba(6,182,212,0.03) 4px)' }} />
          <div className="absolute top-2 right-2">
            <span className="px-1.5 py-0.5 bg-black/50 backdrop-blur-sm rounded text-[10px] text-white/60 font-mono flex items-center gap-1 border border-white/5">
              <Eye className="w-3 h-3" />{nft.views.toLocaleString()}
            </span>
          </div>

          {/* Quick actions on hover */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent h-28 flex items-end p-3 opacity-0 group-hover:opacity-100 transition-all duration-300">
            <div className="flex gap-2 w-full">
              <button className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-brand text-white text-xs font-bold rounded-lg hover:from-cyan-400 hover:to-brand-light transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/20">
                <Zap className="w-3.5 h-3.5" />
                {nft.price ? 'BUY NOW' : 'MAKE OFFER'}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setLiked(!liked); }}
                className={`px-3 py-2.5 rounded-lg font-bold text-xs transition-all ${
                  liked ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-white/10 text-white/50 border border-white/10 hover:border-white/30 hover:text-white'
                }`}
              >
                <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
              </button>
              <button className="px-3 py-2.5 bg-white/10 border border-white/10 rounded-lg hover:border-white/30 transition-colors">
                <ExternalLink className="w-4 h-4 text-white/50 hover:text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Info strip */}
        <div className="p-3.5 border-t border-border/20 dark:border-white/5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono truncate">{nft.collection}</p>
                <Shield className="w-3 h-3 text-cyan-500 shrink-0" />
              </div>
              <p className="text-sm font-bold text-foreground truncate mt-0.5">{nft.name}</p>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{nft.artist}</p>
            </div>
            <div className="text-right shrink-0">
              {nft.price ? (
                <>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Price</p>
                  <p className="text-sm font-bold text-foreground font-mono">{nft.price}</p>
                  <p className="text-[9px] text-muted-foreground">REEF</p>
                </>
              ) : (
                <>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Floor</p>
                  <p className="text-sm font-bold text-muted-foreground font-mono">{nft.floor}</p>
                  <p className="text-[9px] text-muted-foreground">REEF</p>
                </>
              )}
            </div>
          </div>
          {/* Bottom stats bar */}
          <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-border/20 dark:border-white/5">
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Heart className={`w-3 h-3 ${liked ? 'fill-red-400 text-red-400' : ''}`} />
                {nft.likes + (liked ? 1 : 0)}
              </span>
              {nft.lastSale && (
                <span className="flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  Last: {nft.lastSale}
                </span>
              )}
            </div>
            {nft.change && (
              <span className="text-emerald-500 dark:text-emerald-400 text-[10px] font-bold flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" />{nft.change}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TopCollections() {
  const collections = [
    { name: 'ReefSharks', floor: '800', volume: '45.2K', change: '+12%', img: MOCK_NFTS[0].image },
    { name: 'UkrainePunks', floor: '500', volume: '23.1K', change: '+8%', img: MOCK_NFTS[1].image },
    { name: 'Reef Skeletrons', floor: '200', volume: '12.8K', change: '+5%', img: MOCK_NFTS[2].image },
    { name: 'Genius of Art', floor: '1,500', volume: '67.3K', change: '+19%', img: MOCK_NFTS[5].image },
  ];

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
      {collections.map((col) => (
        <div key={col.name} className="flex items-center gap-3 px-4 py-3 bg-card border border-border/50 rounded-xl shrink-0 hover:border-brand/30 transition-colors cursor-pointer group">
          <div className="w-10 h-10 rounded-lg overflow-hidden ring-1 ring-border/50">
            <img src={col.img} alt={col.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <p className="text-sm font-bold text-foreground">{col.name}</p>
              <Shield className="w-3 h-3 text-blue-400" />
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>Floor: {col.floor}</span>
              <span>Vol: {col.volume}</span>
              <span className="text-emerald-500 font-semibold">{col.change}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionHeader({ title, subtitle, badge, icon: Icon }: { title: string; subtitle: string; badge: string; icon: typeof Flame }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-brand-light flex items-center justify-center shadow-lg shadow-brand/20">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <span className="px-2.5 py-1 bg-brand/10 text-brand text-[10px] font-bold rounded-full">{badge}</span>
      </div>
      <div className="flex items-center gap-2">
        <button className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">View All</button>
        <div className="flex gap-1">
          <button className="p-2 rounded-xl border border-border hover:bg-muted transition-colors">
            <ChevronLeft className="w-4 h-4 text-foreground" />
          </button>
          <button className="p-2 rounded-xl border border-border hover:bg-muted transition-colors">
            <ChevronRight className="w-4 h-4 text-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function NftMarketplacePreview() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Featured Hero */}
      <section className="max-w-7xl mx-auto px-4 pt-6 pb-2">
        <FeaturedHero />
      </section>

      {/* Top Collections Strip */}
      <section className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-4">
          <Star className="w-4 h-4 text-brand" />
          <h3 className="text-sm font-bold text-foreground">Top Collections</h3>
        </div>
        <TopCollections />
      </section>

      {/* Cinematic Section — Hot/Trending */}
      <section className="max-w-7xl mx-auto px-4 py-6">
        <SectionHeader title="Trending NFTs" subtitle="Most popular in the last 24h" badge="Hot" icon={Flame} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {MOCK_NFTS.map(nft => <CardCinematic key={nft.id} nft={nft} />)}
        </div>
      </section>

      {/* Neon Cyber Section — New Drops */}
      <section className="max-w-7xl mx-auto px-4 py-6 pb-16">
        <SectionHeader title="New Drops" subtitle="Recently listed NFTs" badge="Fresh" icon={Zap} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {MOCK_NFTS.map(nft => <CardCyber key={nft.id} nft={nft} />)}
        </div>
      </section>
    </div>
  );
}

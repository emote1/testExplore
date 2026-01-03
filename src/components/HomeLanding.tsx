import React from 'react';
import { Search } from 'lucide-react';
import { NetworkStatistics } from './NetworkStatistics';

interface HomeLandingProps {
  onSearch: (value: string) => void;
}

export function HomeLanding({ onSearch }: HomeLandingProps) {
  const [value, setValue] = React.useState('');
  const statsRef = React.useRef<HTMLDivElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    onSearch(v);
  }

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#E0F2FE] to-white" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          {/* H1: 36px → 60px, mb-24px */}
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] bg-clip-text text-transparent">
            Explore. Analyze. Trade.
          </h1>
          {/* P1: 20px, mb-16px, max-w-672px */}
          <p className="text-xl text-muted-foreground mb-4 max-w-2xl mx-auto">
            A decentralized data engine powered by freedom and intelligence.
          </p>
          {/* P2: 18px, mb-48px, max-w-672px */}
          <p className="text-lg text-muted-foreground/80 mb-12 max-w-2xl mx-auto">
            <span className="bg-gradient-to-r from-[#2563EB] to-[#3B82F6] bg-clip-text text-transparent font-medium">SOVRA</span> — where data becomes sovereignty.
          </p>

          {/* Search Container: max-w-768px, mb-48px */}
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto mb-12">
            <div className="relative group">
              {/* Gradient glow: -inset-1, rounded-2xl, blur */}
              <div className="absolute -inset-1 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] rounded-2xl opacity-0 group-hover:opacity-20 blur transition-opacity duration-500" />
              
              {/* Gap between Input and Button: gap-4 (16px) */}
              <div className="relative flex gap-4">
                {/* Input field */}
                <div className="relative flex-1">
                  {/* Search icon: w-5 h-5 (20px), left-6 (24px) */}
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 transition-colors duration-300 group-hover:text-blue-500" />
                  {/* Input: h-16 (64px), text-lg (18px), pl-14 (56px), pr-6 (24px), rounded-xl (12px), border-2 */}
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Enter wallet address or transaction hash..."
                    className="w-full h-16 text-lg pl-14 pr-6 rounded-xl border-2 border-slate-200/60 focus:border-[#3B82F6] focus:ring-2 focus:ring-[#E0F2FE] bg-white/80 backdrop-blur-sm transition-all duration-300 shadow-sm hover:shadow-md focus:shadow-lg outline-none"
                  />
                </div>
                
                {/* Button: h-16 (64px), px-8 (32px), rounded-xl (12px) */}
                <button 
                  type="submit" 
                  className="h-16 px-8 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#3B82F6] hover:from-[#3B82F6] hover:to-[#60A5FA] shadow-lg hover:shadow-xl hover:shadow-[#2563EB]/30 transition-all duration-300 text-white font-semibold group/btn relative overflow-hidden"
                >
                  {/* Icon + text gap: gap-3 (12px) */}
                  <span className="relative z-10 flex items-center gap-3">
                    <Search className="w-5 h-5 transition-transform duration-300 group-hover/btn:rotate-90" />
                    <span>Search</span>
                  </span>
                  {/* Shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" />
                </button>
              </div>
            </div>
            
            {/* Examples: mt-6 (24px), text-sm (14px), gap-2 (8px) */}
            <div className="flex items-center justify-center gap-2 mt-6">
              {/* Decorative lines: h-px (1px), w-12 (48px) */}
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-slate-300" />
              {/* Text padding: px-3 (12px) */}
              <p className="text-sm text-muted-foreground px-3">
                Example: <span className="font-mono text-slate-600">SEDGqi...5h...</span> or <span className="font-mono text-slate-600">0x1a2b3c4d5e6f...</span>
              </p>
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-slate-300" />
            </div>
          </form>
        </div>
      </section>

      {/* Network Statistics */}
      <div ref={statsRef}>
        <NetworkStatistics />
      </div>
    </div>
  );
}

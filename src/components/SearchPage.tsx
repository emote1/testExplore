import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Search, Wallet, Globe } from 'lucide-react';
import { NetworkStatistics } from './NetworkStatistics';

interface SearchPageProps {
  onNavigateToWallet: (address: string) => void;
}

export function SearchPage({ onNavigateToWallet }: SearchPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'search' | 'wallet'>('search');

  function handleSearch() {
    const v = searchQuery.trim();
    if (v) {
      onNavigateToWallet(v);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="relative z-10 bg-white/80 backdrop-blur-sm border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-[#2563EB] to-[#3B82F6] flex items-center justify-center">
                <Globe className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg text-slate-800">BlockExplorer</span>
            </div>

            {/* Navigation */}
            <nav className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('search')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === 'search'
                    ? 'bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Search className="w-4 h-4" />
                Search
              </button>
              <button
                onClick={() => setActiveTab('wallet')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === 'wallet'
                    ? 'bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Wallet className="w-4 h-4" />
                Wallet
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#E0F2FE] to-white" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl mb-6 font-bold bg-gradient-to-r from-[#2563EB] to-[#3B82F6] bg-clip-text text-transparent">
              Explore. Analyze. Trade.
            </h1>
            <p className="text-xl text-muted-foreground mb-4 max-w-2xl mx-auto">
              A decentralized data engine powered by freedom and intelligence.
            </p>
            <p className="text-lg text-muted-foreground/80 mb-12 max-w-2xl mx-auto">
              <span className="bg-gradient-to-r from-[#2563EB] to-[#3B82F6] bg-clip-text text-transparent font-medium">SOVRA</span> — where data becomes sovereignty.
            </p>
            
            {/* Search */}
            <div className="max-w-3xl mx-auto mb-12">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] rounded-2xl opacity-0 group-hover:opacity-20 blur transition-opacity duration-500" />
                <div className="relative flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 transition-colors duration-300 group-hover:text-blue-500" />
                    <Input
                      placeholder="Enter wallet address or transaction hash..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-16 text-lg pl-14 pr-6 rounded-xl border-2 border-slate-200/60 focus:border-[#3B82F6] focus:ring-2 focus:ring-[#E0F2FE] bg-white/80 backdrop-blur-sm transition-all duration-300 shadow-sm hover:shadow-md focus:shadow-lg"
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                  </div>
                  <Button 
                    onClick={handleSearch}
                    className="h-16 px-8 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#3B82F6] hover:from-[#3B82F6] hover:to-[#60A5FA] shadow-lg hover:shadow-xl hover:shadow-[#2563EB]/30 transition-all duration-300 text-white group/btn relative overflow-hidden"
                  >
                    <span className="relative z-10 flex items-center gap-3">
                      <Search className="w-5 h-5 transition-transform duration-300 group-hover/btn:rotate-90" />
                      <span>Search</span>
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 mt-6">
                <div className="h-px w-12 bg-gradient-to-r from-transparent to-slate-300" />
                <p className="text-sm text-muted-foreground px-3">
                  Example: <span className="font-mono text-slate-600">SEDGqi...5h...</span> or <span className="font-mono text-slate-600">0x1a2b3c4d5e6f...</span>
                </p>
                <div className="h-px w-12 bg-gradient-to-l from-transparent to-slate-300" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Network Statistics */}
      <NetworkStatistics />
    </div>
  );
}

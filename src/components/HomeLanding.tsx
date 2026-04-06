import React from 'react';
import { Search, PlugZap, Wallet } from 'lucide-react';
import { NetworkStatistics } from './NetworkStatistics';
import { Button } from './ui/button';
import { useMediaQuery } from '@/hooks/use-media-query';

interface HomeLandingProps {
  onSearch: (value: string) => void;
  connectedAddress?: string | null;
  isConnecting?: boolean;
  walletAvailable?: boolean;
  walletError?: string | null;
  onConnectWallet?: () => void;
  onOpenMyWallet?: () => void;
}

function shortenAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

export function HomeLanding({
  onSearch,
  connectedAddress,
  isConnecting,
  walletAvailable = true,
  walletError,
  onConnectWallet,
  onOpenMyWallet,
}: HomeLandingProps) {
  const [value, setValue] = React.useState('');
  const statsRef = React.useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

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
        <div className="absolute inset-0 bg-gradient-to-r from-brand-accent to-background dark:from-brand/10 dark:via-background dark:to-background" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          {/* H1: 36px → 60px, mb-24px */}
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-brand to-brand-light bg-clip-text text-transparent">
            Explore. Analyze. Trade.
          </h1>
          {/* P1: 20px, mb-16px, max-w-672px */}
          <p className="text-xl text-muted-foreground mb-4 max-w-2xl mx-auto">
            A decentralized data engine powered by freedom and intelligence.
          </p>
          {/* P2: 18px, mb-48px, max-w-672px */}
          <p className="text-lg text-muted-foreground/80 mb-12 max-w-2xl mx-auto">
            <span className="bg-gradient-to-r from-brand to-brand-light bg-clip-text text-transparent font-medium">SOVRA</span> — where data becomes sovereignty.
          </p>

          <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
            {connectedAddress ? (
              <>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300 shadow-sm dark:shadow-none">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span>Connected: {shortenAddress(connectedAddress)}</span>
                </div>
                <Button
                  type="button"
                  onClick={onOpenMyWallet}
                  className="h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-5 text-white hover:from-emerald-500 hover:to-teal-400"
                >
                  <Wallet className="h-4 w-4" />
                  <span>Open My Wallet</span>
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={onConnectWallet}
                disabled={isConnecting || !walletAvailable}
                className="h-11 rounded-xl border-brand/30 bg-background/80 px-5 text-brand hover:bg-brand-accent"
              >
                <PlugZap className="h-4 w-4" />
                <span>{isConnecting ? 'Connecting...' : walletAvailable ? 'Connect Wallet Mode' : 'Wallet Extension Not Found'}</span>
              </Button>
            )}
          </div>

          {walletError ? (
            <div className="mx-auto mb-6 max-w-2xl rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
              {walletError}
            </div>
          ) : null}

          {!connectedAddress && !walletAvailable ? (
            <div className="mx-auto mb-8 max-w-2xl rounded-2xl border border-blue-100 dark:border-blue-900 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 p-4 text-left shadow-sm dark:shadow-none">
              <p className="text-sm font-medium text-foreground">
                Browser extension is unavailable on this device.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {isMobile
                  ? 'Use Reef Chain Wallet mobile app and connect to dApps via WalletConnect/in-app browser.'
                  : 'If you are on desktop, install/enable Reef Chain Wallet Extension in your browser.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href="https://reef.io/wearereef/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
                >
                  Reef Wallet Info
                </a>
                <a
                  href="https://docs.reef.io/docs/users/reef-chain-wallet/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-lg border border-blue-200 dark:border-blue-800 bg-card px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950"
                >
                  WalletConnect Guide
                </a>
              </div>
            </div>
          ) : null}

          {/* Search Container: max-w-768px, mb-48px */}
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto mb-12">
            <div className="relative group">
              {/* Gradient glow: -inset-1, rounded-2xl, blur */}
              <div className="absolute -inset-1 bg-gradient-to-r from-brand to-brand-light rounded-2xl opacity-0 group-hover:opacity-20 dark:group-hover:opacity-40 blur transition-opacity duration-500" />
              
              {/* Gap between Input and Button: gap-4 (16px) */}
              <div className="relative flex gap-4">
                {/* Input field */}
                <div className="relative flex-1">
                  {/* Search icon: w-5 h-5 (20px), left-6 (24px), rotates on group hover */}
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground transition-all duration-300 group-hover:text-brand group-hover:rotate-12 group-hover:scale-110" />
                  {/* Input: h-16 (64px), text-lg (18px), pl-14 (56px), pr-6 (24px), rounded-xl (12px), border-2 */}
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Enter wallet address or transaction hash..."
                    className="w-full h-16 text-lg pl-14 pr-6 rounded-xl border-2 border-border focus:border-brand-light focus:ring-2 focus:ring-brand-accent dark:focus:ring-brand/30 bg-background/80 backdrop-blur-sm transition-all duration-300 shadow-sm hover:shadow-md focus:shadow-lg dark:hover:shadow-brand/10 dark:focus:shadow-brand/20 text-foreground placeholder:text-muted-foreground outline-none"
                  />
                </div>
                
                {/* Button: h-16 (64px), px-8 (32px), rounded-xl (12px) */}
                <button 
                  type="submit" 
                  className="h-16 px-8 rounded-xl bg-gradient-to-r from-brand to-brand-light hover:from-brand-light hover:to-[hsl(217,91%,75%)] shadow-lg hover:shadow-xl hover:shadow-brand/30 dark:hover:shadow-brand/50 transition-all duration-300 text-white font-semibold group/btn relative overflow-hidden"
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
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-border" />
              {/* Text padding: px-3 (12px) */}
              <p className="text-sm text-muted-foreground px-3">
                Example: <span className="font-mono text-muted-foreground">SEDGqi...5h...</span> or <span className="font-mono text-muted-foreground">0x1a2b3c4d5e6f...</span>
              </p>
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-border" />
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

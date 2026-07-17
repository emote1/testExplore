import React from 'react';
import { ApolloProvider } from '@apollo/client';
import { apolloClient } from './apollo-client';
import { Loader2 } from 'lucide-react';
import { Navigation } from './components/Navigation';
import { ErrorBoundary } from './components/ErrorBoundary';
import { WsStatusToast } from './components/WsStatusToast';
import { useReefExtension } from './hooks/use-reef-extension';
import { useMobileWalletConnect } from './hooks/use-mobile-walletconnect';
import { useTheme } from '@/hooks/use-theme';

const EXPLORER_BACKEND = String(import.meta.env.VITE_REEF_EXPLORER_BACKEND ?? '').toLowerCase();
const WS_HEALTH_ENABLED = EXPLORER_BACKEND !== 'hasura';


const TransactionHistoryWithBlocks = React.lazy(() =>
  import('./components/TransactionHistoryWithBlocks').then(m => ({ default: m.TransactionHistoryWithBlocks }))
);

const HomeLanding = React.lazy(() =>
  import('./components/HomeLanding').then(m => ({ default: m.HomeLanding }))
);

const SovraLanding = React.lazy(() => import('./components/SovraLanding'));

const SovraWaterfall = React.lazy(() => import('./components/SovraWaterfall'));

// Matches the fixed underwater gradient inside SovraWaterfall — used as the
// shell backdrop and the Suspense fallback so the pool view never flashes
// a light background while its chunk/data is getting ready.
const POOL_BG = 'linear-gradient(180deg, #0A3A4A 0%, #062B38 22%, #04212C 50%, #02151D 80%, #010A10 100%)';

type AppPage = 'search' | 'wallet';

function App() {
  const [searchAddr, setSearchAddr] = React.useState<string>('');
  const [currentPage, setCurrentPage] = React.useState<AppPage>('search');
  const reefExtension = useReefExtension();
  const mobileWallet = useMobileWalletConnect();
  const { theme } = useTheme();

  React.useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      root.classList.toggle('dark', mql.matches);
      const handler = (e: MediaQueryListEvent) => root.classList.toggle('dark', e.matches);
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
  }, [theme]);

  // Warm up the pool (wallet) chunk while the user is still on the landing,
  // so the first search doesn't hit a cold lazy import (= fallback flash).
  React.useEffect(() => {
    const preload = () => { void import('./components/SovraWaterfall'); };
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(preload, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(preload, 1200);
    return () => window.clearTimeout(t);
  }, []);

  const {
    isAvailable,
    isConnecting,
    address: connectedAddress,
    accounts: walletAccounts,
    error: walletError,
    connect,
    disconnect,
    selectAddress,
  } = reefExtension;

  const activeAddress = connectedAddress ?? mobileWallet.address ?? null;
  const isWalletAvailable = isAvailable || mobileWallet.isReady;
  const isWalletConnecting = isConnecting || mobileWallet.isConnecting;
  const combinedWalletError = walletError ?? mobileWallet.error;

  // Every page switch happens inside startTransition: React keeps the current
  // view on screen while the next (lazy) one renders, instead of flashing the
  // Suspense fallback — this removes the flicker when entering an address.
  function handlePageChange(page: AppPage) {
    React.startTransition(() => {
      setCurrentPage(page);
      if (page === 'search' && !activeAddress) {
        setSearchAddr('');
      }
    });
  }

  function handleSearch(addr: string) {
    React.startTransition(() => {
      setSearchAddr(addr);
      setCurrentPage('wallet');
    });
  }

  async function handleConnectWallet() {
    const address = mobileWallet.isMobile && !isAvailable
      ? await mobileWallet.connect()
      : await connect();
    if (!address) return;
    React.startTransition(() => {
      setSearchAddr(address);
      setCurrentPage('wallet');
    });
  }

  async function handleDisconnectWallet() {
    const wasConnectedAddress = activeAddress;
    disconnect();
    await mobileWallet.disconnect();
    if (searchAddr === wasConnectedAddress) {
      React.startTransition(() => {
        setSearchAddr('');
        setCurrentPage('search');
      });
    }
  }

  function handleOpenMyWallet() {
    if (!activeAddress) return;
    React.startTransition(() => {
      setSearchAddr(activeAddress);
      setCurrentPage('wallet');
    });
  }

  function handleSelectWalletAddress(address: string) {
    if (!address) return;
    selectAddress(address);
    React.startTransition(() => {
      setSearchAddr(address);
      setCurrentPage('wallet');
    });
  }

  // Phase 1 preview of the new single-wallet "pool" view (mock data).
  // ?preview=pool renders the Waterfall standalone; ?addr= overrides the hero address.
  if (window.location.search.includes('preview=pool')) {
    const addrParam = new URLSearchParams(window.location.search).get('addr') || undefined;
    return (
      <ApolloProvider client={apolloClient}>
        <ErrorBoundary name="SovraWaterfallPreview">
          <React.Suspense fallback={null}>
            <SovraWaterfall
              address={addrParam}
              onBack={() => { window.location.search = '?preview=sovra'; }}
              onAddress={(a) => { window.location.search = `?preview=pool&addr=${encodeURIComponent(a)}`; }}
            />
          </React.Suspense>
        </ErrorBoundary>
      </ApolloProvider>
    );
  }

  if (window.location.search.includes('preview=sovra') && currentPage === 'search') {
    return (
      <ApolloProvider client={apolloClient}>
        <ErrorBoundary name="SovraLandingPreview">
          <React.Suspense fallback={null}>
            <SovraLanding
              debug={window.location.search.includes('debug=1')}
              onSearch={handleSearch}
            />
          </React.Suspense>
        </ErrorBoundary>
      </ApolloProvider>
    );
  }

  // The pool (lake) wallet view is a self-contained full-screen experience —
  // hide the app chrome (top nav) and its offset while it's showing.
  // NOTE: the shell below is inlined in App on purpose. It used to be a
  // nested `function AppShell()` component — a component type re-created on
  // every render forces React to unmount/remount the entire subtree, which
  // was the main source of flicker on every state change.
  const showPool = currentPage === 'wallet' && !!searchAddr && !window.location.search.includes('classic');

  return (
    <ApolloProvider client={apolloClient}>
      <ErrorBoundary name="AppRoot">
        <div
          className={showPool ? 'min-h-screen' : 'min-h-screen bg-background'}
          style={showPool ? { background: POOL_BG } : undefined}
        >
          {!showPool && (
            <Navigation
              currentPage={currentPage}
              onPageChange={handlePageChange}
              connectedAddress={activeAddress}
              walletAccounts={walletAccounts}
              isConnecting={isWalletConnecting}
              walletAvailable={isWalletAvailable}
              onConnectWallet={handleConnectWallet}
              onDisconnectWallet={handleDisconnectWallet}
              onOpenMyWallet={handleOpenMyWallet}
              onSelectWalletAddress={handleSelectWalletAddress}
            />
          )}
          <WsStatusToast wsEnabled={WS_HEALTH_ENABLED && currentPage !== 'wallet'} />
          <main className={showPool ? '' : 'pt-16'}>
            <React.Suspense fallback={showPool
              ? <div aria-hidden="true" style={{ position: 'fixed', inset: 0, background: POOL_BG }} />
              : <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
              {window.location.search.includes('preview=nft') ? (
                <React.Suspense fallback={null}>
                  {React.createElement(React.lazy(() => import('./components/NftMarketplacePreview').then(m => ({ default: m.NftMarketplacePreview }))))}
                </React.Suspense>
              ) : currentPage === 'wallet' && searchAddr
                ? (
                  window.location.search.includes('classic')
                    ? (
                      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <ErrorBoundary name="WalletPage">
                          <TransactionHistoryWithBlocks key={searchAddr} initialAddress={searchAddr} />
                        </ErrorBoundary>
                      </div>
                    )
                    : (
                      <ErrorBoundary name="WalletPagePool">
                        <SovraWaterfall key={searchAddr} address={searchAddr} onBack={() => handlePageChange('search')} onAddress={handleSearch} />
                      </ErrorBoundary>
                    )
                )
                : (
                  <ErrorBoundary name="HomePage">
                    <HomeLanding
                      onSearch={handleSearch}
                      connectedAddress={activeAddress}
                      isConnecting={isWalletConnecting}
                      walletAvailable={isWalletAvailable}
                      walletError={combinedWalletError}
                      onConnectWallet={handleConnectWallet}
                      onOpenMyWallet={handleOpenMyWallet}
                    />
                  </ErrorBoundary>
                )}
            </React.Suspense>
          </main>
        </div>
      </ErrorBoundary>
    </ApolloProvider>
  );
}

export default App;

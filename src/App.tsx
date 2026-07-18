import React from 'react';
import { ApolloProvider } from '@apollo/client';
import { apolloClient } from './apollo-client';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useTheme } from '@/hooks/use-theme';

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

  // Every page switch happens inside startTransition: React keeps the current
  // view on screen while the next (lazy) one renders, instead of flashing the
  // Suspense fallback — this removes the flicker when entering an address.
  function handleSearch(addr: string) {
    React.startTransition(() => {
      setSearchAddr(addr);
      setCurrentPage('wallet');
    });
  }

  function handleBack() {
    React.startTransition(() => {
      setSearchAddr('');
      setCurrentPage('search');
    });
  }

  // Standalone SovraWaterfall preview: ?preview=pool renders the pool view
  // directly; ?addr= overrides the hero address (used for local/dev testing).
  if (window.location.search.includes('preview=pool')) {
    const addrParam = new URLSearchParams(window.location.search).get('addr') || undefined;
    return (
      <ApolloProvider client={apolloClient}>
        <ErrorBoundary name="SovraWaterfallPreview">
          <React.Suspense fallback={null}>
            <SovraWaterfall
              address={addrParam}
              onBack={() => { window.location.search = ''; }}
              onAddress={(a) => { window.location.search = `?preview=pool&addr=${encodeURIComponent(a)}`; }}
            />
          </React.Suspense>
        </ErrorBoundary>
      </ApolloProvider>
    );
  }

  const showPool = currentPage === 'wallet' && !!searchAddr;

  return (
    <ApolloProvider client={apolloClient}>
      <ErrorBoundary name="AppRoot">
        <div className="min-h-screen" style={{ background: POOL_BG }}>
          <React.Suspense fallback={<div aria-hidden="true" style={{ position: 'fixed', inset: 0, background: POOL_BG }} />}>
            {showPool ? (
              <ErrorBoundary name="WalletPagePool">
                <SovraWaterfall
                  key={searchAddr}
                  address={searchAddr}
                  onBack={handleBack}
                  onAddress={handleSearch}
                />
              </ErrorBoundary>
            ) : (
              <ErrorBoundary name="SovraLanding">
                <SovraLanding
                  debug={window.location.search.includes('debug=1')}
                  onSearch={handleSearch}
                />
              </ErrorBoundary>
            )}
          </React.Suspense>
        </div>
      </ErrorBoundary>
    </ApolloProvider>
  );
}

export default App;

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

  function handlePageChange(page: AppPage) {
    setCurrentPage(page);
    if (page === 'search' && !activeAddress) {
      setSearchAddr('');
    }
  }

  function handleSearch(addr: string) {
    setSearchAddr(addr);
    setCurrentPage('wallet');
  }

  async function handleConnectWallet() {
    const address = mobileWallet.isMobile && !isAvailable
      ? await mobileWallet.connect()
      : await connect();
    if (!address) return;
    setSearchAddr(address);
    setCurrentPage('wallet');
  }

  async function handleDisconnectWallet() {
    const wasConnectedAddress = activeAddress;
    disconnect();
    await mobileWallet.disconnect();
    if (searchAddr === wasConnectedAddress) {
      setSearchAddr('');
      setCurrentPage('search');
    }
  }

  function handleOpenMyWallet() {
    if (!activeAddress) return;
    setSearchAddr(activeAddress);
    setCurrentPage('wallet');
  }

  function handleSelectWalletAddress(address: string) {
    if (!address) return;
    selectAddress(address);
    setSearchAddr(address);
    setCurrentPage('wallet');
  }

  function AppShell() {
    return (
      <div className="min-h-screen bg-background">
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
        <WsStatusToast wsEnabled={WS_HEALTH_ENABLED && currentPage !== 'wallet'} />
        <main className="pt-16">
          <React.Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
            {currentPage === 'wallet' && searchAddr
              ? (
                <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                  <ErrorBoundary name="WalletPage">
                    <TransactionHistoryWithBlocks key={searchAddr} initialAddress={searchAddr} />
                  </ErrorBoundary>
                </div>
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
    );
  }

  return (
    <ApolloProvider client={apolloClient}>
      <ErrorBoundary name="AppRoot">
        <AppShell />
      </ErrorBoundary>
    </ApolloProvider>
  );
}

export default App;

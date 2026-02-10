import React from 'react';
import { ApolloProvider } from '@apollo/client';
import { apolloClient } from './apollo-client';
import { Loader2 } from 'lucide-react';
import { Navigation } from './components/Navigation';
import { ErrorBoundary } from './components/ErrorBoundary';
import { WsStatusToast } from './components/WsStatusToast';


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

  function handlePageChange(page: AppPage) {
    setCurrentPage(page);
    if (page === 'search') {
      setSearchAddr('');
    }
  }

  function handleSearch(addr: string) {
    setSearchAddr(addr);
    setCurrentPage('wallet');
  }

  function AppShell() {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation currentPage={currentPage} onPageChange={handlePageChange} />
        <WsStatusToast wsEnabled={currentPage !== 'wallet'} />
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
                  <HomeLanding onSearch={handleSearch} />
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

import React from 'react';
import { ApolloProvider } from '@apollo/client';
import { apolloClient } from './apollo-client';
import { Loader2 } from 'lucide-react';

const TransactionHistoryWithBlocks = React.lazy(() =>
  import('./components/TransactionHistoryWithBlocks').then(m => ({ default: m.TransactionHistoryWithBlocks }))
);

const HomeLanding = React.lazy(() =>
  import('./components/HomeLanding').then(m => ({ default: m.HomeLanding }))
);




function App() {
  const [searchAddr, setSearchAddr] = React.useState<string>('');
  return (
    <ApolloProvider client={apolloClient}>
      <div className="min-h-screen bg-gray-50">
        <div className="p-6">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <React.Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                {searchAddr
                  ? <TransactionHistoryWithBlocks key={searchAddr} initialAddress={searchAddr} />
                  : <HomeLanding onSearch={setSearchAddr} />}
              </React.Suspense>
            </main>
          </div>
        </div>
      </div>
    </ApolloProvider>
  );
}

export default App;

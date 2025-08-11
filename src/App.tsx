import { ApolloProvider } from '@apollo/client';
import { apolloClient } from './apollo-client';

import { TransactionHistoryWithBlocks } from './components/TransactionHistoryWithBlocks';





function App() {
  return (
    <ApolloProvider client={apolloClient}>
      <div className="min-h-screen bg-gray-50">
        <div className="p-6">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
              

                <TransactionHistoryWithBlocks />
            </main>
          </div>
        </div>
      </div>
    </ApolloProvider>
  );
}

export default App;

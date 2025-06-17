import { ApolloClient, InMemoryCache, ApolloProvider } from '@apollo/client';
import { TransactionHistoryWithBlocks } from './components/TransactionHistoryWithBlocks';

const client = new ApolloClient({
  uri: 'https://squid.subsquid.io/reef-explorer/graphql',
  cache: new InMemoryCache(),
});

function App() {
  return (
    <ApolloProvider client={client}>
      <div className="min-h-screen bg-gray-50">
        <div className="p-6">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <main className="mt-8">
              <TransactionHistoryWithBlocks />
            </main>
          </div>
        </div>
      </div>
    </ApolloProvider>
  );
}

export default App;

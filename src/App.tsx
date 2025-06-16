import { ApolloClient, InMemoryCache, ApolloProvider } from '@apollo/client';
import TransactionHistory from './components/TransactionHistory';

const client = new ApolloClient({
  uri: 'https://squid.subsquid.io/reef-explorer/graphql',
  cache: new InMemoryCache(),
});

function App() {
  return (
    <ApolloProvider client={client}>
      <div className="min-h-screen bg-gray-50">
        <div className="p-6">
          <TransactionHistory />
        </div>
      </div>
    </ApolloProvider>
  );
}

export default App;

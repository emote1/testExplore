import { ApolloClient, InMemoryCache, ApolloProvider } from '@apollo/client';
import TransactionHistory from './components/TransactionHistory';

const client = new ApolloClient({
  uri: 'https://squid.subsquid.io/reef-explorer/graphql',
  cache: new InMemoryCache(),
});

function App() {
  return (
    <ApolloProvider client={client}>
      <TransactionHistory />
    </ApolloProvider>
  );
}

export default App;

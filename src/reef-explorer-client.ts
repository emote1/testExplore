import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

// Apollo client for Reef Explorer (subsquid) endpoint, used to fetch block timestamps
export const reefExplorerClient = new ApolloClient({
  link: new HttpLink({ uri: 'https://squid.subsquid.io/reef-explorer/graphql' }),
  cache: new InMemoryCache(),
  connectToDevTools: false,
});

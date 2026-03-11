import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

// Apollo client for Reef Explorer (subsquid) endpoint, used to fetch block timestamps
const ENV = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env) ?? {};
const EXPLORER_HTTP_URL = ENV.VITE_REEF_EXPLORER_HTTP_URL ?? 'https://squid.subsquid.io/reef-explorer/graphql';

export const reefExplorerClient = new ApolloClient({
  link: new HttpLink({
    uri: EXPLORER_HTTP_URL,
  }),
  cache: new InMemoryCache(),
  connectToDevTools: false,
});

import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

// Apollo client for Reef Explorer (subsquid) endpoint, used to fetch block timestamps
const ENV = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env) ?? {};
const EXPLORER_HTTP_URL = ENV.VITE_REEF_EXPLORER_HTTP_URL ?? 'https://squid.subsquid.io/reef-explorer/graphql';
const EXPLORER_ADMIN_SECRET = ENV.VITE_REEF_EXPLORER_ADMIN_SECRET ?? '';

function buildAuthHeaders(): Record<string, string> | undefined {
  if (!EXPLORER_ADMIN_SECRET) return undefined;
  return { 'x-hasura-admin-secret': EXPLORER_ADMIN_SECRET };
}

export const reefExplorerClient = new ApolloClient({
  link: new HttpLink({
    uri: EXPLORER_HTTP_URL,
    headers: buildAuthHeaders(),
  }),
  cache: new InMemoryCache(),
  connectToDevTools: false,
});

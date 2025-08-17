import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';
import type { TransfersFeeQueryQuery } from '@/gql/graphql';

const httpLink = new HttpLink({
  uri: 'https://squid.subsquid.io/reef-explorer/graphql',
});

export const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        transfersConnection: {
          keyArgs: ['where', 'orderBy'],
          merge(existing: TransfersFeeQueryQuery['transfersConnection'] | undefined, incoming: TransfersFeeQueryQuery['transfersConnection']) {
            if (!incoming) return existing;
            const existingEdges = existing?.edges || [];
            const incomingEdges = incoming.edges || [];
            return {
              ...incoming,
              edges: [...existingEdges, ...incomingEdges],
            };
          },
        },
      },
    },
  },
});

export const apolloClient = new ApolloClient({
  link: httpLink,
  cache,
});

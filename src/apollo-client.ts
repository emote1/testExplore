import {
  ApolloClient,
  InMemoryCache,
  split,
  HttpLink,
} from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import type { TransfersFeeQueryQuery } from './types/graphql-generated';

const httpLink = new HttpLink({
  uri: 'https://squid.subsquid.io/reef-explorer/graphql',
});

const wsLink = new GraphQLWsLink(
  createClient({
    url: 'wss://squid.subsquid.io/reef-explorer/graphql',
  })
);

const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  httpLink
);

const cache = new InMemoryCache({
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
  link: splitLink,
  cache,
});

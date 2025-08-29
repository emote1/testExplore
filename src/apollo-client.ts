import { ApolloClient, InMemoryCache, HttpLink, ApolloLink } from '@apollo/client';
import type { TransfersFeeQueryQuery } from '@/gql/graphql';

const httpLink = new HttpLink({
  uri: 'https://squid.subsquid.io/reef-explorer/graphql',
});

// Lightweight timing logger for selected operations (DEV or VITE_APOLLO_TIMING=1|true)
const shouldLogTiming = import.meta.env.DEV || import.meta.env.VITE_APOLLO_TIMING === '1' || import.meta.env.VITE_APOLLO_TIMING === 'true';
const measureOps = new Set(['TransfersFeeQuery', 'TransfersPollingQuery']);
const timingLink = new ApolloLink((operation, forward) => {
  const start = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const opName = operation.operationName || 'UnknownOp';
  const obs = forward(operation);
  if (!measureOps.has(opName)) return obs;
  return obs.map((result) => {
    if (!shouldLogTiming) return result;
    const end = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const ttfb = Math.round(end - start);
    let size = 0;
    try {
      size = result && (result as any).data ? JSON.stringify((result as any).data).length : 0;
    } catch {
      size = 0;
    }
    const vars: any = operation.variables || {};
    const pageSize = (vars.first ?? vars.limit) as number | undefined;
    console.info(`[ApolloTiming] ${opName} ttfb=${ttfb}ms size≈${size}B pageSize=${pageSize ?? '-'}`);
    return result;
  });
});
const link = shouldLogTiming ? ApolloLink.from([timingLink, httpLink]) : httpLink;

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
  link,
  cache,
});

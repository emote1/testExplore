import { ApolloClient, InMemoryCache, HttpLink, ApolloLink } from '@apollo/client';
import type { TransfersFeeQueryQuery } from '@/gql/graphql';

const httpLink = new HttpLink({
  uri: 'https://squid.subsquid.io/reef-explorer/graphql',
});

// Lightweight timing hook (now silent). Keeps structure for potential future use.
const shouldLogTiming = (import.meta.env.VITE_APOLLO_TIMING === '1' || import.meta.env.VITE_APOLLO_TIMING === 'true');
const measureOps = new Set(['TransfersFeeQuery', 'TransfersPollingQuery']);
const timingLink = new ApolloLink((operation, forward) => {
  const opName = operation.operationName || 'UnknownOp';
  const obs = forward(operation);
  if (!measureOps.has(opName)) return obs;
  return obs.map((result) => {
    if (!shouldLogTiming) return result;
    // Timing logs disabled
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
          // Merge policy tuned for stable, globally ordered pagination.
          // - First page (after == null): prepend incoming edges into existing list with de-duplication,
          //   preserving already-loaded older pages to keep page boundaries stable during refresh.
          // - Subsequent pages (after != null): append while de-duplicating by node.id.
          merge(
            existing: TransfersFeeQueryQuery['transfersConnection'] | undefined,
            incoming: TransfersFeeQueryQuery['transfersConnection'],
            options
          ) {
            if (!incoming) return existing;
            const after = (options?.args as any)?.after ?? null;
            const incomingEdges = incoming?.edges ?? [];

            // First page: prepend + dedupe to retain older pages and preserve global order
            if (after == null) {
              const existingEdges = existing?.edges ?? [];
              const seen = new Set<string>();
              // Seed with incoming (newest-first) to respect server order at the top
              const mergedEdges = [] as typeof incomingEdges;
              for (const e of incomingEdges) {
                const key = (e as any)?.node?.id as string | undefined;
                const skey = key ? String(key) : undefined;
                if (!skey || !seen.has(skey)) {
                  if (skey) seen.add(skey);
                  mergedEdges.push(e);
                }
              }
              // Append existing edges that are not already present
              for (const e of existingEdges) {
                const key = (e as any)?.node?.id as string | undefined;
                const skey = key ? String(key) : undefined;
                if (!skey || !seen.has(skey)) {
                  if (skey) seen.add(skey);
                  mergedEdges.push(e);
                }
              }

              // Prefer existing pageInfo when we already have a longer list (deep pages loaded)
              const incomingPI = incoming?.pageInfo as any;
              const existingPI = existing?.pageInfo as any;
              const mergedPageInfo = {
                ...(incomingPI ?? {}),
                // Favor existing state to avoid flipping back to true after we've reached the tail
                hasNextPage: (existingPI?.hasNextPage ?? incomingPI?.hasNextPage ?? false) as boolean,
                endCursor: (existingPI?.endCursor ?? incomingPI?.endCursor ?? null) as string | null,
              };

              return {
                ...incoming,
                edges: mergedEdges,
                pageInfo: mergedPageInfo,
                // Keep totalCount stable if incoming omitted it (e.g., test mocks)
                totalCount: (incoming as any)?.totalCount ?? (existing as any)?.totalCount,
              };
            }

            // Next pages: append + dedupe
            const existingEdges = existing?.edges ?? [];
            const seen = new Set<string>();
            for (const e of existingEdges) {
              const key = (e as any)?.node?.id as string | undefined;
              if (key) seen.add(String(key));
            }
            const mergedEdges = [...existingEdges];
            for (const e of incomingEdges) {
              const key = (e as any)?.node?.id as string | undefined;
              const skey = key ? String(key) : undefined;
              if (!skey || !seen.has(skey)) {
                if (skey) seen.add(skey);
                mergedEdges.push(e);
              }
            }
            return {
              ...incoming,
              edges: mergedEdges,
              // Preserve totalCount if it's not present in incoming payload (e.g., mocks)
              totalCount: (incoming as any)?.totalCount ?? (existing as any)?.totalCount,
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
  // Silence Apollo DevTools suggestion banner in dev console
  connectToDevTools: false,
});

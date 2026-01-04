import { ApolloClient, InMemoryCache, HttpLink, ApolloLink, split } from '@apollo/client';
import type { TransfersMinQueryQuery } from '@/gql/graphql';
import { getMainDefinition } from '@apollo/client/utilities';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient as createWSClient } from 'graphql-ws';

const httpLink = new HttpLink({
  uri: 'https://squid.subsquid.io/reef-explorer/graphql',
  useGETForQueries: true,
});

let lastRetryTries = 0;
const wsClient = createWSClient({
  url: 'wss://squid.subsquid.io/reef-explorer/graphql',
  lazy: true,
  keepAlive: 15000,
  retryWait: async (tries) => {
    lastRetryTries = tries;
    const base = Math.min(30000, 1000 * Math.pow(2, Math.min(tries - 1, 5)));
    const jitter = Math.floor(base * 0.2 * Math.random());
    const delay = base + jitter;
    try { window.dispatchEvent(new CustomEvent('ws-retry', { detail: { tries, delayMs: delay } })); } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, delay));
  },
  shouldRetry: () => true,
  on: {
    opened: () => { try { window.dispatchEvent(new CustomEvent('ws-opened')); } catch { /* ignore */ } },
    connected: () => { try { window.dispatchEvent(new CustomEvent('ws-connected')); } catch { /* ignore */ } },
    closed: (ev) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyEv: any = ev as any;
      try { window.dispatchEvent(new CustomEvent('ws-closed', { detail: { code: anyEv?.code, reason: anyEv?.reason, wasClean: anyEv?.wasClean, tries: lastRetryTries } })); } catch { /* ignore */ }
    },
    error: (err) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      try { window.dispatchEvent(new CustomEvent('ws-error', { detail: { message: (err as any)?.message ?? String(err) } })); } catch { /* ignore */ }
    },
  },
});

const wsLink = new GraphQLWsLink(wsClient);

// Lightweight timing hook (now silent). Keeps structure for potential future use.
const shouldLogTiming = (import.meta.env.VITE_APOLLO_TIMING === '1' || import.meta.env.VITE_APOLLO_TIMING === 'true');
const measureOps = new Set(['PaginatedTransfers', 'TransfersPollingQuery']);
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
const httpBaseLink = shouldLogTiming ? ApolloLink.from([timingLink, httpLink]) : httpLink;

const link = split(
  ({ query }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const def = getMainDefinition(query) as any;
    return def.kind === 'OperationDefinition' && def.operation === 'subscription';
  },
  wsLink,
  httpBaseLink
);

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
            existing: TransfersMinQueryQuery['transfersConnection'] | undefined,
            incoming: TransfersMinQueryQuery['transfersConnection'],
            options
          ) {
            if (!incoming) return existing;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const after = (options?.args as any)?.after ?? null;
            const incomingEdges = incoming?.edges ?? [];

            // First page: prepend + dedupe to retain older pages and preserve global order
            if (after == null) {
              const existingEdges = existing?.edges ?? [];
              const seen = new Set<string>();
              // Seed with incoming (newest-first) to respect server order at the top
              const mergedEdges = [] as typeof incomingEdges;
              for (const e of incomingEdges) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const key = (e as any)?.node?.id as string | undefined;
                const skey = key ? String(key) : undefined;
                if (!skey || !seen.has(skey)) {
                  if (skey) seen.add(skey);
                  mergedEdges.push(e);
                }
              }
              // Append existing edges that are not already present
              for (const e of existingEdges) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const key = (e as any)?.node?.id as string | undefined;
                const skey = key ? String(key) : undefined;
                if (!skey || !seen.has(skey)) {
                  if (skey) seen.add(skey);
                  mergedEdges.push(e);
                }
              }

              // Prefer incoming pageInfo when it is present; fall back to existing when incoming omitted it.
              // This prevents count-only queries (which don't request pageInfo) from freezing pagination.
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const incomingPI = incoming?.pageInfo as any;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const existingPI = existing?.pageInfo as any;
              const hasIncomingPI = incomingPI && (typeof incomingPI?.hasNextPage === 'boolean' || incomingPI?.endCursor != null);
              const mergedPageInfo = hasIncomingPI
                ? {
                    ...(existingPI ?? {}),
                    ...(incomingPI ?? {}),
                    hasNextPage: (incomingPI?.hasNextPage ?? existingPI?.hasNextPage ?? false) as boolean,
                    endCursor: (incomingPI?.endCursor ?? existingPI?.endCursor ?? null) as string | null,
                  }
                : (existingPI ?? incomingPI ?? { hasNextPage: false, endCursor: null });

              return {
                ...incoming,
                edges: mergedEdges,
                pageInfo: mergedPageInfo,
                // Keep totalCount stable if incoming omitted it (e.g., test mocks)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                totalCount: (incoming as any)?.totalCount ?? (existing as any)?.totalCount,
              };
            }

            // Next pages: append + dedupe
            const existingEdges = existing?.edges ?? [];
            const seen = new Set<string>();
            for (const e of existingEdges) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const key = (e as any)?.node?.id as string | undefined;
              if (key) seen.add(String(key));
            }
            const mergedEdges = [...existingEdges];
            for (const e of incomingEdges) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const key = (e as any)?.node?.id as string | undefined;
              const skey = key ? String(key) : undefined;
              if (!skey || !seen.has(skey)) {
                if (skey) seen.add(skey);
                mergedEdges.push(e);
              }
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const incomingPI = (incoming as any)?.pageInfo;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const existingPI = (existing as any)?.pageInfo;
            const hasIncomingPI = incomingPI && (typeof incomingPI?.hasNextPage === 'boolean' || incomingPI?.endCursor != null);
            return {
              ...incoming,
              edges: mergedEdges,
              pageInfo: hasIncomingPI ? { ...(existingPI ?? {}), ...(incomingPI ?? {}) } : (existingPI ?? incomingPI),
              // Preserve totalCount if it's not present in incoming payload (e.g., mocks)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

// Dedicated Apollo client for reef-swap Squid endpoint
export const reefSwapClient = new ApolloClient({
  link: new HttpLink({ uri: 'https://squid.subsquid.io/reef-swap/graphql' }),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          poolEventsConnection: {
            keyArgs: ['orderBy', 'where'],
            merge(existing, incoming, { args }) {
              if (!incoming) return existing;
              const after = (args as { after?: string | null })?.after ?? null;
              const incomingEdges = incoming?.edges ?? [];

              if (after == null) {
                const existingEdges = existing?.edges ?? [];
                const seen = new Set<string>();
                const mergedEdges: typeof incomingEdges = [];
                for (const e of incomingEdges) {
                  const id = (e as { node?: { id?: string } })?.node?.id;
                  const key = id ? String(id) : undefined;
                  if (!key || !seen.has(key)) {
                    if (key) seen.add(key);
                    mergedEdges.push(e);
                  }
                }
                for (const e of existingEdges) {
                  const id = (e as { node?: { id?: string } })?.node?.id;
                  const key = id ? String(id) : undefined;
                  if (!key || !seen.has(key)) {
                    if (key) seen.add(key);
                    mergedEdges.push(e);
                  }
                }
                return { ...incoming, edges: mergedEdges, pageInfo: incoming.pageInfo };
              }

              const existingEdges = existing?.edges ?? [];
              const seen = new Set<string>();
              for (const e of existingEdges) {
                const id = (e as { node?: { id?: string } })?.node?.id;
                if (id) seen.add(String(id));
              }
              const mergedEdges = [...existingEdges];
              for (const e of incomingEdges) {
                const id = (e as { node?: { id?: string } })?.node?.id;
                const key = id ? String(id) : undefined;
                if (!key || !seen.has(key)) {
                  if (key) seen.add(key);
                  mergedEdges.push(e);
                }
              }
              return { ...incoming, edges: mergedEdges };
            },
          },
        },
      },
    },
  }),
  connectToDevTools: false,
});

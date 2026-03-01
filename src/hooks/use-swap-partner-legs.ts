import { useState, useEffect } from 'react';
import { ApolloClient, NormalizedCacheObject, TypedDocumentNode, useApolloClient } from '@apollo/client';
import { getString } from '@/utils/object';
import { TRANSFERS_POLLING_QUERY } from '../data/transfers';
import { identifyMissingPartnerHashes } from '@/utils/transfer-helpers';
import { buildTransferOrderBy, isHasuraExplorerMode } from '@/utils/transfer-query';

interface Props {
  data?: { transfersConnection?: { edges?: unknown[] } };
  swapOnly: boolean;
  enabled: boolean;
}

export function useSwapPartnerLegs({ data, swapOnly, enabled }: Props) {
  const client = useApolloClient();
  const [partnersByHash, setPartnersByHash] = useState<Record<string, unknown[]>>({});

  useEffect(() => {
    if (!enabled) {
      setPartnersByHash({});
    }
  }, [enabled]);

  useEffect(() => {
    const wantPartners = !!swapOnly && enabled;
    if (!wantPartners) return;
    
    const edges = data?.transfersConnection?.edges || [];
    const nodes = edges.map((e) => (e as { node?: unknown })?.node).filter(Boolean);
    if (nodes.length === 0) return;

    const alreadyLoadedHashes = new Set(Object.keys(partnersByHash));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const missing = identifyMissingPartnerHashes(nodes as any, alreadyLoadedHashes);
    
    if (missing.length === 0) return;
    const missingLimited = missing.slice(0, 20);

    (async () => {
      try {
        const where = isHasuraExplorerMode
          ? { extrinsic_hash: { _in: missingLimited } }
          : { extrinsicHash_in: missingLimited };
        const { data: q } = await (client as ApolloClient<NormalizedCacheObject>).query(
          {
            query: TRANSFERS_POLLING_QUERY as unknown as TypedDocumentNode,
            variables: {
              where,
              orderBy: buildTransferOrderBy(),
              limit: Math.min(missingLimited.length * 10, 400),
            },
            fetchPolicy: 'network-only',
          }
        );
        const list = (q?.transfers || []) as Array<unknown>;
        if (!list.length) return;
        const grouped: Record<string, unknown[]> = {};
        for (const t of list) {
          const h = getString(t, ['extrinsicHash']);
          if (!h) continue;
          (grouped[h] = grouped[h] || []).push(t);
        }
        setPartnersByHash((prev) => {
          const next = { ...prev };
          for (const [h, arr] of Object.entries(grouped)) {
            if (!next[h]) next[h] = arr;
          }
          return next;
        });
      } catch (e) {
        console.warn('[tx][partners] fetch failed', e);
      }
    })();
  }, [client, data, swapOnly, enabled, partnersByHash]);

  return { partnersByHash, setPartnersByHash };
}

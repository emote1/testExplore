import { useState, useEffect } from 'react';
import { ApolloClient, NormalizedCacheObject, useApolloClient, type TypedDocumentNode } from '@apollo/client';
import { getString } from '@/utils/object';
import { VerifiedContractsByIdsDocument } from '@/gql/graphql';
import { hasTokenMetaCached, primeTokenMetaCacheFromContracts } from '../data/transfer-mapper';

interface Props {
  data: any;
}

export function useTokenMetadataResolver({ data }: Props) {
  const client = useApolloClient();
  const [metaVersion, setMetaVersion] = useState(0);

  useEffect(() => {
    const edges = data?.transfersConnection.edges || [];
    const nodes = edges.map((e: any) => e?.node).filter(Boolean) as Array<any>;
    if (nodes.length === 0) return;

    const ids: string[] = [];
    for (const n of nodes) {
      const id = getString(n, ['token', 'id']);
      if (!id) continue;
      const transferType = getString(n, ['type']) || '';
      if (transferType === 'Native' || transferType === 'ERC721' || transferType === 'ERC1155') continue;
      const tokenName = getString(n, ['token', 'name']) || '';
      if (tokenName === 'REEF') continue;
      if (!hasTokenMetaCached(id)) ids.push(id);
    }
    const unique = Array.from(new Set(ids));
    if (unique.length === 0) return;

    (async () => {
      try {
        const { data: q } = await (client as ApolloClient<NormalizedCacheObject>).query({
          query: VerifiedContractsByIdsDocument as unknown as TypedDocumentNode<any, any>,
          variables: { ids: unique, first: Math.min(unique.length, 100) },
          fetchPolicy: 'cache-first',
        });
        const list = (q?.verifiedContracts || []) as Array<{ id: string; contractData?: any; name?: string }>;
        if (list.length === 0) return;
        const added = primeTokenMetaCacheFromContracts(list);
        if (added > 0) setMetaVersion((v) => v + 1);
      } catch (e) {
        // ignore, soft optimization
      }
    })();
  }, [client, data]);

  return { metaVersion };
}

import { parseTokenMetadata } from '@/utils/token-helpers';
import { graphql } from '@/gql';

export interface UiTokenBalance {
  token: { id: string; name: string; decimals: number; image?: string };
  balance: string; // raw on-chain balance as decimal string
}

export const TOKEN_HOLDERS_PAGED_QUERY = graphql(`
  query TokenHoldersByAccount($accountId: String!, $first: Int!) {
    tokenHolders: tokenHoldersConnection(
      orderBy: balance_DESC
      where: {
        signer: { id_eq: $accountId }
        AND: { token: { type_eq: ERC20 } }
      }
      first: $first
    ) {
      edges {
        node {
          signer { id evmAddress }
          balance
          token { id contractData }
        }
      }
      totalCount
    }
  }
`);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapTokenHoldersToUiBalances(edges: Array<{ node?: any } | null> | null | undefined): UiTokenBalance[] {
  if (!edges) return [];
  const res: UiTokenBalance[] = [];
  for (const e of edges) {
    const n = e?.node;
    if (!n?.token?.id) continue;
    const tokenId = String(n.token.id);
    const meta = parseTokenMetadata(n.token.contractData, 'TOKEN');
    const bal = String(n.balance ?? '0');
    res.push({ token: { id: tokenId, name: meta.name, decimals: meta.decimals, image: meta.image }, balance: bal });
  }
  return res;
}

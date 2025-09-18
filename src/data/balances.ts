import { graphql } from '@/gql';
import { getNumber, getString } from '@/utils/object';
import { normalizeIpfs } from '@/utils/ipfs';

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

function parseTokenMeta(contractDataRaw: unknown, fallbackName: string): { name: string; decimals: number; image?: string } {
  if (!contractDataRaw) return { name: fallbackName, decimals: 18 };
  try {
    const cd: unknown = typeof contractDataRaw === 'string' ? JSON.parse(contractDataRaw) : contractDataRaw;
    const symbol = getString(cd, ['symbol']);
    const decimals = getNumber(cd, ['decimals']);
    const img =
      getString(cd, ['icon'])
      || getString(cd, ['iconUrl'])
      || getString(cd, ['iconURL'])
      || getString(cd, ['icon_url'])
      || getString(cd, ['logo'])
      || getString(cd, ['logoURI'])
      || getString(cd, ['logoUrl'])
      || getString(cd, ['logoURL'])
      || getString(cd, ['logo_url'])
      || getString(cd, ['image'])
      || getString(cd, ['imageUrl'])
      || getString(cd, ['imageURL'])
      || getString(cd, ['image_url'])
      || getString(cd, ['metadata', 'image'])
      || getString(cd, ['metadata', 'imageUrl'])
      || getString(cd, ['metadata', 'imageURL'])
      || getString(cd, ['metadata', 'logoURI'])
      || getString(cd, ['metadata', 'logoUrl'])
      || getString(cd, ['metadata', 'logoURL'])
      || getString(cd, ['metadata', 'icon'])
      || getString(cd, ['metadata', 'iconUrl'])
      || getString(cd, ['metadata', 'iconURL'])
      || undefined;
    const image = img ? normalizeIpfs(img) : undefined;
    return { name: symbol || fallbackName, decimals: decimals ?? 18, image };
  } catch {
    return { name: fallbackName, decimals: 18 };
  }
}

export function mapTokenHoldersToUiBalances(edges: Array<{ node?: any } | null> | null | undefined): UiTokenBalance[] {
  if (!edges) return [];
  const res: UiTokenBalance[] = [];
  for (const e of edges) {
    const n = e?.node;
    if (!n?.token?.id) continue;
    const tokenId = String(n.token.id);
    const meta = parseTokenMeta(n.token.contractData, 'TOKEN');
    const bal = String(n.balance ?? '0');
    res.push({ token: { id: tokenId, name: meta.name, decimals: meta.decimals, image: meta.image }, balance: bal });
  }
  return res;
}

import { parseTokenMetadata } from '@/utils/token-helpers';
import { graphql } from '@/gql';
import { parse } from 'graphql';
import { isHasuraExplorerMode } from '@/utils/transfer-query';

export interface UiTokenBalance {
  token: { id: string; name: string; decimals: number; image?: string };
  balance: string; // raw on-chain balance as decimal string
}

const TOKEN_HOLDERS_PAGED_SUBSQUID_QUERY = graphql(`
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

const TOKEN_HOLDERS_PAGED_HASURA_QUERY = parse(`
  query TokenHoldersByAccountHasura($accountId: String!, $first: Int!) {
    tokenHolders: token_holder(
      where: {
        signer_id: { _eq: $accountId }
        verified_contract: { type: { _eq: "ERC20" } }
      }
      order_by: [{ balance: desc }, { id: asc }]
      limit: $first
    ) {
      signer_id
      balance
      verified_contract { id contractData: contract_data }
    }
    tokenHoldersAggregate: token_holder_aggregate(
      where: {
        signer_id: { _eq: $accountId }
        verified_contract: { type: { _eq: "ERC20" } }
      }
    ) {
      aggregate {
        count
      }
    }
  }
`);

export const TOKEN_HOLDERS_PAGED_QUERY = isHasuraExplorerMode
  ? TOKEN_HOLDERS_PAGED_HASURA_QUERY
  : TOKEN_HOLDERS_PAGED_SUBSQUID_QUERY;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapTokenHoldersToUiBalances(edges: Array<{ node?: any } | null> | null | undefined): UiTokenBalance[] {
  if (!edges) return [];
  const res: UiTokenBalance[] = [];
  for (const e of edges) {
    const n = e?.node;
    // Support both Subsquid (token) and Hasura (verified_contract) field names
    const tokenData = n?.verified_contract || n?.token;
    if (!tokenData?.id) continue;
    const tokenId = String(tokenData.id);
    const tokenIdLower = tokenId.toLowerCase();
    
    // Check by token ID (contract address) for well-known tokens when contractData is null
    let meta;
    if (!tokenData.contractData) {
      if (tokenIdLower === '0x7922d8785d93e692bb584e659b607fa821e6a91a') {
        meta = { name: 'USDC', decimals: 6 };
      } else if (tokenIdLower === '0x95a2af50040b7256a4b4c405a4afd4dd573da115') {
        meta = { name: 'MRD', decimals: 18 };
      } else {
        meta = parseTokenMetadata(tokenData.contractData, 'TOKEN');
      }
    } else {
      meta = parseTokenMetadata(tokenData.contractData, 'TOKEN');
    }
    
    const bal = String(n.balance ?? '0');
    res.push({ token: { id: tokenId, name: meta.name, decimals: meta.decimals, image: meta.image }, balance: bal });
  }
  return res;
}

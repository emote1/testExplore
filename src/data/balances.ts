import { parseTokenMetadata, prettifyTokenName } from '@/utils/token-helpers';
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
  query TokenHoldersByAccountHasura($accountId: String!, $evmAddress: String!, $evmAddressLower: String!, $first: Int!) {
    tokenHolders: token_holder(
      where: {
        _or: [
          { signer_id: { _eq: $accountId } }
          { evm_address: { _eq: $evmAddress } }
          { evm_address: { _eq: $evmAddressLower } }
        ]
        nft_id: { _is_null: true }
        type: { _in: ["ERC20", "Account"] }
      }
      order_by: [{ balance: desc }, { id: asc }]
      limit: $first
    ) {
      signer_id
      evm_address
      balance
      token_id
      type
      verified_contract {
        contract_data
      }
    }
    tokenHoldersAggregate: token_holder_aggregate(
      where: {
        _or: [
          { signer_id: { _eq: $accountId } }
          { evm_address: { _eq: $evmAddress } }
          { evm_address: { _eq: $evmAddressLower } }
        ]
        nft_id: { _is_null: true }
        type: { _in: ["ERC20", "Account"] }
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

const ACCOUNT_NATIVE_BALANCE_SUBSQUID_QUERY = graphql(`
  query AccountNativeBalance($accountId: String!) {
    accounts(where: { OR: [{ id_eq: $accountId }, { evmAddress_eq: $accountId }] }, limit: 1) {
      id
      freeBalance
      availableBalance
    }
  }
`);

export const ACCOUNT_NATIVE_BALANCE_QUERY = ACCOUNT_NATIVE_BALANCE_SUBSQUID_QUERY;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapTokenHoldersToUiBalances(edges: Array<{ node?: any } | null> | null | undefined): UiTokenBalance[] {
  if (!edges) return [];
  const res: UiTokenBalance[] = [];
  for (const e of edges) {
    const n = e?.node;
    // Support both Subsquid (token.contractData) and Hasura (token_id + verified_contract.contract_data) field shapes
    const hasuraContractData = n?.verified_contract?.contract_data ?? null;
    const tokenData = n?.token || (n?.token_id ? { id: n.token_id, contractData: hasuraContractData } : null);
    if (!tokenData?.id) continue;
    // Filter out NFT tokens (ERC721/ERC1155) — they belong in NFTs tab, not Holdings
    const tokenType = String(n?.type ?? tokenData?.type ?? '').toUpperCase();
    if (tokenType === 'ERC721' || tokenType === 'ERC1155') continue;
    if (n?.nft_id != null) continue;
    const tokenId = String(tokenData.id);
    const tokenIdLower = tokenId.toLowerCase();
    
    // Check by token ID (contract address) for well-known tokens when contractData is null
    let meta;
    if (!tokenData.contractData) {
      if (tokenIdLower === '0x0000000000000000000000000000000001000000') {
        meta = { name: 'REEF', decimals: 18 };
      } else if (tokenIdLower === '0x7922d8785d93e692bb584e659b607fa821e6a91a') {
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
    const displayName = prettifyTokenName(meta.name, tokenId);
    res.push({ token: { id: tokenId, name: displayName, decimals: meta.decimals, image: meta.image }, balance: bal });
  }
  return res;
}

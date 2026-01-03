import { graphql } from '@/gql';
import { gql } from '@apollo/client';

export const NFTS_BY_OWNER_QUERY = graphql(`
  query NftsByOwner($owner: String!) {
    tokenHolders(
      where: { 
        signer: { evmAddress_eq: $owner },
        balance_gt: "0",
        token: { type_in: [ERC721, ERC1155] }
      }
      limit: 300
    ) {
      id
      balance
      type
      nftId
      token {
        id
        type
      }
    }
  }
`);

// Paginated variant used by hooks to avoid large responses
export const NFTS_BY_OWNER_PAGED_QUERY = graphql(`
  query NftsByOwnerPaged($owner: String!, $limit: Int!, $offset: Int!) {
    tokenHolders(
      where: { signer: { evmAddress_eq: $owner }, balance_gt: "0", token: { type_in: [ERC721, ERC1155] } }
      limit: $limit
      offset: $offset
    ) {
      id
      balance
      nftId
      token { id type }
    }
  }
`);

export const NFTS_BY_OWNER_COUNT_QUERY = gql`
  query NftsByOwnerCount($owner: String!) {
    tokenHolders: tokenHoldersConnection(
      where: { signer: { evmAddress_eq: $owner }, balance_gt: "0", token: { type_in: [ERC721, ERC1155] } }
      orderBy: [id_DESC]
      first: 1
    ) {
      totalCount
    }
  }
`;

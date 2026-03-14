import { parse } from 'graphql';

const NFTS_BY_OWNER_HASURA_QUERY = parse(`
  query NftsByOwnerHasura($owner: String!) {
    tokenHolders: token_holder(
      where: {
        evm_address: { _eq: $owner }
        balance: { _gt: "0" }
        _or: [
          { type: { _in: ["ERC721", "ERC1155"] } }
          { nft_id: { _is_null: false } }
        ]
      }
      limit: 300
    ) {
      id
      balance
      type
      nftId: nft_id
      tokenId: token_id
    }
  }
`);

export const NFTS_BY_OWNER_QUERY = NFTS_BY_OWNER_HASURA_QUERY;

// Paginated variant used by hooks to avoid large responses
const NFTS_BY_OWNER_PAGED_HASURA_QUERY = parse(`
  query NftsByOwnerPagedHasura($owner: String!, $limit: Int!, $offset: Int!) {
    tokenHolders: token_holder(
      where: {
        evm_address: { _eq: $owner }
        balance: { _gt: "0" }
        _or: [
          { type: { _in: ["ERC721", "ERC1155"] } }
          { nft_id: { _is_null: false } }
        ]
      }
      limit: $limit
      offset: $offset
    ) {
      id
      balance
      type
      nftId: nft_id
      tokenId: token_id
    }
  }
`);

export const NFTS_BY_OWNER_PAGED_QUERY = NFTS_BY_OWNER_PAGED_HASURA_QUERY;

const NFTS_BY_OWNER_COUNT_HASURA_QUERY = parse(`
  query NftsByOwnerCountHasura($owner: String!) {
    tokenHolders: token_holder_aggregate(
      where: {
        evm_address: { _eq: $owner }
        balance: { _gt: "0" }
        _or: [
          { type: { _in: ["ERC721", "ERC1155"] } }
          { nft_id: { _is_null: false } }
        ]
      }
    ) {
      aggregate {
        count
      }
    }
  }
`);

export const NFTS_BY_OWNER_COUNT_QUERY = NFTS_BY_OWNER_COUNT_HASURA_QUERY;

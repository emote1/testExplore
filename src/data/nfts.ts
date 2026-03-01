import { graphql } from '@/gql';
import { gql } from '@apollo/client';
import { parse } from 'graphql';
import { isHasuraExplorerMode } from '@/utils/transfer-query';

const NFTS_BY_OWNER_SUBSQUID_QUERY = graphql(`
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

const NFTS_BY_OWNER_HASURA_QUERY = parse(`
  query NftsByOwnerHasura($owner: String!) {
    tokenHolders: token_holder(
      where: {
        evm_address: { _eq: $owner }
        balance: { _gt: "0" }
        verified_contract: { type: { _in: ["ERC721", "ERC1155"] } }
      }
      limit: 300
    ) {
      id
      balance
      type
      nftId: nft_id
      token: verified_contract {
        id
        name
        type
      }
    }
  }
`);

export const NFTS_BY_OWNER_QUERY = isHasuraExplorerMode
  ? NFTS_BY_OWNER_HASURA_QUERY
  : NFTS_BY_OWNER_SUBSQUID_QUERY;

// Paginated variant used by hooks to avoid large responses
const NFTS_BY_OWNER_PAGED_SUBSQUID_QUERY = graphql(`
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

const NFTS_BY_OWNER_PAGED_HASURA_QUERY = parse(`
  query NftsByOwnerPagedHasura($owner: String!, $limit: Int!, $offset: Int!) {
    tokenHolders: token_holder(
      where: {
        evm_address: { _eq: $owner }
        balance: { _gt: "0" }
        verified_contract: { type: { _in: ["ERC721", "ERC1155"] } }
      }
      limit: $limit
      offset: $offset
    ) {
      id
      balance
      nftId: nft_id
      token: verified_contract { id name type }
    }
  }
`);

export const NFTS_BY_OWNER_PAGED_QUERY = isHasuraExplorerMode
  ? NFTS_BY_OWNER_PAGED_HASURA_QUERY
  : NFTS_BY_OWNER_PAGED_SUBSQUID_QUERY;

const NFTS_BY_OWNER_COUNT_SUBSQUID_QUERY = gql`
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

const NFTS_BY_OWNER_COUNT_HASURA_QUERY = parse(`
  query NftsByOwnerCountHasura($owner: String!) {
    tokenHolders: token_holder_aggregate(
      where: {
        evm_address: { _eq: $owner }
        balance: { _gt: "0" }
        verified_contract: { type: { _in: ["ERC721", "ERC1155"] } }
      }
    ) {
      aggregate {
        count
      }
    }
  }
`);

export const NFTS_BY_OWNER_COUNT_QUERY = isHasuraExplorerMode
  ? NFTS_BY_OWNER_COUNT_HASURA_QUERY
  : NFTS_BY_OWNER_COUNT_SUBSQUID_QUERY;

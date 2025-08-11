import { gql } from '@apollo/client';

export const NFT_IDS_BY_ACCOUNT_QUERY = gql`
  query NftIdsByAccountQuery($address: String!, $limit: Int!) {
    transfers(
      where: { 
        OR: [{ from: { id_eq: $address } }, { to: { id_eq: $address } }],
        type_eq: ERC1155 
      },
            limit: $limit,
      orderBy: timestamp_DESC
    ) {
      id
      nftId
      token {
        id # This is the contract address
      }
    }
  }
`;


import { gql } from '@apollo/client';

export const PAGINATED_TRANSFERS_QUERY = gql`
  query TransfersQuery($first: Int!, $after: String, $where: TransferWhereInput, $orderBy: [TransferOrderByInput!]!) {
    transfersConnection(orderBy: $orderBy, first: $first, after: $after, where: $where) {
      edges {
        node {
          id
          amount
          timestamp
          success
          type
          extrinsicHash
          extrinsicId
          from {
            id
          }
          to {
            id
          }
          token {
            id
            name
            contractData
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;

export const EXTRINSICS_BY_IDS_QUERY = gql`
  query ExtrinsicsByIds($ids: [String!]) {
    extrinsics(where: { id_in: $ids }) {
      id
      hash
      signedData
    }
  }
`;


// Polling query for new transfers (used by subscription hook)
export const TRANSFERS_POLLING_QUERY = gql`
  query TransfersPollingQuery($where: TransferWhereInput, $orderBy: [TransferOrderByInput!], $offset: Int, $limit: Int) {
    transfers(where: $where, orderBy: $orderBy, offset: $offset, limit: $limit) {
      id
      amount
      timestamp
      success
      type
      extrinsicHash
      extrinsicId
      from {
        id
      }
      to {
        id
      }
      token {
        id
        name
        contractData
      }
    }
  }
`;

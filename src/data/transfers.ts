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
          from {
            id
          }
          to {
            id
          }
          token {
            id
            name
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

export const FEE_EVENTS_QUERY = gql`
  query FeeEventsQuery($where: EventWhereInput, $orderBy: [EventOrderByInput!]!) {
    eventsConnection(orderBy: $orderBy, where: $where) {
      edges {
        node {
          id
          data
          extrinsic {
            id
            hash
          }
        }
      }
    }
  }
`;

// Simple transfers subscription for real-time updates (Subscription API doesn't support *Connection)
export const TRANSFERS_SUBSCRIPTION_QUERY = gql`
  subscription TransfersSubscription($where: TransferWhereInput, $orderBy: [TransferOrderByInput!], $offset: Int, $limit: Int) {
    transfers(where: $where, orderBy: $orderBy, offset: $offset, limit: $limit) {
      id
      amount
      timestamp
      success
      type
      extrinsicHash
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

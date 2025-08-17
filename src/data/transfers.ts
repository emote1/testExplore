import { graphql } from '@/gql';

export const EXTRINSIC_FEE_QUERY = graphql(`
  query ExtrinsicFeeQuery($extrinsicHash: String!) {
    extrinsics(where: { hash_eq: $extrinsicHash }, limit: 1) {
      events(where: {section_eq: "transactionpayment", method_eq: "TransactionFeePaid"}) {
        data
      }
    }
  }
`);

export const PAGINATED_TRANSFERS_QUERY = graphql(`
  query TransfersFeeQuery($first: Int!, $after: String, $where: TransferWhereInput, $orderBy: [TransferOrderByInput!]!) {
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
`);

export const NFT_TOKEN_ID_QUERY = graphql(`
  query NftTokenIdQuery($ids: [String!]) {
    extrinsics(where: { id_in: $ids }) {
      id
      hash
      events(where: { section_eq: "uniques", method_eq: "Transferred" }) {
        id
        section
        method
        data
      }
    }
  }
`);


// Polling query for new transfers (used by subscription hook)
export const TRANSFERS_POLLING_QUERY = graphql(`
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
`);

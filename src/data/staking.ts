import { graphql } from '@/gql';

// Lightweight queries for staking rewards
export const STAKINGS_CONNECTION_QUERY = graphql(`
  query StakingConnectionQuery($accountId: String!, $from: DateTime, $to: DateTime) {
    stakingsConnection(
      where: { signer: { id_eq: $accountId }, type_eq: Reward, timestamp_gte: $from, timestamp_lte: $to }
      orderBy: [id_DESC]
    ) {
      totalCount
    }
  }
`);

export const STAKINGS_LIST_QUERY = graphql(`
  query StakingListQuery($accountId: String!, $first: Int!, $after: Int!) {
    stakings(
      orderBy: [id_DESC]
      where: { signer: { id_eq: $accountId }, type_eq: Reward }
      limit: $first
      offset: $after
    ) {
      id
      amount
      timestamp
      signer { id }
      event {
        extrinsic { hash }
      }
    }
  }
`);

// Minimal list for charts: only fields we render (smaller response)
export const STAKINGS_LIST_MIN_QUERY = graphql(`
  query StakingListMinQuery($accountId: String!, $first: Int!, $after: Int!, $from: DateTime, $to: DateTime) {
    stakings(
      orderBy: [id_DESC]
      where: { signer: { id_eq: $accountId }, type_eq: Reward, timestamp_gte: $from, timestamp_lte: $to }
      limit: $first
      offset: $after
    ) {
      id
      amount
      timestamp
    }
  }
`);

// Latest reward timestamp for a given account (to compute range cutoffs)
export const STAKINGS_LAST_TS_QUERY = graphql(`
  query StakingLastTsQuery($accountId: String!) {
    stakings(
      orderBy: [timestamp_DESC]
      where: { signer: { id_eq: $accountId }, type_eq: Reward }
      limit: 1
    ) {
      timestamp
    }
  }
`);

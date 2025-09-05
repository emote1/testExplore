import { graphql } from '@/gql';

// Lightweight queries for staking rewards
export const STAKINGS_CONNECTION_QUERY = graphql(`
  query StakingConnectionQuery($accountId: String!) {
    stakingsConnection(
      where: { signer: { id_eq: $accountId }, type_eq: Reward }
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

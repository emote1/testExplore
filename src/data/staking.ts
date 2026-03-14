import { parse } from 'graphql';

interface BuildStakingWhereParams {
  accountId: string;
  from?: string | null;
  to?: string | null;
}

export function buildStakingWhere({ accountId, from, to }: BuildStakingWhereParams): Record<string, unknown> {
  const andClauses: Record<string, unknown>[] = [
    { signer_id: { _eq: accountId } },
    { type: { _eq: 'Reward' } },
  ];
  if (from) andClauses.push({ timestamp: { _gte: from } });
  if (to) andClauses.push({ timestamp: { _lte: to } });
  return { _and: andClauses };
}

// Lightweight queries for staking rewards (Hasura)
export const STAKINGS_CONNECTION_QUERY = parse(`
  query StakingConnectionHasuraQuery($where: staking_bool_exp!) {
    stakingsConnection: staking_aggregate(where: $where) {
      aggregate {
        count
      }
    }
  }
`);

export const STAKINGS_LIST_QUERY = parse(`
  query StakingListHasuraQuery($where: staking_bool_exp!, $first: Int!, $after: Int!) {
    stakings: staking(
      order_by: [{ id: desc }]
      where: $where
      limit: $first
      offset: $after
    ) {
      id
      amount
      timestamp
      signer: account {
        id
      }
    }
  }
`);

// Minimal list for charts: only fields we render (smaller response)
export const STAKINGS_LIST_MIN_QUERY = parse(`
  query StakingListMinHasuraQuery($where: staking_bool_exp!, $first: Int!, $after: Int!) {
    stakings: staking(
      order_by: [{ id: desc }]
      where: $where
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
export const STAKINGS_LAST_TS_QUERY = parse(`
  query StakingLastTsHasuraQuery($where: staking_bool_exp!) {
    stakings: staking(
      order_by: [{ timestamp: desc }]
      where: $where
      limit: 1
    ) {
      timestamp
    }
  }
`);

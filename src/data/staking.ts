import { graphql } from '@/gql';
import { parse } from 'graphql';
import { isHasuraExplorerMode } from '@/utils/transfer-query';

interface BuildStakingWhereParams {
  accountId: string;
  from?: string | null;
  to?: string | null;
}

export function buildStakingWhere({ accountId, from, to }: BuildStakingWhereParams): Record<string, unknown> {
  if (isHasuraExplorerMode) {
    const andClauses: Record<string, unknown>[] = [
      { signer_id: { _eq: accountId } },
      { type: { _eq: 'Reward' } },
    ];
    if (from) andClauses.push({ timestamp: { _gte: from } });
    if (to) andClauses.push({ timestamp: { _lte: to } });
    return { _and: andClauses };
  }

  const where: Record<string, unknown> = {
    signer: { id_eq: accountId },
    type_eq: 'Reward',
  };
  if (from) where.timestamp_gte = from;
  if (to) where.timestamp_lte = to;
  return where;
}

// Lightweight queries for staking rewards
const STAKINGS_CONNECTION_SUBSQUID_QUERY = graphql(`
  query StakingConnectionQuery($accountId: String!, $from: DateTime, $to: DateTime) {
    stakingsConnection(
      where: { signer: { id_eq: $accountId }, type_eq: Reward, timestamp_gte: $from, timestamp_lte: $to }
      orderBy: [id_DESC]
    ) {
      totalCount
    }
  }
`);

const STAKINGS_CONNECTION_HASURA_QUERY = parse(`
  query StakingConnectionHasuraQuery($where: staking_bool_exp!) {
    stakingsConnection: staking_aggregate(where: $where) {
      aggregate {
        count
      }
    }
  }
`);

export const STAKINGS_CONNECTION_QUERY = isHasuraExplorerMode
  ? STAKINGS_CONNECTION_HASURA_QUERY
  : STAKINGS_CONNECTION_SUBSQUID_QUERY;

const STAKINGS_LIST_SUBSQUID_QUERY = graphql(`
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

const STAKINGS_LIST_HASURA_QUERY = parse(`
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

export const STAKINGS_LIST_QUERY = isHasuraExplorerMode
  ? STAKINGS_LIST_HASURA_QUERY
  : STAKINGS_LIST_SUBSQUID_QUERY;

// Minimal list for charts: only fields we render (smaller response)
const STAKINGS_LIST_MIN_SUBSQUID_QUERY = graphql(`
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

const STAKINGS_LIST_MIN_HASURA_QUERY = parse(`
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

export const STAKINGS_LIST_MIN_QUERY = isHasuraExplorerMode
  ? STAKINGS_LIST_MIN_HASURA_QUERY
  : STAKINGS_LIST_MIN_SUBSQUID_QUERY;

// Latest reward timestamp for a given account (to compute range cutoffs)
const STAKINGS_LAST_TS_SUBSQUID_QUERY = graphql(`
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

const STAKINGS_LAST_TS_HASURA_QUERY = parse(`
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

export const STAKINGS_LAST_TS_QUERY = isHasuraExplorerMode
  ? STAKINGS_LAST_TS_HASURA_QUERY
  : STAKINGS_LAST_TS_SUBSQUID_QUERY;

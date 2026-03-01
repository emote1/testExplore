import { graphql } from '@/gql';
import { parse } from 'graphql';
import { isHasuraExplorerMode } from '@/utils/transfer-query';

export const SQUID_STATUS_QUERY = graphql(`
  query SquidStatusQuery { 
    squidStatus { 
      height 
    } 
  }
`);

export const LATEST_BLOCK_QUERY = graphql(`
  query LatestBlockQuery {
    blocks(orderBy: height_DESC, limit: 1) {
      height
      timestamp
      processorTimestamp
    }
  }
`);

const HEALTH_COMBINED_SUBSQUID_QUERY = graphql(`
  query HealthCombinedQuery {
    squidStatus { height }
    blocks(orderBy: height_DESC, limit: 1) {
      height
      timestamp
      processorTimestamp
    }
  }
`);

const HEALTH_COMBINED_HASURA_QUERY = parse(`
  query HealthCombinedHasuraQuery {
    latestBlock: block(order_by: { height: desc }, limit: 1) {
      height
      timestamp
    }
    freshestBlock: block(order_by: { processor_timestamp: desc_nulls_last }, limit: 1) {
      height
      timestamp
      processorTimestamp: processor_timestamp
    }
  }
`);

export const HEALTH_COMBINED_QUERY = isHasuraExplorerMode
  ? HEALTH_COMBINED_HASURA_QUERY
  : HEALTH_COMBINED_SUBSQUID_QUERY;

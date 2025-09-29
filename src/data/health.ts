import { graphql } from '@/gql';

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

export const HEALTH_COMBINED_QUERY = graphql(`
  query HealthCombinedQuery {
    squidStatus { height }
    blocks(orderBy: height_DESC, limit: 1) {
      height
      timestamp
      processorTimestamp
    }
  }
`);

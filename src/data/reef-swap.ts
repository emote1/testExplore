import { gql } from '@apollo/client';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';

// Minimal reef-swap documents: only the connection query is kept.
export const POOL_EVENTS_CONNECTION_DOCUMENT = gql`
  query PoolEventsConnection($first: Int!, $after: String, $addr: String!) {
    poolEventsConnection(
      first: $first
      after: $after
      where: {
        AND: [
          { type_eq: Swap }
          { OR: [
              { senderAddress_containsInsensitive: $addr }
              { toAddress_containsInsensitive: $addr }
            ]
          }
        ]
      }
      orderBy: [blockHeight_DESC, indexInBlock_DESC, id_DESC]
    ) {
      edges {
        node {
          id
          blockHeight
          indexInBlock
          timestamp
          type
          pool {
            id
            token1 { id name decimals }
            token2 { id name decimals }
          }
          senderAddress
          toAddress
          amount1
          amount2
          amountIn1
          amountIn2
        }
        cursor
      }
      pageInfo { hasNextPage endCursor }
    }
  }
` as unknown as TypedDocumentNode<any, any>;

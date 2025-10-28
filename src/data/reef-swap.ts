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

// Nearest swap within window BEFORE ts (tsFrom..tsTo] ordered descending
export const NEAREST_SWAP_FOR_TOKEN_WINDOW_BEFORE_DOCUMENT = gql`
  query NearestSwapForTokenWindowBefore($reef: String!, $token: String!, $from: DateTime!, $to: DateTime!) {
    poolEventsConnection(
      first: 1
      orderBy: [timestamp_DESC, id_DESC]
      where: {
        AND: [
          { type_eq: Swap }
          { OR: [
              { pool: { token1: { id_eq: $reef }, token2: { id_eq: $token } } }
              { pool: { token1: { id_eq: $token }, token2: { id_eq: $reef } } }
            ]
          }
          { timestamp_gte: $from }
          { timestamp_lte: $to }
        ]
      }
    ) {
      edges {
        node {
          id
          blockHeight
          indexInBlock
          timestamp
          amount1
          amount2
          amountIn1
          amountIn2
          pool { token1 { id name decimals } token2 { id name decimals } }
        }
      }
    }
  }
` as unknown as TypedDocumentNode<any, any>;

// Nearest swap within window AFTER ts [tsFrom..tsTo) ordered ascending
export const NEAREST_SWAP_FOR_TOKEN_WINDOW_AFTER_DOCUMENT = gql`
  query NearestSwapForTokenWindowAfter($reef: String!, $token: String!, $from: DateTime!, $to: DateTime!) {
    poolEventsConnection(
      first: 1
      orderBy: [timestamp_ASC, id_ASC]
      where: {
        AND: [
          { type_eq: Swap }
          { OR: [
              { pool: { token1: { id_eq: $reef }, token2: { id_eq: $token } } }
              { pool: { token1: { id_eq: $token }, token2: { id_eq: $reef } } }
            ]
          }
          { timestamp_gte: $from }
          { timestamp_lte: $to }
        ]
      }
    ) {
      edges {
        node {
          id
          blockHeight
          indexInBlock
          timestamp
          amount1
          amount2
          amountIn1
          amountIn2
          pool { token1 { id name decimals } token2 { id name decimals } }
        }
      }
    }
  }
` as unknown as TypedDocumentNode<any, any>;
// Nearest swap for a token against REEF at or after (blockHeight, indexInBlock)
export const NEAREST_SWAP_FOR_TOKEN_BY_BLOCK_AFTER_DOCUMENT = gql`
  query NearestSwapForTokenByBlockAfter($reef: String!, $token: String!, $bh: Int!, $ex: Int!) {
    poolEventsConnection(
      first: 1
      orderBy: [blockHeight_ASC, indexInBlock_ASC, id_ASC]
      where: {
        AND: [
          { type_eq: Swap }
          { OR: [
              { pool: { token1: { id_eq: $reef }, token2: { id_eq: $token } } }
              { pool: { token1: { id_eq: $token }, token2: { id_eq: $reef } } }
            ]
          }
          { OR: [
              { blockHeight_gt: $bh }
              { AND: [ { blockHeight_eq: $bh }, { indexInBlock_gte: $ex } ] }
            ]
          }
        ]
      }
    ) {
      edges {
        node {
          id
          blockHeight
          indexInBlock
          timestamp
          amount1
          amount2
          amountIn1
          amountIn2
          pool {
            token1 { id name decimals }
            token2 { id name decimals }
          }
        }
      }
    }
  }
` as unknown as TypedDocumentNode<any, any>;

// Nearest swap for a token against REEF at or after the given timestamp (UTC)
export const NEAREST_SWAP_FOR_TOKEN_BY_TIME_AFTER_DOCUMENT = gql`
  query NearestSwapForTokenByTimeAfter($reef: String!, $token: String!, $ts: DateTime!) {
    poolEventsConnection(
      first: 1
      orderBy: [timestamp_ASC, id_ASC]
      where: {
        AND: [
          { type_eq: Swap }
          { OR: [
              { pool: { token1: { id_eq: $reef }, token2: { id_eq: $token } } }
              { pool: { token1: { id_eq: $token }, token2: { id_eq: $reef } } }
            ]
          }
          { timestamp_gte: $ts }
        ]
      }
    ) {
      edges {
        node {
          id
          blockHeight
          indexInBlock
          timestamp
          amount1
          amount2
          amountIn1
          amountIn2
          pool {
            token1 { id name decimals }
            token2 { id name decimals }
          }
        }
      }
    }
  }
` as unknown as TypedDocumentNode<any, any>;

// Nearest swap for a token against REEF at or before the given timestamp (UTC)
export const NEAREST_SWAP_FOR_TOKEN_BY_TIME_DOCUMENT = gql`
  query NearestSwapForTokenByTime($reef: String!, $token: String!, $ts: DateTime!) {
    poolEventsConnection(
      first: 1
      orderBy: [timestamp_DESC, id_DESC]
      where: {
        AND: [
          { type_eq: Swap }
          { OR: [
              { pool: { token1: { id_eq: $reef }, token2: { id_eq: $token } } }
              { pool: { token1: { id_eq: $token }, token2: { id_eq: $reef } } }
            ]
          }
          { timestamp_lte: $ts }
        ]
      }
    ) {
      edges {
        node {
          id
          blockHeight
          indexInBlock
          timestamp
          amount1
          amount2
          amountIn1
          amountIn2
          pool {
            token1 { id name decimals }
            token2 { id name decimals }
          }
        }
      }
    }
  }
` as unknown as TypedDocumentNode<any, any>;

// Nearest swap for a token against REEF at or before (blockHeight, indexInBlock)
export const NEAREST_SWAP_FOR_TOKEN_DOCUMENT = gql`
  query NearestSwapForToken($reef: String!, $token: String!, $bh: Int!, $ex: Int!) {
    poolEventsConnection(
      first: 1
      orderBy: [blockHeight_DESC, indexInBlock_DESC, id_DESC]
      where: {
        AND: [
          { type_eq: Swap }
          { OR: [
              { pool: { token1: { id_eq: $reef }, token2: { id_eq: $token } } }
              { pool: { token1: { id_eq: $token }, token2: { id_eq: $reef } } }
            ]
          }
          { OR: [
              { blockHeight_lt: $bh }
              { AND: [ { blockHeight_eq: $bh }, { indexInBlock_lte: $ex } ] }
            ]
          }
        ]
      }
    ) {
      edges {
        node {
          id
          blockHeight
          indexInBlock
          timestamp
          amount1
          amount2
          amountIn1
          amountIn2
          pool {
            token1 { id name decimals }
            token2 { id name decimals }
          }
        }
      }
    }
  }
` as unknown as TypedDocumentNode<any, any>;

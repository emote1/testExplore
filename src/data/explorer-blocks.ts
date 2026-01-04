import { gql } from '@apollo/client';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';

// Last block at or before timestamp
export const BLOCK_BY_TIME_BEFORE_DOCUMENT = gql`
  query BlockByTimeBefore($ts: DateTime!) {
    blocks(orderBy: timestamp_DESC, limit: 1, where: { timestamp_lte: $ts }) {
      height
      timestamp
    }
  }
` as unknown as
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TypedDocumentNode<any, any>;

// First block at or after timestamp
export const BLOCK_BY_TIME_AFTER_DOCUMENT = gql`
  query BlockByTimeAfter($ts: DateTime!) {
    blocks(orderBy: timestamp_ASC, limit: 1, where: { timestamp_gte: $ts }) {
      height
      timestamp
    }
  }
` as unknown as
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TypedDocumentNode<any, any>;

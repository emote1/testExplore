import { gql } from '@apollo/client';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { parse } from 'graphql';
import { isHasuraExplorerMode } from '@/utils/transfer-query';

// Last block at or before timestamp
const BLOCK_BY_TIME_BEFORE_SUBSQUID_DOCUMENT = gql`
  query BlockByTimeBefore($ts: DateTime!) {
    blocks(orderBy: timestamp_DESC, limit: 1, where: { timestamp_lte: $ts }) {
      height
      timestamp
    }
  }
` as unknown as
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TypedDocumentNode<any, any>;

const BLOCK_BY_TIME_BEFORE_HASURA_DOCUMENT = parse(`
  query BlockByTimeBeforeHasura($ts: timestamptz!) {
    blocks: block(order_by: { timestamp: desc }, limit: 1, where: { timestamp: { _lte: $ts } }) {
      height
      timestamp
    }
  }
`) as unknown as TypedDocumentNode<any, any>;

export const BLOCK_BY_TIME_BEFORE_DOCUMENT = isHasuraExplorerMode
  ? BLOCK_BY_TIME_BEFORE_HASURA_DOCUMENT
  : BLOCK_BY_TIME_BEFORE_SUBSQUID_DOCUMENT;

// First block at or after timestamp
const BLOCK_BY_TIME_AFTER_SUBSQUID_DOCUMENT = gql`
  query BlockByTimeAfter($ts: DateTime!) {
    blocks(orderBy: timestamp_ASC, limit: 1, where: { timestamp_gte: $ts }) {
      height
      timestamp
    }
  }
` as unknown as
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TypedDocumentNode<any, any>;

const BLOCK_BY_TIME_AFTER_HASURA_DOCUMENT = parse(`
  query BlockByTimeAfterHasura($ts: timestamptz!) {
    blocks: block(order_by: { timestamp: asc }, limit: 1, where: { timestamp: { _gte: $ts } }) {
      height
      timestamp
    }
  }
`) as unknown as TypedDocumentNode<any, any>;

export const BLOCK_BY_TIME_AFTER_DOCUMENT = isHasuraExplorerMode
  ? BLOCK_BY_TIME_AFTER_HASURA_DOCUMENT
  : BLOCK_BY_TIME_AFTER_SUBSQUID_DOCUMENT;

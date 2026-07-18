// GraphQL queries + where/range builders for the SovraWaterfall ("pool") view.
// Summary + calendar come from the Hasura views wallet_flow_totals /
// wallet_flow_daily (see docker/migrations/20260615_wallet_flow_views.sql);
// list rows come from the transfer / staking tables.

import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { parse } from 'graphql';
import type { ChannelId } from '@/components/SovraWaterfall/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDoc = TypedDocumentNode<any, any>;

/**
 * Channel cards / USD totals / netFlow — one tiny row per (channel, token).
 * $accounts carries BOTH identities of a wallet (native id + claimed EVM
 * address): native REEF rows are keyed by the substrate id while ERC20 rows
 * are keyed by the EVM address, and the wallet owns both flows.
 */
export const POOL_SUMMARY_QUERY = parse(`
  query PoolSummary($accounts: [String!]!) {
    rows: wallet_flow_totals(where: { account_id: { _in: $accounts } }) {
      channel
      tokenId: token_id
      txCount: tx_count
      sumAmount: sum_amount
    }
  }
`) as unknown as AnyDoc;

/**
 * AVAILABLE (transferable) REEF balance for the lake headline — free minus the
 * frozen/staked portion. Comes from `account.available_balance`, which our own
 * indexer now computes from on-chain `system.account` (free/reserved/locked),
 * the same way Subsquid does — no Subsquid dependency. One tiny row keyed by the
 * native account id, so the lake renders instantly. (We deliberately show
 * available, not the total: a heavy staker's transferable balance is far smaller
 * than their free balance.) Other tokens can't be priced reliably (only buggy
 * ReefSwap REEF-pairs), so the lake stays REEF-only; full multi-token holdings
 * belong in a dedicated view via useTokenBalances.
 */
export const POOL_REEF_BALANCE_QUERY = parse(`
  query PoolReefBalance($account: String!) {
    rows: account(where: { id: { _eq: $account } }, limit: 1) {
      availableBalance: available_balance
      freeBalance: free_balance
      lockedBalance: locked_balance
    }
  }
`) as unknown as AnyDoc;

/** Calendar activity heatmap for one channel (one row per active day). */
export const POOL_CALENDAR_QUERY = parse(`
  query PoolCalendar($accounts: [String!]!, $channel: String!) {
    rows: wallet_flow_daily(
      where: { account_id: { _in: $accounts }, channel: { _eq: $channel } }
      order_by: { day: desc }
    ) {
      day
      txCount: tx_count
      sumAmount: sum_amount
    }
  }
`) as unknown as AnyDoc;

/** Transfer rows for a channel (inflow/outflow/swap), newest first. */
export const POOL_TRANSFERS_QUERY = parse(`
  query PoolTransfers($where: transfer_bool_exp!, $limit: Int!) {
    rows: transfer(where: $where, order_by: { timestamp: desc }, limit: $limit) {
      id
      amount
      timestamp
      success
      type
      reefswapAction: reefswap_action
      tokenId: token_id
      fromId: from_id
      toId: to_id
      blockHeight: block_height
      extrinsicId: extrinsic_id
      extrinsicHash: extrinsic_hash
      extrinsicIndex: extrinsic_index
      eventIndex: event_index
      verifiedContract: verified_contract { name contract_data }
    }
  }
`) as unknown as AnyDoc;

/**
 * Wallet-wide newest transfers for the live poll (use-pool-live): one cheap
 * query covering inflow + outflow + swap; the channel is classified on the
 * client. Same field aliases as POOL_TRANSFERS_QUERY (RawTransferRow-shaped).
 */
export const POOL_RECENT_TRANSFERS_QUERY = parse(`
  query PoolRecentTransfers($accounts: [String!]!, $limit: Int!) {
    rows: transfer(
      where: { _and: [
        { success: { _eq: true } },
        { _or: [{ from_id: { _in: $accounts } }, { to_id: { _in: $accounts } }] }
      ]}
      order_by: { timestamp: desc }
      limit: $limit
    ) {
      id
      amount
      timestamp
      success
      type
      reefswapAction: reefswap_action
      tokenId: token_id
      fromId: from_id
      toId: to_id
      blockHeight: block_height
      extrinsicId: extrinsic_id
      extrinsicHash: extrinsic_hash
      extrinsicIndex: extrinsic_index
      eventIndex: event_index
      verifiedContract: verified_contract { name contract_data }
    }
  }
`) as unknown as AnyDoc;

/** Staking reward rows for the stakeIn channel, newest first. */
export const POOL_STAKING_QUERY = parse(`
  query PoolStaking($where: staking_bool_exp!, $limit: Int!) {
    rows: staking(where: $where, order_by: { timestamp: desc }, limit: $limit) {
      id
      amount
      timestamp
      era
      validatorId: validator_id
      signerId: signer_id
    }
  }
`) as unknown as AnyDoc;

export interface TimeRange {
  gte: string;       // ISO
  lt?: string;       // ISO (exclusive upper bound, optional)
}

/** where for transfer-backed channels (inflow/outflow/swap). `accounts` holds
 *  every identity of the wallet (native id + claimed EVM address). */
export function poolTransferWhere(accounts: readonly string[], channel: ChannelId, range?: TimeRange): Record<string, unknown> {
  const ids = [...accounts];
  const and: Array<Record<string, unknown>> = [{ success: { _eq: true } }];
  if (channel === 'inflow') {
    and.push({ to_id: { _in: ids } }, { reefswap_action: { _is_null: true } });
  } else if (channel === 'outflow') {
    and.push({ from_id: { _in: ids } }, { reefswap_action: { _is_null: true } });
  } else if (channel === 'swap') {
    and.push({ from_id: { _in: ids } }, { reefswap_action: { _is_null: false } });
  }
  if (range) {
    const ts: Record<string, string> = { _gte: range.gte };
    if (range.lt) ts._lt = range.lt;
    and.push({ timestamp: ts });
  }
  return { _and: and };
}

/** where for the staking-backed stakeIn channel. */
export function poolStakingWhere(account: string, range?: TimeRange): Record<string, unknown> {
  const and: Array<Record<string, unknown>> = [
    { signer_id: { _eq: account } },
    { type: { _eq: 'Reward' } },
  ];
  if (range) {
    const ts: Record<string, string> = { _gte: range.gte };
    if (range.lt) ts._lt = range.lt;
    and.push({ timestamp: ts });
  }
  return { _and: and };
}

/** UTC day range for a CalendarPicker key 'Y-M0-D' (month 0-indexed). */
export function dayRangeUtc(key: string): TimeRange {
  const [y, m0, d] = key.split('-').map(Number);
  const start = Date.UTC(y, m0, d);
  return { gte: new Date(start).toISOString(), lt: new Date(start + 86400000).toISOString() };
}

/** Rolling last-24h range — matches the prototype's "Today" (ageMs < 1 day). */
export function todayRange(now: number): TimeRange {
  return { gte: new Date(now - 86400000).toISOString() };
}

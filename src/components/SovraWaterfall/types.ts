// Shared types for the SOVRA Waterfall feature (single-wallet "pool" view).
// The visual layer below `aggregate()` works with any array of SovraTx, so in
// phase 2 a UiTransfer -> SovraTx adapter is the only data wiring needed.

export type Dir = 'in' | 'out';
export type ChannelId = 'inflow' | 'stakeIn' | 'outflow' | 'swap';
export type TxStatus = 'confirmed' | 'pending';

/** The data contract every transaction must satisfy to flow through the view. */
export interface SovraTx {
  hash: string;          // hash / tx id
  channel: ChannelId;    // which flow channel it belongs to
  type: string;          // event type (incoming/outgoing/staking/swap)
  ageMs: number;         // age from "now" in ms (Date.now() - timestamp)
  timestamp?: number;    // epoch ms of the on-chain event (exact "when" in details)
  coin: string;          // 'REEF' | 'USDC' | 'MRD' | ...
  counterparty: string;  // the other party's address
  amount: number;        // amount in token units
  valueUsd: number;      // amount in USD (amount x price)
  whale: boolean;        // large transfer (whale badge)
  block: number;         // block number
  status: TxStatus;
  // Optional identifiers for the Reefscan link (real data only).
  extrinsicId?: string;
  extrinsicIndex?: number;
  eventIndex?: number;
}

export interface Channel {
  id: ChannelId;
  label: string;
  dir: Dir;
  color: string;
  icon: string;
  desc: string;
}

/**
 * A channel card backed by server aggregates (wallet_flow_totals).
 * Totals are denominated in USD (cross-token correct) plus a REEF-equivalent
 * (usdTotal / reefPrice) shown as the big number, matching the explorer UI.
 */
export interface ChannelSummary extends Channel {
  count: number;
  usdTotal: number;
  reefEqTotal: number;
  /** raw on-chain sum per token id (for debugging / future per-coin breakdown) */
  sumByToken?: Record<string, number>;
}

/** REEF USD price + per-token USD prices, threaded to the row/summary adapters. */
export interface PoolPrices {
  reefUsd: number;
  pricesById: Record<string, number | null>;
}

export interface TimeGroupData {
  label: string;
  fresh: boolean;
  depth: number;
  txs: SovraTx[];
}

export interface DayInfo {
  count: number;
  total: number;
  /** Present only when a day's transactions have been fetched (lazy). */
  txs?: SovraTx[];
}

export interface CalendarIndexData {
  dayMap: Record<string, DayInfo>;
  years: number[];
  minTs: number;
  maxTs: number;
}

export interface SelectedDay {
  key: string;
  year: number;
  month: number;
  day: number;
  info: DayInfo;
}

export interface PoolFilter {
  coin: string;
  min: number | null;
  max: number | null;
}

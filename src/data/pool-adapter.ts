// Adapters for the SovraWaterfall ("pool") view: map raw Hasura rows from the
// wallet_flow_* views and transfer/staking tables into the SovraTx / channel
// shapes the visual layer consumes. Pure functions, no React.

import { CHANNELS } from '@/components/SovraWaterfall/constants';
import type {
  CalendarIndexData, ChannelId, ChannelSummary, DayInfo, PoolPrices, SovraTx,
} from '@/components/SovraWaterfall/types';
import { REEF_TOKEN_ADDRESS } from '@/utils/evm-call';
import { isMrdId, isUsdcId } from '@/tokens/token-ids';
import { parseTokenMetadata, prettifyTokenName } from '@/utils/token-helpers';

const REEF_ID = REEF_TOKEN_ADDRESS.toLowerCase();

/** A transfer counts as a "whale" once its USD value crosses this threshold. */
export const WHALE_USD = 1000;

/** Best-effort token metadata by id (decimals + display symbol). */
export function tokenMeta(tokenId?: string | null): { decimals: number; symbol: string } {
  const id = (tokenId ?? '').toLowerCase();
  if (!id || id === REEF_ID) return { decimals: 18, symbol: 'REEF' };
  if (isUsdcId(id)) return { decimals: 6, symbol: 'USDC' };
  if (isMrdId(id)) return { decimals: 18, symbol: 'MRD' };
  return { decimals: 18, symbol: 'TOKEN' };
}

/** Raw integer amount string -> float in token units (display precision). */
export function rawToNumber(raw: string | number | bigint | null | undefined, decimals: number): number {
  if (raw == null) return 0;
  const s = typeof raw === 'string' ? raw : raw.toString();
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return n / 10 ** decimals;
}

/** USD price for a token id, or null when unknown. */
export function priceFor(tokenId: string | null | undefined, prices: PoolPrices): number | null {
  const id = (tokenId ?? '').toLowerCase();
  if (!id || id === REEF_ID) return prices.reefUsd > 0 ? prices.reefUsd : null;
  const p = prices.pricesById[id];
  return p == null ? null : p;
}

/* ---------------- raw row shapes (aliased camelCase from queries) --------- */

export interface RawTotalsRow {
  channel: string;
  tokenId: string;
  txCount: number | string;
  sumAmount: number | string;
}

export interface RawDailyRow {
  day: string;            // ISO, UTC-truncated
  txCount: number | string;
  sumAmount: number | string;
}

export interface RawTransferRow {
  id: string;
  amount: string | number;
  timestamp: string;
  success: boolean;
  type: string;
  reefswapAction?: string | null;
  tokenId?: string | null;
  fromId?: string | null;
  toId?: string | null;
  blockHeight?: number | null;
  extrinsicId?: string | null;
  extrinsicHash?: string | null;
  extrinsicIndex?: number | null;
  eventIndex?: number | null;
  verifiedContract?: { name?: string | null; contract_data?: unknown } | null;
}

/** Display meta for a transfer row: prefer the row's verified_contract
 *  metadata (real symbol + decimals), fall back to the known-id map. */
export function tokenMetaForRow(row: RawTransferRow): { decimals: number; symbol: string } {
  const base = tokenMeta(row.tokenId);
  const vc = row.verifiedContract;
  if (!vc) return base;
  const parsed = parseTokenMetadata(vc.contract_data, vc.name ?? base.symbol, base.decimals);
  const symbol = prettifyTokenName(parsed.name, row.tokenId) || base.symbol;
  return { decimals: parsed.decimals, symbol };
}

export interface RawStakingRow {
  id: string;
  amount: string | number;
  timestamp: string;
  era?: number | null;
  validatorId?: string | null;
  signerId?: string | null;
}

/* ----------------------------- mappers ------------------------------------ */

/** Collapse wallet_flow_totals rows into the 4 channel cards (USD + REEF-eq). */
export function summarizeChannels(
  rows: RawTotalsRow[] | null | undefined,
  prices: PoolPrices,
): Record<ChannelId, ChannelSummary> {
  const out = {} as Record<ChannelId, ChannelSummary>;
  (Object.keys(CHANNELS) as ChannelId[]).forEach((k) => {
    out[k] = { ...CHANNELS[k], count: 0, usdTotal: 0, reefEqTotal: 0, sumByToken: {} };
  });
  for (const r of rows ?? []) {
    const ch = r.channel as ChannelId;
    const c = out[ch];
    if (!c) continue;
    const meta = tokenMeta(r.tokenId);
    const amt = rawToNumber(r.sumAmount, meta.decimals);
    const price = priceFor(r.tokenId, prices);
    c.count += Number(r.txCount) || 0;
    if (price != null) c.usdTotal += amt * price;
    c.sumByToken![r.tokenId] = (c.sumByToken![r.tokenId] ?? 0) + amt;
  }
  const reef = prices.reefUsd;
  (Object.keys(out) as ChannelId[]).forEach((k) => {
    out[k].reefEqTotal = reef > 0 ? out[k].usdTotal / reef : 0;
  });
  return out;
}

/** Build the calendar index (day heatmap) from wallet_flow_daily rows. */
export function buildCalendarIndex(rows: RawDailyRow[] | null | undefined): CalendarIndexData {
  const dayMap: Record<string, DayInfo> = {};
  let minTs = Infinity;
  let maxTs = -Infinity;
  for (const r of rows ?? []) {
    // Parse Y-M-D straight from the ISO prefix (UTC) to avoid timezone drift.
    const [Y, M, D] = String(r.day).slice(0, 10).split('-').map(Number);
    if (!Y || !M || !D) continue;
    const key = `${Y}-${M - 1}-${D}`; // CalendarPicker uses 0-indexed month
    if (!dayMap[key]) dayMap[key] = { count: 0, total: 0 };
    dayMap[key].count += Number(r.txCount) || 0;
    const ts = Date.UTC(Y, M - 1, D);
    if (ts < minTs) minTs = ts;
    if (ts > maxTs) maxTs = ts;
  }
  const now = Date.now();
  const minY = minTs === Infinity ? new Date(now).getFullYear() : new Date(minTs).getFullYear();
  const maxY = maxTs === -Infinity ? new Date(now).getFullYear() : new Date(maxTs).getFullYear();
  const years: number[] = [];
  for (let y = maxY; y >= minY; y--) years.push(y);
  return {
    dayMap,
    years: years.length ? years : [new Date(now).getFullYear()],
    minTs,
    maxTs,
  };
}

/** Map a transfer row (inflow/outflow/swap) to SovraTx for the account.
 *  `account` may be a single id or every identity of the wallet
 *  (native id + claimed EVM address) — ERC20 rows are keyed by the EVM one. */
export function transferRowToSovraTx(
  row: RawTransferRow, account: string | readonly string[], prices: PoolPrices, now: number,
): SovraTx {
  const meta = tokenMetaForRow(row);
  const amount = rawToNumber(row.amount, meta.decimals);
  const price = priceFor(row.tokenId, prices);
  const valueUsd = price != null ? amount * price : 0;
  const accSet = new Set(
    (Array.isArray(account) ? account : [account]).map((a) => (a ?? '').toLowerCase()),
  );
  const isSwap = !!row.reefswapAction;
  const isIncoming = accSet.has((row.toId ?? '').toLowerCase());
  const channel: ChannelId = isSwap ? 'swap' : (isIncoming ? 'inflow' : 'outflow');
  const counterparty = channel === 'inflow' ? (row.fromId ?? '') : (row.toId ?? '');
  const ts = new Date(row.timestamp).getTime();
  return {
    hash: row.extrinsicHash || row.extrinsicId || row.id,
    channel,
    type: row.type,
    ageMs: Math.max(0, now - ts),
    timestamp: ts,
    coin: meta.symbol,
    counterparty,
    amount,
    valueUsd,
    whale: valueUsd >= WHALE_USD,
    block: Number(row.blockHeight ?? 0),
    status: row.success ? 'confirmed' : 'pending',
    extrinsicId: row.extrinsicId ?? undefined,
    extrinsicIndex: row.extrinsicIndex ?? undefined,
    eventIndex: row.eventIndex ?? undefined,
  };
}

/** Map a staking reward row to SovraTx (stakeIn channel, always REEF). */
export function stakingRowToSovraTx(row: RawStakingRow, prices: PoolPrices, now: number): SovraTx {
  const amount = rawToNumber(row.amount, 18);
  const valueUsd = prices.reefUsd > 0 ? amount * prices.reefUsd : 0;
  // Rewards carry no validator_id; label by era instead (id prefix = block height).
  const counterparty = row.validatorId
    || (row.era != null ? `Era ${row.era}` : 'Staking reward');
  const block = Number(String(row.id).split('-')[0]) || 0;
  const ts = new Date(row.timestamp).getTime();
  return {
    hash: row.id,
    channel: 'stakeIn',
    type: 'staking',
    ageMs: Math.max(0, now - ts),
    timestamp: ts,
    coin: 'REEF',
    counterparty,
    amount,
    valueUsd,
    whale: valueUsd >= WHALE_USD,
    block,
    status: 'confirmed',
  };
}

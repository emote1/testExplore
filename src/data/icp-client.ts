/**
 * ICP client
 *
 * Fetches pre-aggregated JSON payloads hosted on ICP (asset canister).
 */

import type { DailyExtrinsicsSparklineResponse, DailyWalletsSparklineResponse } from './aggregator-client';

export interface NewWalletsInflowEntry {
  address: string;
  incomingRaw: string;
  incomingReef: string;
}

export interface NewWalletsInflowResponse {
  asOf: string;
  from: string;
  to: string;
  minRaw: string;
  totalNew: number;
  qualified: number;
  truncated: boolean;
  entries: NewWalletsInflowEntry[];
}

const ICP_ACTIVE_WALLETS_DAILY_URL = import.meta.env.VITE_ICP_ACTIVE_WALLETS_DAILY_URL || '';
const ICP_EXTRINSICS_DAILY_URL = import.meta.env.VITE_ICP_EXTRINSICS_DAILY_URL || '';
const ICP_NEW_WALLETS_INFLOW_URL = import.meta.env.VITE_ICP_NEW_WALLETS_INFLOW_URL || '';

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    signal,
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`ICP API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function getActiveWalletsSparklineDailyIcp(
  signal?: AbortSignal
): Promise<DailyWalletsSparklineResponse> {
  if (!ICP_ACTIVE_WALLETS_DAILY_URL) {
    throw new Error('VITE_ICP_ACTIVE_WALLETS_DAILY_URL is not set');
  }
  return fetchJson<DailyWalletsSparklineResponse>(ICP_ACTIVE_WALLETS_DAILY_URL, signal);
}

export async function getExtrinsicsSparklineDailyIcp(
  signal?: AbortSignal
): Promise<DailyExtrinsicsSparklineResponse> {
  if (!ICP_EXTRINSICS_DAILY_URL) {
    throw new Error('VITE_ICP_EXTRINSICS_DAILY_URL is not set');
  }
  return fetchJson<DailyExtrinsicsSparklineResponse>(ICP_EXTRINSICS_DAILY_URL, signal);
}

export async function getNewWalletsInflowIcp(
  signal?: AbortSignal
): Promise<NewWalletsInflowResponse> {
  if (!ICP_NEW_WALLETS_INFLOW_URL) {
    throw new Error('VITE_ICP_NEW_WALLETS_INFLOW_URL is not set');
  }
  return fetchJson<NewWalletsInflowResponse>(ICP_NEW_WALLETS_INFLOW_URL, signal);
}

export const icpConfig = {
  activeWalletsDailyUrl: ICP_ACTIVE_WALLETS_DAILY_URL,
  extrinsicsDailyUrl: ICP_EXTRINSICS_DAILY_URL,
  newWalletsInflowUrl: ICP_NEW_WALLETS_INFLOW_URL,
  enabled: Boolean(ICP_ACTIVE_WALLETS_DAILY_URL),
  extrinsicsEnabled: Boolean(ICP_EXTRINSICS_DAILY_URL),
  newWalletsInflowEnabled: Boolean(ICP_NEW_WALLETS_INFLOW_URL),
};

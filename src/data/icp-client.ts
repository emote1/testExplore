/**
 * ICP client
 *
 * Fetches pre-aggregated JSON payloads hosted on ICP (asset canister).
 */

import type { DailyWalletsSparklineResponse } from './aggregator-client';

const ICP_ACTIVE_WALLETS_DAILY_URL = import.meta.env.VITE_ICP_ACTIVE_WALLETS_DAILY_URL || '';

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

export const icpConfig = {
  activeWalletsDailyUrl: ICP_ACTIVE_WALLETS_DAILY_URL,
  enabled: Boolean(ICP_ACTIVE_WALLETS_DAILY_URL),
};

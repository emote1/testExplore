import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@apollo/client';
import { useAddressResolver } from './use-address-resolver';
import { useReefPrice } from './use-reef-price';
import { useTokenUsdPrices, type TokenInput } from './use-token-usd-prices';
import { POOL_SUMMARY_QUERY, POOL_REEF_BALANCE_QUERY } from '@/data/pool';
import { rawToNumber, summarizeChannels, tokenMeta, type RawTotalsRow } from '@/data/pool-adapter';
import { REEF_TOKEN_ADDRESS } from '@/utils/evm-call';
import type { ChannelId, ChannelSummary, PoolPrices } from '@/components/SovraWaterfall/types';

const REEF_ID = REEF_TOKEN_ADDRESS.toLowerCase();

export interface UsePoolSummaryReturn {
  account: string | null;             // resolved native account id
  accounts: string[] | null;          // every identity: native id + claimed EVM address
  channels: Record<ChannelId, ChannelSummary>;
  prices: PoolPrices;
  reefUsd: number;
  balanceReef: number;        // available (transferable) REEF
  balanceUsd: number;
  lockedReef: number;         // frozen/staked REEF
  totalReef: number;          // free balance = available + locked
  netFlowUsd: number;
  loading: boolean;
  error?: Error;
}

/**
 * Instant per-wallet summary: resolves the address to a native id, pulls the
 * server-aggregated channel totals (wallet_flow_totals), combines with live
 * REEF/token prices and the REEF balance. One small query — renders at once.
 */
export function usePoolSummary(address: string | null | undefined): UsePoolSummaryReturn {
  const { resolveBoth } = useAddressResolver();
  const [account, setAccount] = useState<string | null>(null);
  // native transfers/staking are keyed by the substrate id, ERC20 rows by the
  // claimed EVM address — the wallet's flows live under BOTH identities.
  const [accounts, setAccounts] = useState<string[] | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!address) { setAccount(null); setAccounts(null); return; }
      try {
        const { nativeId, evmAddress } = await resolveBoth(address);
        if (!active) return;
        setAccount(nativeId);
        const ids = [nativeId, evmAddress ? evmAddress.toLowerCase() : null]
          .filter((v): v is string => !!v);
        setAccounts(ids.length > 0 ? ids : null);
      } catch {
        if (active) { setAccount(null); setAccounts(null); }
      }
    })();
    return () => { active = false; };
  }, [address, resolveBoth]);

  const { data, loading: qLoading, error } = useQuery(POOL_SUMMARY_QUERY, {
    variables: { accounts },
    skip: !accounts,
    fetchPolicy: 'cache-first',
  });
  const rows = useMemo(() => (data?.rows ?? []) as RawTotalsRow[], [data]);

  const { price: reefPrice } = useReefPrice();
  const reefUsd = reefPrice?.usd ?? 0;

  // Distinct non-REEF token ids present in the totals, with best-effort decimals.
  const tokenInputs = useMemo<TokenInput[]>(() => {
    const seen = new Set<string>();
    const out: TokenInput[] = [];
    for (const r of rows) {
      const id = (r.tokenId ?? '').toLowerCase();
      if (!id || id === REEF_ID || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, decimals: tokenMeta(id).decimals });
    }
    return out;
  }, [rows]);
  const { pricesById } = useTokenUsdPrices(tokenInputs);

  const prices = useMemo<PoolPrices>(() => ({ reefUsd, pricesById }), [reefUsd, pricesById]);
  const channels = useMemo(() => summarizeChannels(rows, prices), [rows, prices]);

  // AVAILABLE (transferable) REEF balance: one tiny account row keyed by the native id.
  // account.available_balance = free − frozen, computed by our indexer from on-chain
  // system.account (see docker/indexer/src/balances.ts) — excludes the staked/locked portion.
  const { data: balData, loading: balLoading } = useQuery(POOL_REEF_BALANCE_QUERY, {
    variables: { account },
    skip: !account,
    fetchPolicy: 'cache-first',
  });
  const balanceReef = useMemo(() => {
    const raw = balData?.rows?.[0]?.availableBalance;
    return raw != null ? rawToNumber(raw, 18) : 0;
  }, [balData]);
  // locked (staked) + total (free) — context for the available headline,
  // shown as the "staked" line under the balance (see WalletPool).
  const lockedReef = useMemo(() => {
    const raw = balData?.rows?.[0]?.lockedBalance;
    return raw != null ? rawToNumber(raw, 18) : 0;
  }, [balData]);
  const totalReef = useMemo(() => {
    const raw = balData?.rows?.[0]?.freeBalance;
    return raw != null ? rawToNumber(raw, 18) : 0;
  }, [balData]);
  const balanceUsd = balanceReef * reefUsd;

  const totalIn = channels.inflow.usdTotal + channels.stakeIn.usdTotal;
  const totalOut = channels.outflow.usdTotal + channels.swap.usdTotal;
  const netFlowUsd = totalIn - totalOut;

  const loading = (!!address && !account) || qLoading || balLoading;

  return {
    account,
    accounts,
    channels,
    prices,
    reefUsd,
    balanceReef,
    balanceUsd,
    lockedReef,
    totalReef,
    netFlowUsd,
    loading,
    error: error as Error | undefined,
  };
}

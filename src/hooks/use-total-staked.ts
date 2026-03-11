import { useEffect, useState } from 'react';
import { apolloClient } from '@/apollo-client';
import { gql } from '@apollo/client';
import { parse } from 'graphql';
import { isHasuraExplorerMode } from '@/utils/transfer-query';
import { fetchValidatorsMeta } from './validator-meta';

const REEF_TOTAL_SUPPLY_FALLBACK = 20_000_000_000;
const REEF_RPC_URL = 'https://rpc.reefscan.info';
const TOTAL_ISSUANCE_KEY = '0xc2261276cc9d1f8598ea4b6a74b15c2f57c875e4cff74148e4628f264b974c80';
const DAYS_PER_YEAR = 365;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const APY_REWARDS_WINDOW_SIZE = Number(import.meta.env.VITE_STAKING_APY_REWARDS_WINDOW_SIZE ?? '2000');

function hexLeToReef(hex: string): number {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const le = clean.match(/.{2}/g)?.reverse().join('') ?? '';
  const raw = BigInt('0x' + le);
  return Number(raw / 1000000000000000000n);
}


let cachedIssuance: { value: number; ts: number } | null = null;
const ISSUANCE_TTL_MS = 5 * 60 * 1000;

async function fetchTotalIssuance(): Promise<number> {
  if (cachedIssuance && Date.now() - cachedIssuance.ts < ISSUANCE_TTL_MS) {
    return cachedIssuance.value;
  }
  try {
    const res = await fetch(REEF_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'state_getStorage',
        params: [TOTAL_ISSUANCE_KEY],
      }),
    });
    if (!res.ok) return REEF_TOTAL_SUPPLY_FALLBACK;
    const json = await res.json();
    const hex = json?.result;
    if (typeof hex !== 'string' || !hex.startsWith('0x')) return REEF_TOTAL_SUPPLY_FALLBACK;
    const reef = hexLeToReef(hex);
    if (reef > 0) {
      cachedIssuance = { value: reef, ts: Date.now() };
      return reef;
    }
    return REEF_TOTAL_SUPPLY_FALLBACK;
  } catch {
    return REEF_TOTAL_SUPPLY_FALLBACK;
  }
}

const ERA_VALIDATORS_SUBSQUID_QUERY = gql`
  query LatestEraValidators {
    eraValidatorInfos(orderBy: era_DESC, limit: 200) {
      era
      address
      total
    }
  }
`;

const ERA_VALIDATORS_HASURA_QUERY = parse(`
  query LatestEraValidatorsHasura {
    eraValidatorInfos: era_validator_info(order_by: [{ era: desc }], limit: 200) {
      era
      address
      total
    }
  }
`);

const ERA_VALIDATORS_QUERY = isHasuraExplorerMode
  ? ERA_VALIDATORS_HASURA_QUERY
  : ERA_VALIDATORS_SUBSQUID_QUERY;

interface ValidatorInfo {
  era: number;
  address: string;
  total: string;
}

let cachedDailyReward: { value: number; ts: number } | null = null;
const DAILY_REWARD_TTL_MS = 30 * 60 * 1000;

const REWARDS_WINDOW_SUBSQUID_QUERY = gql`
  query RewardsWindow($limit: Int!, $offset: Int!) {
    stakings(
      where: { type_eq: Reward }
      orderBy: [timestamp_DESC, id_DESC]
      limit: $limit
      offset: $offset
    ) {
      amount
      timestamp
    }
  }
`;

const REWARDS_WINDOW_HASURA_QUERY = parse(`
  query RewardsWindowHasura($limit: Int!, $offset: Int!) {
    stakings: staking(
      where: { type: { _eq: "Reward" } }
      order_by: [{ timestamp: desc }, { id: desc }]
      limit: $limit
      offset: $offset
    ) {
      amount
      timestamp
    }
  }
`);

const REWARDS_WINDOW_QUERY = isHasuraExplorerMode
  ? REWARDS_WINDOW_HASURA_QUERY
  : REWARDS_WINDOW_SUBSQUID_QUERY;

interface RewardRow {
  amount: string;
  timestamp: string;
}

function toWindowSize(value: number): number {
  if (!Number.isFinite(value)) return 2000;
  return Math.min(10_000, Math.max(1, Math.floor(value)));
}

function parseMs(ts?: string): number | null {
  if (!ts) return null;
  const ms = new Date(ts).getTime();
  return Number.isFinite(ms) ? ms : null;
}

async function fetchDailyNetworkReward(): Promise<number | null> {
  if (cachedDailyReward && Date.now() - cachedDailyReward.ts < DAILY_REWARD_TTL_MS) {
    return cachedDailyReward.value;
  }
  try {
    const windowSize = toWindowSize(APY_REWARDS_WINDOW_SIZE);
    const pageSize = 200;
    const maxPages = Math.ceil(windowSize / pageSize) + 1;
    const rewards: RewardRow[] = [];
    let offset = 0;

    for (let page = 0; page < maxPages; page++) {
      const { data } = await apolloClient.query({
        query: REWARDS_WINDOW_QUERY,
        variables: { limit: pageSize, offset },
        fetchPolicy: 'network-only',
      });
      const pageRows = (data?.stakings ?? []) as RewardRow[];
      if (pageRows.length === 0) break;
      rewards.push(...pageRows);
      if (rewards.length >= windowSize || pageRows.length < pageSize) break;
      offset += pageSize;
    }

    const windowRewards = rewards.slice(0, windowSize);
    if (windowRewards.length === 0) return null;

    let totalRaw = 0n;
    for (const r of windowRewards) {
      totalRaw += BigInt(r.amount);
    }

    const newestMs = parseMs(windowRewards[0]?.timestamp);
    const oldestMs = parseMs(windowRewards[windowRewards.length - 1]?.timestamp);
    let windowMs = MS_PER_DAY;
    if (newestMs != null && oldestMs != null) {
      windowMs = Math.max(60 * 60 * 1000, newestMs - oldestMs);
    }

    const totalWindowReef = bigIntToReef(totalRaw);
    if (totalWindowReef > 0) {
      const dailyEquivalentReward = totalWindowReef * (MS_PER_DAY / windowMs);
      cachedDailyReward = { value: dailyEquivalentReward, ts: Date.now() };
      return dailyEquivalentReward;
    }
    return null;
  } catch {
    return null;
  }
}

export interface ValidatorStake {
  address: string;
  name: string | null;
  stakedReef: number;
  sharePct: number;
  commissionPct: number | null;
  apy: number | null;
}

interface TotalStakedState {
  loading: boolean;
  error?: Error;
  totalStakedRaw: bigint;
  totalStakedReef: number;
  totalSupply: number;
  stakedPct: number;
  validatorCount: number;
  era: number | null;
  apy: number | null;
  validators: ValidatorStake[];
}

function bigIntToReef(raw: bigint): number {
  return Number(raw / 100000000000000n) / 1e4;
}

export function useTotalStaked(): TotalStakedState {
  const [state, setState] = useState<TotalStakedState>({
    loading: true,
    error: undefined,
    totalStakedRaw: 0n,
    totalStakedReef: 0,
    totalSupply: 0,
    stakedPct: 0,
    validatorCount: 0,
    era: null,
    apy: null,
    validators: [],
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setState((prev) => ({ ...prev, loading: true }));

        const [{ data }, totalSupply] = await Promise.all([
          apolloClient.query({ query: ERA_VALIDATORS_QUERY, fetchPolicy: 'network-only' }),
          fetchTotalIssuance(),
        ]);

        if (cancelled) return;

        const validators = (data?.eraValidatorInfos ?? []) as ValidatorInfo[];
        if (validators.length === 0) {
          setState({
            loading: false,
            error: undefined,
            totalStakedRaw: 0n,
            totalStakedReef: 0,
            totalSupply,
            stakedPct: 0,
            validatorCount: 0,
            era: null,
            apy: null,
            validators: [],
          });
          return;
        }

        const latestEra = validators[0].era;
        const eraValidators = validators.filter((v) => v.era === latestEra);

        let totalStakedRaw = 0n;
        for (const v of eraValidators) {
          totalStakedRaw += BigInt(v.total);
        }

        const totalStakedReef = bigIntToReef(totalStakedRaw);
        const stakedPct = totalSupply > 0 ? (totalStakedReef / totalSupply) * 100 : 0;

        const dailyReward = await fetchDailyNetworkReward();
        const apy = dailyReward && totalStakedReef > 0
          ? (dailyReward / totalStakedReef) * DAYS_PER_YEAR * 100
          : null;

        if (cancelled) return;

        const rewardPerValidator = dailyReward && eraValidators.length > 0
          ? dailyReward / eraValidators.length
          : null;

        const meta = await fetchValidatorsMeta(eraValidators.map((v) => v.address));
        if (cancelled) return;

        const validatorsList: ValidatorStake[] = eraValidators
          .map((v) => {
            const staked = bigIntToReef(BigInt(v.total));
            const m = meta.get(v.address);
            const commission = m?.commissionPct ?? null;
            const vApy = rewardPerValidator && staked > 0
              ? (rewardPerValidator / staked) * DAYS_PER_YEAR * 100 * (1 - (commission ?? 0) / 100)
              : null;
            return {
              address: v.address,
              name: m?.name ?? null,
              stakedReef: staked,
              sharePct: totalStakedReef > 0 ? (staked / totalStakedReef) * 100 : 0,
              commissionPct: commission,
              apy: vApy,
            };
          })
          .sort((a, b) => {
            if (a.name && !b.name) return -1;
            if (!a.name && b.name) return 1;
            return b.stakedReef - a.stakedReef;
          });

        setState({
          loading: false,
          error: undefined,
          totalStakedRaw,
          totalStakedReef,
          totalSupply,
          stakedPct,
          validatorCount: eraValidators.length,
          era: latestEra,
          apy,
          validators: validatorsList,
        });
      } catch (e) {
        if (cancelled) return;
        const err = e instanceof Error ? e : new Error(String(e));
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err,
        }));
        try {
          window.dispatchEvent(new CustomEvent('squid-outage', {
            detail: { message: `Staking data: ${err.message}` },
          }));
        } catch { /* ignore */ }
      }
    }

    load();
    const interval = setInterval(load, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return state;
}

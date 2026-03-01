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

const REWARDS_PAGE_SUBSQUID_QUERY = gql`
  query RewardsPage($from: DateTime!, $offset: Int!) {
    stakings(
      where: { type_eq: Reward, timestamp_gte: $from }
      orderBy: [id_ASC]
      limit: 200
      offset: $offset
    ) {
      amount
    }
  }
`;

const REWARDS_PAGE_HASURA_QUERY = parse(`
  query RewardsPageHasura($from: timestamptz!, $offset: Int!) {
    stakings: staking(
      where: { type: { _eq: "Reward" }, timestamp: { _gte: $from } }
      order_by: [{ id: asc }]
      limit: 200
      offset: $offset
    ) {
      amount
    }
  }
`);

const REWARDS_PAGE_QUERY = isHasuraExplorerMode
  ? REWARDS_PAGE_HASURA_QUERY
  : REWARDS_PAGE_SUBSQUID_QUERY;

async function fetchDailyNetworkReward(): Promise<number | null> {
  if (cachedDailyReward && Date.now() - cachedDailyReward.ts < DAILY_REWARD_TTL_MS) {
    return cachedDailyReward.value;
  }
  try {
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let totalRaw = 0n;
    let offset = 0;
    const maxPages = 20;

    for (let page = 0; page < maxPages; page++) {
      const { data } = await apolloClient.query({
        query: REWARDS_PAGE_QUERY,
        variables: { from, offset },
        fetchPolicy: 'network-only',
      });
      const rewards = data?.stakings ?? [];
      if (rewards.length === 0) break;
      for (const r of rewards) {
        totalRaw += BigInt(r.amount);
      }
      if (rewards.length < 200) break;
      offset += 200;
    }

    const totalReef = bigIntToReef(totalRaw);
    if (totalReef > 0) {
      cachedDailyReward = { value: totalReef, ts: Date.now() };
      return totalReef;
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

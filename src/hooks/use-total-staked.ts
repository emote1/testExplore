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
const STAKING_SUMMARY_URL = String(import.meta.env.VITE_STAKING_SUMMARY_URL ?? '/v1/staking/summary');
const STAKING_SUMMARY_REFRESH_MS = Math.max(60_000, Number(import.meta.env.VITE_STAKING_SUMMARY_REFRESH_MS ?? `${30 * 60 * 1000}`));

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
      commission
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
  commissionPct: number | null;
}

interface EraValidatorsQueryResult {
  eraValidatorInfos?: Array<{
    era?: number | string | null;
    address?: string | null;
    total?: number | string | null;
    commission?: number | string | null;
  }>;
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

interface RewardsQueryResult {
  stakings?: Array<{
    amount?: number | string | null;
    timestamp?: string | null;
  }>;
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

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeIntegerText(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^[+-]?\d+$/.test(trimmed)) return trimmed;
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed)) return null;
  const sign = trimmed.startsWith('-') ? '-' : '';
  const unsigned = trimmed.replace(/^[+-]/, '');
  const [mantissa, exponentRaw = '0'] = unsigned.toLowerCase().split('e');
  const exponent = Number(exponentRaw);
  if (!Number.isInteger(exponent)) return null;
  const [whole = '', fraction = ''] = mantissa.split('.');
  const digits = `${whole}${fraction}`.replace(/^0+(?=\d)/, '') || '0';
  const fractionLength = fraction.length;
  if (digits === '0') return '0';
  if (exponent < 0) {
    const shift = fractionLength + exponent;
    if (shift < 0) return null;
    const integerLength = whole.length + exponent;
    if (integerLength <= 0) return '0';
    return `${sign}${digits.slice(0, integerLength)}`.replace(/^(-?)0+(?=\d)/, '$1') || '0';
  }
  const integerLength = whole.length + exponent;
  const padded = digits.length < integerLength ? digits.padEnd(integerLength, '0') : digits.slice(0, integerLength);
  return `${sign}${padded.replace(/^0+(?=\d)/, '') || '0'}`;
}

function toBigIntText(value: unknown): string | null {
  if (typeof value === 'string') return normalizeIntegerText(value);
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number' && Number.isFinite(value)) return normalizeIntegerText(Math.trunc(value).toString());
  return null;
}

function toCommissionPct(value: unknown): number | null {
  const raw = toFiniteNumber(value);
  if (raw == null || raw < 0) return null;
  if (raw <= 100) return raw;
  return raw / 1_000_000_000 * 100;
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
      const pageRows = Array.isArray((data as RewardsQueryResult | undefined)?.stakings)
        ? ((data as RewardsQueryResult).stakings ?? [])
            .map((row) => ({
              amount: toBigIntText(row?.amount) ?? '',
              timestamp: typeof row?.timestamp === 'string' ? row.timestamp : '',
            }))
            .filter((row): row is RewardRow => !!row.amount && !!row.timestamp)
        : [];
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

interface StakingSummaryApiResponse {
  asOf?: string;
  era?: number | null;
  totalStakedRaw?: string;
  totalStakedReef?: number;
  totalSupply?: number;
  stakedPct?: number;
  validatorCount?: number;
  apy?: number | null;
  validators?: Array<{
    address?: string;
    name?: string | null;
    stakedReef?: number;
    sharePct?: number;
    commissionPct?: number | null;
    apy?: number | null;
  }>;
}

function bigIntToReef(raw: bigint): number {
  return Number(raw / 100000000000000n) / 1e4;
}

function initialState(): TotalStakedState {
  return {
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
  };
}

function mapServerSummaryToState(summary: StakingSummaryApiResponse): TotalStakedState | null {
  const totalStakedRawText = typeof summary?.totalStakedRaw === 'string' && summary.totalStakedRaw.trim()
    ? summary.totalStakedRaw
    : '0';
  let totalStakedRaw = 0n;
  try {
    totalStakedRaw = BigInt(totalStakedRawText);
  } catch {
    totalStakedRaw = 0n;
  }

  const validators = Array.isArray(summary?.validators)
    ? summary.validators
        .filter((item): item is NonNullable<StakingSummaryApiResponse['validators']>[number] => !!item && typeof item.address === 'string')
        .map((item) => ({
          address: item.address!,
          name: typeof item.name === 'string' ? item.name : null,
          stakedReef: typeof item.stakedReef === 'number' && Number.isFinite(item.stakedReef) ? item.stakedReef : 0,
          sharePct: typeof item.sharePct === 'number' && Number.isFinite(item.sharePct) ? item.sharePct : 0,
          commissionPct: typeof item.commissionPct === 'number' && Number.isFinite(item.commissionPct) ? item.commissionPct : null,
          apy: typeof item.apy === 'number' && Number.isFinite(item.apy) ? item.apy : null,
        }))
    : [];

  return {
    loading: false,
    error: undefined,
    totalStakedRaw,
    totalStakedReef: typeof summary?.totalStakedReef === 'number' && Number.isFinite(summary.totalStakedReef) ? summary.totalStakedReef : bigIntToReef(totalStakedRaw),
    totalSupply: typeof summary?.totalSupply === 'number' && Number.isFinite(summary.totalSupply) ? summary.totalSupply : 0,
    stakedPct: typeof summary?.stakedPct === 'number' && Number.isFinite(summary.stakedPct) ? summary.stakedPct : 0,
    validatorCount: typeof summary?.validatorCount === 'number' && Number.isFinite(summary.validatorCount) ? summary.validatorCount : validators.length,
    era: typeof summary?.era === 'number' && Number.isFinite(summary.era) ? summary.era : null,
    apy: typeof summary?.apy === 'number' && Number.isFinite(summary.apy) ? summary.apy : null,
    validators,
  };
}

async function fetchServerStakingSummary(signal?: AbortSignal): Promise<TotalStakedState | null> {
  const res = await fetch(STAKING_SUMMARY_URL, {
    method: 'GET',
    signal,
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Staking summary API error: ${res.status} ${res.statusText}`);
  }
  const json = await res.json() as StakingSummaryApiResponse;
  return mapServerSummaryToState(json);
}

export function useTotalStaked(): TotalStakedState {
  const [state, setState] = useState<TotalStakedState>(initialState);

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();

    async function load() {
      setState((prev) => ({ ...prev, loading: true }));

      try {
        const serverState = await fetchServerStakingSummary(ac.signal);
        if (cancelled || !serverState) return;
        setState(serverState);
        return;
      } catch {
      }

      try {
        const [{ data }, totalSupply] = await Promise.all([
          apolloClient.query({ query: ERA_VALIDATORS_QUERY, fetchPolicy: 'network-only' }),
          fetchTotalIssuance(),
        ]);

        if (cancelled) return;

        const validators = Array.isArray((data as EraValidatorsQueryResult | undefined)?.eraValidatorInfos)
          ? ((data as EraValidatorsQueryResult).eraValidatorInfos ?? [])
              .map((row) => {
                const era = toFiniteNumber(row?.era);
                const address = typeof row?.address === 'string' ? row.address : null;
                const total = toBigIntText(row?.total);
                const commissionPct = toCommissionPct(row?.commission);
                if (era == null || !address || !total) return null;
                return { era, address, total, commissionPct } satisfies ValidatorInfo;
              })
              .filter((row): row is ValidatorInfo => row != null)
          : [];
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

        const needsCommissionFallback = !isHasuraExplorerMode || eraValidators.some((v) => v.commissionPct == null);
        const meta = await fetchValidatorsMeta(eraValidators.map((v) => v.address), needsCommissionFallback);
        if (cancelled) return;

        const validatorsList: ValidatorStake[] = eraValidators
          .map((v) => {
            const staked = bigIntToReef(BigInt(v.total));
            const m = meta.get(v.address);
            const commission = v.commissionPct ?? m?.commissionPct ?? null;
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
    const interval = setInterval(load, STAKING_SUMMARY_REFRESH_MS);

    return () => {
      cancelled = true;
      ac.abort();
      clearInterval(interval);
    };
  }, []);

  return state;
}

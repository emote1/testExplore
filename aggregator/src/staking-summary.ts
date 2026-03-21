import { GraphQLClient } from 'graphql-request';
import { xxhashAsHex, decodeAddress } from '@polkadot/util-crypto';
import { u8aToHex } from '@polkadot/util';

const REEF_TOTAL_SUPPLY_FALLBACK = 20_000_000_000;
const TOTAL_ISSUANCE_KEY = '0xc2261276cc9d1f8598ea4b6a74b15c2f57c875e4cff74148e4628f264b974c80';
const DAYS_PER_YEAR = 365;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const META_TTL_MS = 30 * 60 * 1000;
const ISSUANCE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_GRAPHQL_URL = 'https://squid.subsquid.io/reef-explorer/graphql';
const DEFAULT_RPC_URL = 'https://rpc.reefscan.info';

const APY_REWARDS_WINDOW_SIZE = Number(
  process.env.APY_REWARDS_WINDOW_SIZE
  ?? process.env.VITE_STAKING_APY_REWARDS_WINDOW_SIZE
  ?? '2000'
);

function buildExplorerHttpUrl(): string {
  const direct = process.env.REEF_EXPLORER_HTTP_URL ?? process.env.VITE_REEF_EXPLORER_HTTP_URL ?? '';
  if (direct) return direct;
  const proxyTarget = process.env.REEF_EXPLORER_PROXY_TARGET ?? '';
  const proxyPath = process.env.REEF_EXPLORER_PROXY_PATH ?? '/v1/graphql';
  if (!proxyTarget) return DEFAULT_GRAPHQL_URL;
  const base = proxyTarget.replace(/\/+$/, '');
  const path = proxyPath.startsWith('/') ? proxyPath : `/${proxyPath}`;
  return `${base}${path}`;
}

const EXPLORER_HTTP_URL = buildExplorerHttpUrl();
const EXPLORER_BACKEND_RAW = (
  process.env.REEF_EXPLORER_BACKEND
  ?? process.env.VITE_REEF_EXPLORER_BACKEND
  ?? ''
).toLowerCase();
const EXPLORER_ADMIN_SECRET = process.env.REEF_EXPLORER_ADMIN_SECRET ?? process.env.VITE_REEF_EXPLORER_ADMIN_SECRET ?? '';
const REEF_RPC_URL = process.env.REEF_RPC_URL ?? DEFAULT_RPC_URL;

const isHasuraExplorerMode = EXPLORER_BACKEND_RAW
  ? EXPLORER_BACKEND_RAW === 'hasura'
  : EXPLORER_HTTP_URL.includes('/v1/graphql') || EXPLORER_HTTP_URL.includes('/api/reef-explorer');

const ERA_VALIDATORS_QUERY = isHasuraExplorerMode
  ? `
    query LatestEraValidatorsHasura {
      eraValidatorInfos: era_validator_info(order_by: [{ era: desc }], limit: 200) {
        era
        address
        total
        commission
      }
    }
  `
  : `
    query LatestEraValidators {
      eraValidatorInfos(orderBy: era_DESC, limit: 200) {
        era
        address
        total
      }
    }
  `;

const REWARDS_WINDOW_QUERY = isHasuraExplorerMode
  ? `
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
  `
  : `
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

interface ValidatorInfo {
  era: number;
  address: string;
  total: string;
  commissionPct: number | null;
}

interface RewardRow {
  amount: string;
  timestamp: string;
}

interface ValidatorMeta {
  name: string | null;
  commissionPct?: number | null;
}

export interface StakingSummaryValidator {
  address: string;
  name: string | null;
  stakedReef: number;
  sharePct: number;
  commissionPct: number | null;
  apy: number | null;
}

export interface StakingSummaryResponse {
  asOf: string;
  era: number | null;
  totalStakedRaw: string;
  totalStakedReef: number;
  totalSupply: number;
  stakedPct: number;
  validatorCount: number;
  apy: number | null;
  validators: StakingSummaryValidator[];
}

interface EraValidatorsQueryResult {
  eraValidatorInfos?: Array<{
    era?: number | string | null;
    address?: string | null;
    total?: number | string | null;
    commission?: number | string | null;
  }>;
}

interface RewardsQueryResult {
  stakings?: Array<{
    amount?: number | string | null;
    timestamp?: string | null;
  }>;
}

let cachedIssuance: { value: number; ts: number } | null = null;
let cachedMeta: { data: Map<string, ValidatorMeta>; ts: number; includesCommission: boolean } | null = null;
let cachedSummary: { era: number | null; summary: StakingSummaryResponse } | null = null;
let inflightSummary: Promise<StakingSummaryResponse> | null = null;
let inflightEra: number | null = null;

const gqlClient = new GraphQLClient(EXPLORER_HTTP_URL, {
  headers: EXPLORER_ADMIN_SECRET
    ? { 'x-hasura-admin-secret': EXPLORER_ADMIN_SECRET }
    : undefined,
});

function bigIntToReef(raw: bigint): number {
  return Number(raw / 100000000000000n) / 1e4;
}

function hexLeToReef(hex: string): number {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const le = clean.match(/.{2}/g)?.reverse().join('') ?? '';
  const raw = BigInt(`0x${le}`);
  return Number(raw / 1000000000000000000n);
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
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeIntegerText(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return trimmed.replace(/^0+(?=\d)/, '') || '0';

  const sciMatch = trimmed.match(/^(\+?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
  if (!sciMatch) return null;

  const [, , whole, fraction = '', exponentRaw] = sciMatch;
  const exponent = Number(exponentRaw);
  if (!Number.isFinite(exponent)) return null;

  if (exponent < 0) {
    const integerLength = whole.length + exponent;
    if (integerLength <= 0) return '0';
    const digits = `${whole}${fraction}`;
    return digits.slice(0, integerLength).replace(/^0+(?=\d)/, '') || '0';
  }

  const digits = `${whole}${fraction}`;
  const zerosToAdd = exponent - fraction.length;
  if (zerosToAdd >= 0) {
    return `${digits}${'0'.repeat(zerosToAdd)}`.replace(/^0+(?=\d)/, '') || '0';
  }

  const integerLength = whole.length + exponent;
  return digits.slice(0, integerLength).replace(/^0+(?=\d)/, '') || '0';
}

function toBigIntText(value: unknown): string | null {
  if (typeof value === 'string') return normalizeIntegerText(value);
  if (typeof value === 'number' && Number.isFinite(value)) return normalizeIntegerText(Math.trunc(value).toString());
  return null;
}

function toCommissionPct(value: unknown): number | null {
  const raw = toFiniteNumber(value);
  if (raw == null || raw < 0) return null;
  return raw / 1_000_000_000 * 100;
}

function storageKey(palletName: string, storageName: string, accountSs58: string): string {
  const palletHash = xxhashAsHex(palletName, 128).slice(2);
  const storageHash = xxhashAsHex(storageName, 128).slice(2);
  const pubkey = decodeAddress(accountSs58);
  const pubkeyHex = u8aToHex(pubkey).slice(2);
  const keyHash = xxhashAsHex(pubkey, 64).slice(2);
  return `0x${palletHash}${storageHash}${keyHash}${pubkeyHex}`;
}

function decodeIdentityName(hex: string): string | null {
  try {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    const chunks = clean.match(/.{2}/g);
    if (!chunks) return null;
    const bytes = new Uint8Array(chunks.map((b) => parseInt(b, 16)));
    let offset = 0;
    const jLen = bytes[offset] >> 2;
    offset += 1;
    for (let j = 0; j < jLen; j++) {
      offset += 4;
      if (offset >= bytes.length) return null;
      const variant = bytes[offset];
      offset += 1;
      if (variant === 1) offset += 16;
    }
    offset += 16;
    if (offset >= bytes.length) return null;
    const addlLen = bytes[offset] >> 2;
    offset += 1;
    for (let a = 0; a < addlLen; a++) {
      for (let d = 0; d < 2; d++) {
        if (offset >= bytes.length) return null;
        const dt = bytes[offset];
        offset += 1;
        if (dt >= 1 && dt <= 33) offset += dt - 1;
      }
    }
    if (offset >= bytes.length) return null;
    const tag = bytes[offset];
    offset += 1;
    if (tag === 0) return null;
    if (tag >= 1 && tag <= 33) {
      const len = tag - 1;
      if (offset + len > bytes.length || len === 0) return null;
      const name = new TextDecoder().decode(bytes.slice(offset, offset + len));
      if (/[a-zA-Z]/.test(name)) return name;
    }
    return null;
  } catch {
    return null;
  }
}

function decodeCompact(bytes: Uint8Array, offset: number): { value: number; len: number } | null {
  if (offset >= bytes.length) return null;
  const mode = bytes[offset] & 0x03;
  if (mode === 0) return { value: bytes[offset] >> 2, len: 1 };
  if (mode === 1) {
    if (offset + 1 >= bytes.length) return null;
    return { value: (bytes[offset] | (bytes[offset + 1] << 8)) >> 2, len: 2 };
  }
  if (mode === 2) {
    if (offset + 3 >= bytes.length) return null;
    const value = (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 2;
    return { value, len: 4 };
  }
  return null;
}

function decodeCommission(hex: string): number | null {
  try {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (clean.length < 2) return null;
    const chunks = clean.match(/.{2}/g);
    if (!chunks) return null;
    const bytes = new Uint8Array(chunks.map((b) => parseInt(b, 16)));
    const compact = decodeCompact(bytes, 0);
    if (!compact) return null;
    return compact.value / 1_000_000_000 * 100;
  } catch {
    return null;
  }
}

async function rpcBatch(calls: { method: string; params: string[] }[]): Promise<(string | null)[]> {
  const batch = calls.map((call, index) => ({
    jsonrpc: '2.0',
    id: index + 1,
    method: call.method,
    params: call.params,
  }));
  const res = await fetch(REEF_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(batch),
  });
  if (!res.ok) return calls.map(() => null);
  const responses = await res.json() as Array<{ id?: number; result?: string | null }> | unknown;
  const sorted = Array.isArray(responses)
    ? [...responses].sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
    : [];
  return calls.map((_, index) => sorted[index]?.result ?? null);
}

async function fetchValidatorsMeta(addresses: string[], includeCommission = false): Promise<Map<string, ValidatorMeta>> {
  if (cachedMeta && Date.now() - cachedMeta.ts < META_TTL_MS) {
    const allCached = addresses.every((address) => cachedMeta!.data.has(address));
    if (allCached && (!includeCommission || cachedMeta.includesCommission)) return cachedMeta.data;
  }

  const result = new Map<string, ValidatorMeta>();
  if (addresses.length === 0) return result;

  try {
    const calls = [
      ...addresses.map((address) => ({ method: 'state_getStorage', params: [storageKey('Identity', 'IdentityOf', address)] })),
      ...(includeCommission ? addresses.map((address) => ({ method: 'state_getStorage', params: [storageKey('Staking', 'Validators', address)] })) : []),
    ];
    const responses = await rpcBatch(calls);
    const n = addresses.length;

    for (let i = 0; i < addresses.length; i++) {
      const identityHex = responses[i];
      const validatorHex = includeCommission ? responses[n + i] : null;
      result.set(addresses[i], {
        name: typeof identityHex === 'string' ? decodeIdentityName(identityHex) : null,
        commissionPct: includeCommission && typeof validatorHex === 'string' ? decodeCommission(validatorHex) : null,
      });
    }

    cachedMeta = { data: result, ts: Date.now(), includesCommission: includeCommission };
    return result;
  } catch {
    return result;
  }
}

async function fetchGraphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  return gqlClient.request<T>(query, variables);
}

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
    const json = await res.json() as { result?: unknown };
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

async function fetchDailyNetworkReward(): Promise<number | null> {
  try {
    const windowSize = toWindowSize(APY_REWARDS_WINDOW_SIZE);
    const pageSize = 200;
    const maxPages = Math.ceil(windowSize / pageSize) + 1;
    const rewards: RewardRow[] = [];
    let offset = 0;

    for (let page = 0; page < maxPages; page++) {
      const data = await fetchGraphql<RewardsQueryResult>(REWARDS_WINDOW_QUERY, { limit: pageSize, offset });
      const pageRows = Array.isArray(data?.stakings)
        ? data.stakings
            .map((row) => ({
              amount: toBigIntText(row?.amount) ?? '',
              timestamp: typeof row?.timestamp === 'string' ? row.timestamp : '',
            }))
            .filter((row) => row.amount && row.timestamp)
        : [];
      if (pageRows.length === 0) break;
      rewards.push(...pageRows);
      if (rewards.length >= windowSize || pageRows.length < pageSize) break;
      offset += pageSize;
    }

    const windowRewards = rewards.slice(0, windowSize);
    if (windowRewards.length === 0) return null;

    let totalRaw = 0n;
    for (const reward of windowRewards) {
      totalRaw += BigInt(reward.amount);
    }

    const newestMs = parseMs(windowRewards[0]?.timestamp);
    const oldestMs = parseMs(windowRewards[windowRewards.length - 1]?.timestamp);
    let windowMs = MS_PER_DAY;
    if (newestMs != null && oldestMs != null) {
      windowMs = Math.max(60 * 60 * 1000, newestMs - oldestMs);
    }

    const totalWindowReef = bigIntToReef(totalRaw);
    if (totalWindowReef <= 0) return null;
    return totalWindowReef * (MS_PER_DAY / windowMs);
  } catch {
    return null;
  }
}

async function fetchCurrentEraValidators(): Promise<{ latestEra: number | null; eraValidators: ValidatorInfo[] }> {
  const data = await fetchGraphql<EraValidatorsQueryResult>(ERA_VALIDATORS_QUERY);
  const validators = Array.isArray(data?.eraValidatorInfos)
    ? data.eraValidatorInfos
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
    return { latestEra: null, eraValidators: [] };
  }

  const latestEra = validators[0].era;
  const eraValidators = validators.filter((validator) => validator.era === latestEra);
  return { latestEra, eraValidators };
}

function emptySummary(): StakingSummaryResponse {
  return {
    asOf: new Date().toISOString(),
    era: null,
    totalStakedRaw: '0',
    totalStakedReef: 0,
    totalSupply: REEF_TOTAL_SUPPLY_FALLBACK,
    stakedPct: 0,
    validatorCount: 0,
    apy: null,
    validators: [],
  };
}

async function buildSummaryForEra(latestEra: number, eraValidators: ValidatorInfo[]): Promise<StakingSummaryResponse> {
  const needsCommissionFallback = !isHasuraExplorerMode || eraValidators.some((validator) => validator.commissionPct == null);
  const [totalSupply, dailyReward, meta] = await Promise.all([
    fetchTotalIssuance(),
    fetchDailyNetworkReward(),
    fetchValidatorsMeta(eraValidators.map((validator) => validator.address), needsCommissionFallback),
  ]);

  let totalStakedRaw = 0n;
  for (const validator of eraValidators) {
    totalStakedRaw += BigInt(validator.total);
  }

  const totalStakedReef = bigIntToReef(totalStakedRaw);
  const stakedPct = totalSupply > 0 ? (totalStakedReef / totalSupply) * 100 : 0;
  const apy = dailyReward && totalStakedReef > 0
    ? (dailyReward / totalStakedReef) * DAYS_PER_YEAR * 100
    : null;
  const rewardPerValidator = dailyReward && eraValidators.length > 0
    ? dailyReward / eraValidators.length
    : null;

  const validators = eraValidators
    .map((validator) => {
      const staked = bigIntToReef(BigInt(validator.total));
      const validatorMeta = meta.get(validator.address);
      const commission = validator.commissionPct ?? validatorMeta?.commissionPct ?? null;
      const validatorApy = rewardPerValidator && staked > 0
        ? (rewardPerValidator / staked) * DAYS_PER_YEAR * 100 * (1 - (commission ?? 0) / 100)
        : null;
      return {
        address: validator.address,
        name: validatorMeta?.name ?? null,
        stakedReef: staked,
        sharePct: totalStakedReef > 0 ? (staked / totalStakedReef) * 100 : 0,
        commissionPct: commission,
        apy: validatorApy,
      } satisfies StakingSummaryValidator;
    })
    .sort((a, b) => {
      if (a.name && !b.name) return -1;
      if (!a.name && b.name) return 1;
      return b.stakedReef - a.stakedReef;
    });

  return {
    asOf: new Date().toISOString(),
    era: latestEra,
    totalStakedRaw: totalStakedRaw.toString(),
    totalStakedReef,
    totalSupply,
    stakedPct,
    validatorCount: eraValidators.length,
    apy,
    validators,
  };
}

export async function getStakingSummary(): Promise<StakingSummaryResponse> {
  const { latestEra, eraValidators } = await fetchCurrentEraValidators();

  if (latestEra == null || eraValidators.length === 0) {
    const summary = emptySummary();
    cachedSummary = { era: null, summary };
    return summary;
  }

  if (cachedSummary && cachedSummary.era === latestEra) {
    return cachedSummary.summary;
  }

  if (inflightSummary && inflightEra === latestEra) {
    return inflightSummary;
  }

  inflightEra = latestEra;
  inflightSummary = buildSummaryForEra(latestEra, eraValidators);

  try {
    const summary = await inflightSummary;
    cachedSummary = { era: latestEra, summary };
    return summary;
  } finally {
    inflightSummary = null;
    inflightEra = null;
  }
}

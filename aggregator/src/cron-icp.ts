/**
 * Off-chain aggregation that pushes a daily snapshot into the ICP canister.
 * Computes metrics via Subsquid GraphQL, then calls ingest_daily_snapshot.
 */

import { request, gql } from 'graphql-request';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const REEF_EXPLORER_URL = 'https://squid.subsquid.io/reef-explorer/graphql';
const REEF_DECIMALS = 18n;
const REEF_BASE = 10n ** REEF_DECIMALS;
const DEFAULT_MIN_REEF = 1_000_000n;
const MIN_REEF_RAW = BigInt(process.env.NEW_WALLETS_MIN_REEF_RAW ?? (DEFAULT_MIN_REEF * REEF_BASE).toString());
const NEW_WALLETS_LIMIT = Number(process.env.NEW_WALLETS_LIMIT ?? '50');
const RETRY_COUNT = Number(process.env.RETRY_COUNT ?? '3');
const RETRY_DELAY_MS = Number(process.env.RETRY_DELAY_MS ?? '2000');


const TRANSFERS_PAGE = gql`
  query TransfersPage($from: DateTime!, $to: DateTime!, $after: String) {
    transfersConnection(
      where: {
        timestamp_gte: $from
        timestamp_lt: $to
        type_eq: Native
        success_eq: true
      }
      orderBy: timestamp_ASC
      first: 100
      after: $after
    ) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          from { id }
          to { id }
          amount
        }
      }
    }
  }
`;

interface TransferEdge {
  node: {
    from: { id: string };
    to: { id: string };
    amount?: string | null;
  };
}

async function requestWithRetry<T>(query: string, variables: Record<string, unknown>, label: string): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await request<T>(REEF_EXPLORER_URL, query, variables);
    } catch (error) {
      attempt += 1;
      const status = (error as { response?: { status?: number } })?.response?.status;
      const shouldRetry = attempt <= RETRY_COUNT && (!status || status >= 500);
      if (!shouldRetry) throw error;
      const waitMs = RETRY_DELAY_MS * attempt;
      console.warn(`  ${label} failed (status ${status ?? 'unknown'}). retrying in ${waitMs}ms (${attempt}/${RETRY_COUNT})`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}

async function fetchAllTransfers(from: string, to: string): Promise<TransferEdge[]> {
  const all: TransferEdge[] = [];
  let cursor: string | null = null;
  let hasNext = true;
  let pages = 0;
  const maxPages = 100; // safety limit (200 items/page = up to 20k transfers)

  interface TransfersPageResponse {
    transfersConnection: {
      pageInfo: { hasNextPage: boolean; endCursor: string };
      edges: TransferEdge[];
    };
  }

  while (hasNext && pages < maxPages) {
    const variables: { from: string; to: string; after?: string } = { from, to };
    if (cursor) variables.after = cursor;
    const resp: TransfersPageResponse = await requestWithRetry(
      TRANSFERS_PAGE,
      variables,
      `transfers page ${pages + 1}`
    );

    all.push(...resp.transfersConnection.edges);
    hasNext = resp.transfersConnection.pageInfo.hasNextPage;
    cursor = resp.transfersConnection.pageInfo.endCursor;
    pages++;

    if (pages % 50 === 0) {
      console.log(`  fetched ${all.length} transfers (${pages} pages)...`);
    }
  }

  return all;
}

function computeActiveWallets(transfers: TransferEdge[]): Set<string> {
  const wallets = new Set<string>();
  for (const t of transfers) {
    wallets.add(t.node.from.id);
    wallets.add(t.node.to.id);
  }
  return wallets;
}

function computeIncomingSums(transfers: TransferEdge[]): Map<string, bigint> {
  const sums = new Map<string, bigint>();
  for (const t of transfers) {
    const to = t.node.to?.id;
    if (!to) continue;
    const raw = BigInt(t.node.amount ?? '0');
    const next = (sums.get(to) ?? 0n) + raw;
    sums.set(to, next);
  }
  return sums;
}

function toIsoDay(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatReef(raw: bigint): string {
  const whole = raw / REEF_BASE;
  const frac = raw % REEF_BASE;
  const fracStr = frac.toString().padStart(Number(REEF_DECIMALS), '0').slice(0, 4);
  return `${whole}.${fracStr}`;
}

function escapeCandidText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function getDfxBin(): string {
  return process.env.DFX_BIN ?? 'dfx';
}

function ingestSnapshot(snapshot: {
  ts: string;
  active: number;
  new_wallets: number;
  extrinsics: number;
}) {
  const network = process.env.DFX_NETWORK ?? 'ic';
  const identity = process.env.DFX_IDENTITY;
  const canister = process.env.ICP_CANISTER ?? 'reef_metrics_onchain';
  const arg = `(record { ts = "${snapshot.ts}"; active = ${snapshot.active}; new_wallets = ${snapshot.new_wallets}; extrinsics = ${snapshot.extrinsics}; })`;

  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const dfxProject = process.env.DFX_PROJECT_DIR ?? path.resolve(repoRoot, 'icp-onchain');
  const dfxBin = getDfxBin();
  const args = ['canister', '--network', network];
  if (identity) args.push('--identity', identity);
  args.push('call', canister, 'ingest_daily_snapshot', arg);
  const result = spawnSync(dfxBin, args, { cwd: dfxProject, encoding: 'utf8' });

  if (result.status !== 0) {
    const stderr = result.stderr?.toString().trim();
    const stdout = result.stdout?.toString().trim();
    console.error('dfx ingest_daily_snapshot failed', { status: result.status, stdout, stderr, error: result.error });
    throw new Error(`dfx call failed${stderr ? `: ${stderr}` : ''}`);
  }
}

function ingestNewWalletsInflow(payload: string) {
  const network = process.env.DFX_NETWORK ?? 'ic';
  const identity = process.env.DFX_IDENTITY;
  const canister = process.env.ICP_CANISTER ?? 'reef_metrics_onchain';
  const escaped = escapeCandidText(payload);
  const arg = `("${escaped}")`;

  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const dfxProject = process.env.DFX_PROJECT_DIR ?? path.resolve(repoRoot, 'icp-onchain');
  const dfxBin = getDfxBin();
  const args = ['canister', '--network', network];
  if (identity) args.push('--identity', identity);
  args.push('call', canister, 'ingest_new_wallets_inflow', arg);
  const result = spawnSync(dfxBin, args, { cwd: dfxProject, encoding: 'utf8' });

  if (result.status !== 0) {
    const stderr = result.stderr?.toString().trim();
    const stdout = result.stdout?.toString().trim();
    console.error('dfx ingest_new_wallets_inflow failed', { status: result.status, stdout, stderr, error: result.error });
    throw new Error(`dfx call failed${stderr ? `: ${stderr}` : ''}`);
  }
}

const HEALTH_CHECK_QUERY = gql`query HealthCheck { squidStatus { height } }`;
const HEALTH_MAX_WAIT_MS = 30 * 60 * 1000;

async function waitForSubsquid(): Promise<void> {
  const startMs = Date.now();
  let attempt = 0;
  let delayMs = 15_000;
  while (Date.now() - startMs < HEALTH_MAX_WAIT_MS) {
    attempt++;
    try {
      await request<{ squidStatus: { height: number } }>(REEF_EXPLORER_URL, HEALTH_CHECK_QUERY);
      if (attempt > 1) console.log(`  Subsquid is back online after ${attempt} attempts`);
      return;
    } catch (err) {
      const elapsed = Math.round((Date.now() - startMs) / 1000);
      console.warn(`  Subsquid health check failed (attempt ${attempt}, ${elapsed}s elapsed). Retrying in ${delayMs / 1000}s...`);
      await new Promise((r) => setTimeout(r, delayMs));
      delayMs = Math.min(delayMs * 1.5, 5 * 60 * 1000);
    }
  }
  throw new Error(`Subsquid unavailable after ${HEALTH_MAX_WAIT_MS / 60000}min — aborting cron`);
}

async function run() {
  console.log('Starting off-chain aggregation at', new Date().toISOString());

  console.log('Checking Subsquid availability...');
  await waitForSubsquid();
  console.log('Subsquid is online.');

  const now = new Date();
  const last24hStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const prev24hStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const toIso = now.toISOString();
  const last24hIso = last24hStart.toISOString();
  const prev24hIso = prev24hStart.toISOString();

  console.log('Fetching transfers for last 24h...');
  const transfersLast24h = await fetchAllTransfers(last24hIso, toIso);
  console.log(`  got ${transfersLast24h.length} transfers`);

  console.log('Fetching transfers for prev 24h...');
  const transfersPrev24h = await fetchAllTransfers(prev24hIso, last24hIso);
  console.log(`  got ${transfersPrev24h.length} transfers`);

  const activeLast24h = computeActiveWallets(transfersLast24h);
  const activePrev24h = computeActiveWallets(transfersPrev24h);
  const incomingSums = computeIncomingSums(transfersLast24h);

  const newWalletsSet = new Set<string>();
  for (const wallet of activeLast24h) {
    if (!activePrev24h.has(wallet)) newWalletsSet.add(wallet);
  }

  const entries = Array.from(newWalletsSet)
    .map((address) => {
      const incomingRaw = incomingSums.get(address) ?? 0n;
      return {
        address,
        incomingRaw: incomingRaw.toString(),
        incomingReef: formatReef(incomingRaw),
      };
    })
    .filter((entry) => BigInt(entry.incomingRaw) >= MIN_REEF_RAW)
    .sort((a, b) => (BigInt(b.incomingRaw) > BigInt(a.incomingRaw) ? 1 : -1));

  const limitedEntries = NEW_WALLETS_LIMIT > 0 ? entries.slice(0, NEW_WALLETS_LIMIT) : entries;
  const inflowPayload = JSON.stringify({
    asOf: toIso,
    from: last24hIso,
    to: toIso,
    minRaw: MIN_REEF_RAW.toString(),
    totalNew: newWalletsSet.size,
    qualified: entries.length,
    truncated: entries.length > limitedEntries.length,
    entries: limitedEntries,
  });

  const snapshot = {
    ts: toIsoDay(now),
    active: activeLast24h.size,
    new_wallets: newWalletsSet.size,
    extrinsics: 0,
  };

  console.log('Snapshot:', snapshot);
  console.log(`New wallets with inflow >= min: ${entries.length}`);
  ingestSnapshot(snapshot);
  ingestNewWalletsInflow(inflowPayload);
  console.log('Snapshot pushed to ICP.');
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  run().catch((err) => {
    console.error('Aggregation failed:', err);
    process.exit(1);
  });
}

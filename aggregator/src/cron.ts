/**
 * Cron job to aggregate data from Reef Explorer GraphQL
 * Run: npm run cron (or schedule via system cron every 5-15 min)
 */

import { request, gql } from 'graphql-request';
import { fileURLToPath } from 'url';
import { initDb, getDb, saveDb, closeDb } from './db.js';

const REEF_EXPLORER_URL = 'https://squid.subsquid.io/reef-explorer/graphql';

// Query extrinsics count for a time range
const EXTRINSICS_COUNT = gql`
  query ExtrinsicsCount($from: DateTime!, $to: DateTime!) {
    extrinsicsConnection(
      where: { timestamp_gte: $from, timestamp_lt: $to }
      orderBy: timestamp_ASC
    ) {
      totalCount
    }
  }
`;

// Query transfers for active wallets (paginated, small batches due to API limits)
const TRANSFERS_PAGE = gql`
  query TransfersPage($from: DateTime!, $to: DateTime!, $after: String) {
    transfersConnection(
      where: { timestamp_gte: $from, timestamp_lt: $to }
      orderBy: timestamp_ASC
      first: 200
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
        }
      }
    }
  }
`;

interface TransferEdge {
  node: {
    from: { id: string };
    to: { id: string };
  };
}

async function fetchExtrinsicsCount(from: string, to: string): Promise<number> {
  const data = await request<{ extrinsicsConnection: { totalCount: number } }>(
    REEF_EXPLORER_URL,
    EXTRINSICS_COUNT,
    { from, to }
  );
  return data.extrinsicsConnection.totalCount;
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
    const resp: TransfersPageResponse = await request(REEF_EXPLORER_URL, TRANSFERS_PAGE, variables);

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

function computeGraphMetrics(transfers: TransferEdge[]) {
  const nodes = new Set<string>();
  const edges = new Map<string, number>(); // "from->to" -> count

  for (const t of transfers) {
    nodes.add(t.node.from.id);
    nodes.add(t.node.to.id);
    const key = `${t.node.from.id}->${t.node.to.id}`;
    edges.set(key, (edges.get(key) || 0) + 1);
  }

  const N = nodes.size;
  const E = edges.size;
  const eOverN = N > 0 ? E / N : 0;

  return { nodes: N, edges: E, eOverN };
}

// Helper to check if wallet exists in DB
function walletExists(db: ReturnType<typeof getDb>, account: string): boolean {
  const stmt = db.prepare(`SELECT 1 FROM wallet_first_seen WHERE account = ?`);
  stmt.bind([account]);
  const exists = stmt.step();
  stmt.free();
  return exists;
}

type RunOptions = {
  close?: boolean;
};

export async function runAggregation(options: RunOptions = {}) {
  const { close = true } = options;
  console.log('Starting aggregation at', new Date().toISOString());
  
  // Initialize DB first
  await initDb();
  const db = getDb();

  const now = new Date();
  const last24hStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const prev24hStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const toIso = now.toISOString();
  const last24hIso = last24hStart.toISOString();
  const prev24hIso = prev24hStart.toISOString();

  // Fetch extrinsics counts
  console.log('Fetching extrinsics counts...');
  const extLast24h = await fetchExtrinsicsCount(last24hIso, toIso);
  const extPrev24h = await fetchExtrinsicsCount(prev24hIso, last24hIso);
  const extGrowthPct = extPrev24h > 0 ? ((extLast24h - extPrev24h) / extPrev24h) * 100 : 0;

  console.log(`  extrinsics: last24h=${extLast24h}, prev24h=${extPrev24h}, growth=${extGrowthPct.toFixed(1)}%`);

  // Fetch transfers for active wallets
  console.log('Fetching transfers for last 24h...');
  const transfersLast24h = await fetchAllTransfers(last24hIso, toIso);
  console.log(`  got ${transfersLast24h.length} transfers`);

  console.log('Fetching transfers for prev 24h...');
  const transfersPrev24h = await fetchAllTransfers(prev24hIso, last24hIso);
  console.log(`  got ${transfersPrev24h.length} transfers`);

  // Compute active wallets
  const activeLast24h = computeActiveWallets(transfersLast24h);
  const activePrev24h = computeActiveWallets(transfersPrev24h);
  const activeGrowthPct = activePrev24h.size > 0
    ? ((activeLast24h.size - activePrev24h.size) / activePrev24h.size) * 100
    : 0;

  console.log(`  active wallets: last24h=${activeLast24h.size}, prev24h=${activePrev24h.size}, growth=${activeGrowthPct.toFixed(1)}%`);

  // Compute graph metrics
  const graph = computeGraphMetrics(transfersLast24h);
  console.log(`  graph: nodes=${graph.nodes}, edges=${graph.edges}, E/N=${graph.eOverN.toFixed(2)}`);

  // Detect new wallets (first seen in last 24h)
  let newWalletsCount = 0;
  for (const wallet of activeLast24h) {
    if (!walletExists(db, wallet)) {
      db.run(`INSERT OR IGNORE INTO wallet_first_seen (account, first_seen_at) VALUES (?, ?)`, [wallet, last24hIso]);
      newWalletsCount++;
    }
  }

  const newWalletsRatio = activeLast24h.size > 0 ? newWalletsCount / activeLast24h.size : 0;
  console.log(`  new wallets: ${newWalletsCount} (ratio=${(newWalletsRatio * 100).toFixed(1)}%)`);

  // Insert growth snapshot
  db.run(`
    INSERT INTO growth_24h (
      computed_at,
      extrinsics_last24h, extrinsics_prev24h, extrinsics_growth_pct,
      active_wallets_last24h, active_wallets_prev24h, active_wallets_growth_pct,
      graph_nodes, graph_edges, graph_e_over_n, new_wallets_ratio
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    toIso,
    extLast24h, extPrev24h, extGrowthPct,
    activeLast24h.size, activePrev24h.size, activeGrowthPct,
    graph.nodes, graph.edges, graph.eOverN, newWalletsRatio
  ]);

  // Update hourly bucket for current hour
  const hourStart = new Date(now);
  hourStart.setMinutes(0, 0, 0);
  const hourIso = hourStart.toISOString();

  // sql.js doesn't support ON CONFLICT well, so delete + insert
  db.run(`DELETE FROM hourly_buckets WHERE ts_hour = ?`, [hourIso]);
  db.run(`
    INSERT INTO hourly_buckets (ts_hour, extrinsics_count, active_wallets, new_wallets)
    VALUES (?, ?, ?, ?)
  `, [hourIso, extLast24h, activeLast24h.size, newWalletsCount]);

  // Update daily bucket for current day
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayIso = dayStart.toISOString().split('T')[0]; // YYYY-MM-DD format

  db.run(`DELETE FROM daily_buckets WHERE ts_day = ?`, [dayIso]);
  db.run(`
    INSERT INTO daily_buckets (ts_day, extrinsics_count, active_wallets, new_wallets)
    VALUES (?, ?, ?, ?)
  `, [dayIso, extLast24h, activeLast24h.size, newWalletsCount]);

  // Save DB to disk
  saveDb();

  console.log('Aggregation complete at', new Date().toISOString());
  if (close) {
    closeDb();
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  runAggregation().catch((err) => {
    console.error('Aggregation failed:', err);
    process.exit(1);
  });
}

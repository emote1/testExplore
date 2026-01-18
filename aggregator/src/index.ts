import express, { Request, Response } from 'express';
import cors from 'cors';
import { initDb, getDb } from './db.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Helper to run SELECT and get rows from sql.js
function queryAll(sql: string, params: unknown[] = []): Record<string, unknown>[] {
  const db = getDb();
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows: Record<string, unknown>[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as Record<string, unknown>);
  }
  stmt.free();
  return rows;
}

// Root - API info
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Reef Aggregator API',
    version: '1.0.0',
    endpoints: [
      'GET /health',
      'GET /v1/metrics/growth24h',
      'GET /v1/sparklines/extrinsics?hours=24',
      'GET /v1/sparklines/active-wallets?hours=24',
      'GET /v1/top-entities?limit=20',
    ],
  });
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /v1/metrics/growth24h
app.get('/v1/metrics/growth24h', (_req: Request, res: Response) => {
  try {
    const rows = queryAll(`SELECT * FROM growth_24h ORDER BY computed_at DESC LIMIT 1`);
    const row = rows[0];

    if (!row) {
      return res.json({
        asOf: new Date().toISOString(),
        extrinsics: { last24h: 0, prev24h: 0, growthPct: 0 },
        graph: { nodes: 0, edges: 0, eOverN: 0, newWalletsRatio: 0 },
        activeWallets: { last24h: 0, prev24h: 0, growthPct: 0 },
      });
    }

    res.json({
      asOf: row.computed_at,
      extrinsics: {
        last24h: row.extrinsics_last24h,
        prev24h: row.extrinsics_prev24h,
        growthPct: row.extrinsics_growth_pct,
      },
      graph: {
        nodes: row.graph_nodes,
        edges: row.graph_edges,
        eOverN: row.graph_e_over_n,
        newWalletsRatio: row.new_wallets_ratio,
      },
      activeWallets: {
        last24h: row.active_wallets_last24h,
        prev24h: row.active_wallets_prev24h,
        growthPct: row.active_wallets_growth_pct,
      },
    });
  } catch (err) {
    console.error('Error in /v1/metrics/growth24h:', err);
    res.status(500).json({ error: 'internal', message: 'Failed to fetch metrics' });
  }
});

// GET /v1/sparklines/extrinsics
app.get('/v1/sparklines/extrinsics', (req: Request, res: Response) => {
  try {
    const hours = Math.min(168, Math.max(1, Number(req.query.hours) || 24));
    const rows = queryAll(
      `SELECT ts_hour, extrinsics_count FROM hourly_buckets ORDER BY ts_hour DESC LIMIT ?`,
      [hours]
    );

    const series = rows.reverse().map((r) => ({
      ts: r.ts_hour as string,
      extrinsics: r.extrinsics_count as number,
    }));

    res.json({ hours, series });
  } catch (err) {
    console.error('Error in /v1/sparklines/extrinsics:', err);
    res.status(500).json({ error: 'internal', message: 'Failed to fetch sparkline' });
  }
});

// GET /v1/sparklines/active-wallets
app.get('/v1/sparklines/active-wallets', (req: Request, res: Response) => {
  try {
    const hours = Math.min(168, Math.max(1, Number(req.query.hours) || 24));
    const rows = queryAll(
      `SELECT ts_hour, active_wallets, new_wallets FROM hourly_buckets ORDER BY ts_hour DESC LIMIT ?`,
      [hours]
    );

    const series = rows.reverse().map((r) => ({
      ts: r.ts_hour as string,
      active: r.active_wallets as number,
      new: r.new_wallets as number,
    }));

    res.json({ hours, series });
  } catch (err) {
    console.error('Error in /v1/sparklines/active-wallets:', err);
    res.status(500).json({ error: 'internal', message: 'Failed to fetch sparkline' });
  }
});

// GET /v1/sparklines/active-wallets-daily (monthly view)
app.get('/v1/sparklines/active-wallets-daily', (req: Request, res: Response) => {
  try {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 30));
    const rows = queryAll(
      `SELECT ts_day, active_wallets, new_wallets FROM daily_buckets ORDER BY ts_day DESC LIMIT ?`,
      [days]
    );

    const series = rows.reverse().map((r) => ({
      ts: r.ts_day as string,
      active: r.active_wallets as number,
      new: r.new_wallets as number,
    }));

    res.json({ days, series });
  } catch (err) {
    console.error('Error in /v1/sparklines/active-wallets-daily:', err);
    res.status(500).json({ error: 'internal', message: 'Failed to fetch daily sparkline' });
  }
});

// GET /v1/sparklines/extrinsics-daily (monthly view)
app.get('/v1/sparklines/extrinsics-daily', (req: Request, res: Response) => {
  try {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 30));
    const rows = queryAll(
      `SELECT ts_day, extrinsics_count FROM daily_buckets ORDER BY ts_day DESC LIMIT ?`,
      [days]
    );

    const series = rows.reverse().map((r) => ({
      ts: r.ts_day as string,
      extrinsics: r.extrinsics_count as number,
    }));

    res.json({ days, series });
  } catch (err) {
    console.error('Error in /v1/sparklines/extrinsics-daily:', err);
    res.status(500).json({ error: 'internal', message: 'Failed to fetch daily extrinsics sparkline' });
  }
});

// GET /v1/top-entities
app.get('/v1/top-entities', (req: Request, res: Response) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const metric = String(req.query.metric || 'total_degree');

    const orderCol: Record<string, string> = {
      in_degree: 'degree_in',
      out_degree: 'degree_out',
      total_degree: '(degree_in + degree_out)',
      pagerank: 'pagerank',
    };
    const order = orderCol[metric] || '(degree_in + degree_out)';

    const rows = queryAll(
      `SELECT account, degree_in, degree_out, weight_sum, pagerank FROM top_entities ORDER BY ${order} DESC LIMIT ?`,
      [limit]
    );

    const items = rows.map((r, i) => ({
      account: r.account as string,
      rank: i + 1,
      degreeIn: r.degree_in as number,
      degreeOut: r.degree_out as number,
      weightSum: r.weight_sum as number,
      pagerank: r.pagerank as number,
    }));

    res.json({
      asOf: new Date().toISOString(),
      metric,
      items,
    });
  } catch (err) {
    console.error('Error in /v1/top-entities:', err);
    res.status(500).json({ error: 'internal', message: 'Failed to fetch top entities' });
  }
});

// Start server after DB init
async function main() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`Aggregator API running on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

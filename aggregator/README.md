# Reef Aggregator

Pre-aggregated metrics API for Reef Explorer dashboard.

## Features

- **Active Wallets (24h)**: Distinct wallet count with growth vs previous 24h
- **Extrinsics Count**: Hourly bucketed for sparklines
- **Graph Metrics**: Nodes, edges, average degree (E/N)
- **New Wallets Ratio**: First-seen wallets in last 24h

## Quick Start

```bash
# Install dependencies
cd aggregator
pnpm install

# Run cron job to populate database (first time)
pnpm cron

# Start API server
pnpm dev
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /v1/metrics/growth24h` | 24h growth metrics (extrinsics, active wallets, graph) |
| `GET /v1/sparklines/extrinsics?hours=24` | Hourly extrinsics counts |
| `GET /v1/sparklines/active-wallets?hours=24` | Hourly active/new wallet counts |
| `GET /v1/top-entities?limit=20&metric=total_degree` | Top accounts by centrality |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | API server port |
| `DB_PATH` | `./data/aggregator.db` | SQLite database path |

## Production Setup

1. Schedule cron job every 5-15 minutes:
   ```bash
   */10 * * * * cd /path/to/aggregator && pnpm cron >> /var/log/aggregator.log 2>&1
   ```

2. Run API server with PM2 or systemd:
   ```bash
   pnpm build
   pm2 start dist/index.js --name reef-aggregator
   ```

3. Set `VITE_AGGREGATOR_URL` in frontend:
   ```bash
   VITE_AGGREGATOR_URL=http://localhost:3001
   ```

## Database Schema

- `hourly_buckets` - Time-series data per hour
- `growth_24h` - Snapshot of 24h growth metrics
- `top_entities` - Ranked accounts by degree/PageRank
- `wallet_first_seen` - First-seen timestamps for new wallet detection

## OpenAPI Spec

See `../docs/aggregator-api.yaml` for full API specification.

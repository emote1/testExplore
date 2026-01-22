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

   **Windows Task Scheduler (cron:icp every 4 hours)**

   The repo includes a helper script:
   `aggregator/run-cron-icp.cmd`

   Commands:
   ```bat
   schtasks /Query /TN "Reef Cron ICP"
   schtasks /Run /TN "Reef Cron ICP"
   schtasks /End /TN "Reef Cron ICP"
   schtasks /Delete /TN "Reef Cron ICP" /F
   ```

   **ICP canister commands (mainnet)**

   Canister: `reef_metrics_onchain` (`ndhxz-raaaa-aaaag-avdoa-cai`)

   ```bash
   # Status
   dfx canister --network ic status reef_metrics_onchain

   # Read JSON payloads
   dfx canister --network ic call reef_metrics_onchain get_active_wallets_daily
   dfx canister --network ic call reef_metrics_onchain get_new_wallets_inflow

   # Set logical owner (run as current owner)
   dfx canister --network ic call reef_metrics_onchain set_owner '(principal "iy46i-qmw5w-rekft-irzxz-qtg3w-exghw-ywunj-cx2w3-sw2k5-woqz6-mae")'
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

# CLAUDE.md — Reef Explorer

## What is this project?

**Reef Explorer** is a full-stack blockchain explorer for Reef Chain. It consists of:

1. **Frontend** — React 18 + TypeScript SPA (Vite) at `/src/`
2. **Indexer** — Node.js service that parses Reef Chain blocks into PostgreSQL at `/docker/indexer/`
3. **Aggregator** — Express.js metrics API with SQLite at `/aggregator/`
4. **ICP Canister** — Rust WASM canister on Internet Computer storing daily snapshots at `/icp-onchain/`
5. **Docker stack** — PostgreSQL 16 + Hasura v2.40.0 + Indexer at `/docker/`

## Architecture overview

```
Reef Chain RPC (wss://rpc.reefscan.info/ws)
       │
       ▼
 ┌──────────┐     ┌────────────┐     ┌─────────┐
 │  Indexer  │────▶│ PostgreSQL │◀────│ Hasura  │ (port 8080)
 └──────────┘     └────────────┘     └────┬────┘
                                          │ GraphQL
                    ┌─────────────────────┼─────────────────┐
                    ▼                     ▼                  ▼
              ┌──────────┐         ┌──────────┐       ┌──────────┐
              │ Frontend │         │Aggregator│       │ Subsquid │
              │ (Vite)   │         │ (cron)   │       │  (alt)   │
              └──────────┘         └────┬─────┘       └──────────┘
                                        │
                                   ┌────▼─────┐
                                   │ICP Canist│
                                   └──────────┘
```

The frontend talks to Hasura (via `/api/reef-explorer` proxy) or Subsquid directly. The Hasura admin secret is **never** exposed to browser code — it flows through a server-side proxy (Vite dev proxy or Render/nginx in production).

## Quick commands

```bash
npm run dev          # Vite dev server (frontend)
npm run build        # Codegen + TypeScript + Vite production build
npm run codegen      # Regenerate GraphQL types from Subsquid schema
npm run test:unit    # Vitest unit tests
npm run test:e2e     # Playwright end-to-end tests

# Aggregator (separate package in /aggregator/)
cd aggregator && npm run dev    # Express API on port 3001
cd aggregator && npm run cron   # Run metrics aggregation once
cd aggregator && npm run cron:icp  # Push daily snapshot to ICP canister
```

## Tech stack

| Layer | Technology |
|-------|-----------|
| UI framework | React 18, TypeScript |
| Build tool | Vite 5, Rollup |
| GraphQL | Apollo Client (HTTP + WebSocket subscriptions) |
| Data fetching | Apollo + TanStack React Query (external APIs) |
| Tables | TanStack Table v8 (virtualized) |
| State | Zustand (filters only), Apollo Cache (GraphQL), React Query (prices/NFTs) |
| Styling | Tailwind CSS, Radix UI primitives, Shadcn UI, Lucide icons |
| Charts | Recharts |
| Blockchain | @polkadot/api 13.2.1 (pinned), @reef-chain/util-lib |
| Testing | Vitest + React Testing Library, Playwright (E2E) |
| Backend | Express.js (aggregator), Node.js (indexer), PostgreSQL 16, Hasura v2.40.0 |
| ICP | Rust canister (reef_metrics_onchain), dfx SDK |

## Project structure

```
/
├── src/                      # Frontend React app
│   ├── components/           # UI components (50+ files)
│   │   ├── ui/               # Reusable primitives (button, badge, input, tooltip, skeleton)
│   │   ├── media/            # NFT media viewers (video, IPFS)
│   │   ├── HomeLanding.tsx   # Home page with search + stats dashboard
│   │   ├── TransactionHistoryWithBlocks.tsx  # Main wallet page (tabs: tx/balances/nfts/staking)
│   │   ├── TransactionTableWithTanStack.tsx  # Paginated transaction table
│   │   ├── NftGallery.tsx    # NFT grid with lazy loading
│   │   ├── NetworkStatistics.tsx  # Dashboard widgets (TPS, blocks, wallets)
│   │   └── Navigation.tsx    # Top navbar with wallet connection
│   ├── hooks/                # 45+ custom hooks
│   │   ├── useTanstackTransactionAdapter.ts  # Core: pagination + filtering for TanStack Table
│   │   ├── use-transaction-data-with-blocks.ts  # Apollo transfer queries
│   │   ├── use-sqwid-nfts.ts # NFT metadata fetching
│   │   ├── use-address-resolver.ts  # EVM ↔ Substrate address conversion
│   │   ├── use-reef-extension.ts    # Reef browser wallet
│   │   └── use-mobile-walletconnect.ts  # WalletConnect mobile
│   ├── data/                 # GraphQL queries + data transformers
│   │   ├── transfers.ts      # Transfer/transaction queries (Hasura + Subsquid variants)
│   │   ├── transfer-mapper.ts # Maps GraphQL → UiTransfer (swap aggregation, dedup)
│   │   ├── nfts.ts           # NFT queries
│   │   ├── staking.ts        # Staking reward queries
│   │   └── aggregator-client.ts  # REST calls to aggregator API
│   ├── gql/                  # Auto-generated GraphQL types (codegen output)
│   ├── stores/               # Zustand: only use-transaction-filter-store.ts
│   ├── constants/            # Pagination config, Reefscan URL
│   ├── utils/                # Helpers (address, formatting, IPFS, ABI, LRU cache)
│   ├── tokens/               # Token ID config (USDC, MRD)
│   ├── apollo-client.ts      # Apollo setup: HTTP + WS links, cache merge policies
│   ├── reef-explorer-client.ts  # Hasura/Explorer GraphQL endpoint config
│   ├── reef-swap-client.ts   # ReefSwap DEX client
│   ├── App.tsx               # Root: ApolloProvider, page routing (search | wallet)
│   └── main.tsx              # Entry: React Query setup, render
├── aggregator/               # Metrics aggregation service
│   ├── src/index.ts          # Express API (port 3001): /v1/metrics, /v1/staking, /v1/sparklines
│   ├── src/cron.ts           # Subsquid cron: wallet activity, extrinsics, graph metrics
│   ├── src/cron-icp.ts       # ICP cron: push daily snapshots to canister
│   ├── src/db.ts             # SQLite (sql.js) with hourly/daily buckets
│   └── src/staking-summary.ts # Validator staking: APY, commission, total staked
├── docker/                   # Production Docker stack
│   ├── docker-compose.prod.yml  # PostgreSQL 16 + Hasura v2.40 + Indexer
│   ├── indexer/src/          # Block indexer (Polkadot.js → PostgreSQL)
│   │   ├── index.ts          # Main loop: forward + backfill, icon enrichment
│   │   ├── parser.ts         # Block parser: transfers, staking, ERC20/721/1155, swaps
│   │   └── db.ts             # PostgreSQL operations: upsert accounts, transfers, tokens
│   └── migrations/           # SQL migration scripts
├── icp-onchain/              # Internet Computer canister (Rust)
├── icp-assets/               # ICP asset canister config
├── .github/workflows/        # CI: cron-icp.yml (every 4h, pushes to ICP)
├── vite.config.ts            # Vite: proxies, PWA, manual chunks, Polkadot dedupe
├── codegen.ts                # GraphQL codegen config (Subsquid schema → src/gql/)
└── tailwind.config.js        # Tailwind CSS config
```

## Key entities displayed

- **Blocks** — height, timestamp, extrinsics count, processor sync status
- **Transfers** — native REEF + ERC20; direction (in/out), amounts, token metadata
- **Swaps** — two-leg transfers aggregated (sold → bought), detected by reefswapAction
- **Staking** — validator rewards, era info, APY, commission rates
- **NFTs** — ERC721/ERC1155, Sqwid metadata, IPFS media with gateway failover
- **Tokens** — REEF, USDC, MRD, custom ERC20; balances, USD prices (CoinGecko)
- **Validators** — identity, total stake, commission, annual yield

## Data flow

1. User enters address (EVM `0x...` or Substrate `5...`) or connects wallet
2. `use-address-resolver` converts between EVM ↔ Substrate via GraphQL
3. `useTanstackTransactionAdapter` orchestrates pagination/filtering:
   - Calls `use-transaction-data-with-blocks` → Apollo query to Hasura/Subsquid
   - `transfer-mapper.ts` deduplicates, aggregates swaps, enriches token metadata
   - Zustand filter store persists filter state to localStorage
4. Components render via TanStack Table (virtualized) / Recharts (charts)
5. Real-time: WebSocket subscription for new transfers (prepend to cache)

## Routing

No React Router. Simple state: `currentPage: 'search' | 'wallet'` in `App.tsx`. Search → sets address → switches to wallet page. `TransactionHistoryWithBlocks` is keyed by address for full remount on address change.

## Environment variables

### Frontend (VITE_ prefix = exposed to browser)
- `VITE_REEF_EXPLORER_HTTP_URL` — GraphQL endpoint (default: Subsquid)
- `VITE_REEF_EXPLORER_WS_URL` — WebSocket endpoint (auto-derived from HTTP)
- `VITE_REEF_EXPLORER_BACKEND` — `hasura` or `subsquid` (affects query format)
- `VITE_REEF_EVM_RPC_URL` — EVM RPC for tokenURI calls (default: rpc.reefscan.com)
- `VITE_REEFSCAN_ORIGIN` — External link base URL
- `VITE_COINGECKO_API_KEY` / `VITE_COINGECKO_DEMO_KEY` — Price API keys
- `VITE_IPFS_GATEWAYS` — Comma-separated IPFS gateways (failover order)

### Server-side (NOT in browser bundle)
- `REEF_EXPLORER_PROXY_TARGET` — Hasura URL for Vite dev proxy
- `REEF_EXPLORER_ADMIN_SECRET` — Hasura admin secret (injected by proxy)
- `STAKING_SUMMARY_PROXY_TARGET` — Aggregator staking endpoint

### Docker/Indexer
- `RPC_URL` — Reef Chain WebSocket RPC
- `PG_HOST`, `PG_PORT`, `PG_DB`, `PG_USER`, `PG_PASS` — PostgreSQL
- `BACKFILL=true/false`, `BACKFILL_TARGET` — Reverse indexing mode
- `BATCH_SIZE`, `POLL_INTERVAL_MS` — Indexer performance tuning

## GraphQL codegen

Types auto-generated from Subsquid schema. Config in `codegen.ts`. Output in `src/gql/`. Run `npm run codegen` to regenerate. Automatically runs before `npm run build`.

## Deployment

- **Frontend**: Deployed to Render (or Vercel). Branch `render-deploy` is the deploy branch.
- **Backend**: Docker stack on Hetzner server (89.167.60.159) — PostgreSQL + Hasura + Indexer
- **Aggregator**: Runs on the same server or locally
- **ICP cron**: GitHub Actions (every 4h) or Windows Task Scheduler

## Code conventions

- Path alias: `@/` maps to `src/` (configured in vite.config.ts)
- GraphQL queries: defined in `src/data/*.ts` using `graphql` tagged template literal
- Hooks: one hook per file in `src/hooks/`, prefixed with `use-`
- UI components: in `src/components/ui/`, follow Shadcn/Radix patterns
- Polkadot packages pinned to 13.2.1 via overrides in package.json (critical for compatibility)
- Manual chunks in Vite for code splitting: react-vendor, apollo-vendor, tanstack-vendor, polkadot-vendor, ui-vendor, state-vendor

## Important notes

- **Never expose Hasura admin secret to frontend.** All Hasura access goes through server-side proxy.
- **Polkadot version pinning is critical.** The `overrides` block in package.json ensures a single @polkadot/api version. Changing it can break runtime.
- **Transfer deduplication** — Native and ERC20 transfer pairs from the same extrinsic are deduplicated in `transfer-mapper.ts` (grouped by extrinsic + amount).
- **Apollo cache merge policy** in `apollo-client.ts` handles cursor-based pagination with prepend/dedupe for first page and append for subsequent pages.
- **The frontend supports two backends**: Subsquid (default, public) and Hasura (self-hosted). Query format adapts based on `VITE_REEF_EXPLORER_BACKEND`.
- **Token icon enrichment**: The indexer downloads IPFS token icons via Reefscan API and stores them locally.

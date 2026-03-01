# Reef Explorer — Architecture Overview

Документ описывает архитектуру проекта Reef Explorer: структуру, потоки данных, взаимодействие с backend (Hasura/Subsquid), Docker стек и рекомендации по разработке.

**Последнее обновление:** 2026-03-01

---

## 📂 Структура проекта

```
testExplore/
├── 📌 src/                          # Frontend (React + Vite)
│   ├── main.tsx                     # Entry point, Apollo Client setup
│   ├── App.tsx                      # Main component, routing
│   ├── apollo-client.ts             # Apollo Client config (HTTP + WS)
│   ├── reef-explorer-client.ts      # HTTP-only explorer client
│   ├── reef-swap-client.ts          # Reefswap GraphQL client
│   │
│   ├── 📂 components/               # React компоненты (38 файлов)
│   │   ├── NetworkStatistics.tsx    # Dashboard: blocks/min, staking, wallets
│   │   ├── TransactionHistoryWithBlocks.tsx  # Wallet page: tabs + transactions
│   │   ├── TransactionTableWithTanStack.tsx  # TanStack Table component
│   │   ├── BalancesTable.tsx        # Holdings tab: token balances
│   │   ├── NftGallery.tsx           # NFTs tab: collections + items
│   │   ├── StakingTable.tsx         # Staking rewards table
│   │   ├── RewardsChart.tsx         # Staking rewards chart
│   │   ├── TpsSparkline.tsx         # Live sparkline for blocks/min
│   │   └── ui/                      # Shadcn UI components
│   │
│   ├── 📂 hooks/                    # Custom hooks (44 файла)
│   │   ├── use-tps-live.ts          # Blocks/min live subscription
│   │   ├── use-total-staked.ts      # Total staked + validators
│   │   ├── use-active-wallets-24h-icp.ts  # Active wallets from ICP
│   │   ├── use-new-wallets-inflow-icp.ts  # New wallets from ICP
│   │   ├── use-transaction-data-with-blocks.ts  # Paginated transfers
│   │   ├── useTransferSubscription.ts     # Real-time transfer polling
│   │   ├── use-token-balances.ts    # Token holdings query
│   │   ├── use-token-usd-prices.ts  # Token prices via Reefswap
│   │   ├── use-address-resolver.ts  # EVM ↔ Native address resolution
│   │   ├── use-sqwid-nfts.ts        # NFT metadata fetching
│   │   └── validator-meta.ts        # Validator names + commissions
│   │
│   ├── 📂 data/                     # GraphQL queries + mappers (16 файлов)
│   │   ├── transfers.ts             # Transfer queries (Subsquid + Hasura)
│   │   ├── transfer-mapper.ts       # Raw → UiTransfer mapping
│   │   ├── balances.ts              # Token holder queries
│   │   ├── staking.ts               # Staking queries
│   │   ├── nfts.ts                  # NFT queries
│   │   ├── addresses.ts             # Account resolution queries
│   │   ├── icp-client.ts            # ICP canister fetch
│   │   └── ttl-cache.ts             # TTL cache with localStorage
│   │
│   ├── 📂 utils/                    # Helpers (19 файлов)
│   │   ├── transfer-query.ts        # isHasuraExplorerMode, where builders
│   │   ├── formatters.ts            # Amount, date, hash formatting
│   │   ├── token-helpers.ts         # Token metadata parsing
│   │   ├── address-helpers.ts       # Address validation
│   │   └── ipfs.ts                  # IPFS URL normalization
│   │
│   ├── 📂 stores/                   # Zustand stores
│   │   └── use-transaction-filter-store.ts  # Filter state persistence
│   │
│   └── 📂 gql/                      # GraphQL codegen output
│       └── graphql.ts               # Generated types (DO NOT EDIT)
│
├── 📂 docker/                       # Backend stack
│   ├── docker-compose.yml           # Dev stack (postgres + hasura + pgadmin + indexer)
│   ├── docker-compose.prod.yml      # Production stack
│   ├── init.sql                     # PostgreSQL schema (12 tables)
│   ├── seed.sql                     # Test data
│   ├── 📂 indexer/                  # TypeScript indexer
│   │   └── src/
│   │       ├── index.ts             # Main loop (forward + backfill)
│   │       ├── parser.ts            # Block parsing (transfers, extrinsics, NFTs)
│   │       └── db.ts                # PostgreSQL client + batch insert
│   └── README.md                    # Docker documentation
│
├── 📂 tests/                        # Test suites
│   └── e2e/                         # Playwright E2E tests
│
└── 📂 icp-onchain/                  # ICP canister (Rust)
    └── ICP-SETUP.md                 # ICP deployment docs
```

---

## 🏗️ Архитектура системы

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Vite + React)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Dashboard   │  │ Wallet Page │  │ NFT Gallery │  │ Staking Charts      │ │
│  │ (blocks/min)│  │ (transfers) │  │ (Sqwid API) │  │ (rewards history)   │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                │                     │           │
│         └────────────────┴────────────────┴─────────────────────┘           │
│                                    │                                        │
│                          Apollo Client (HTTP + WS)                          │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
          ┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐
          │ Hasura GraphQL  │ │ Subsquid    │ │ ICP Canister    │
          │ (localhost:8080)│ │ (squid.io)  │ │ (icp0.io)       │
          │ - transfers     │ │ - fallback  │ │ - active wallets│
          │ - blocks        │ │ - staking   │ │ - new wallets   │
          │ - token_holder  │ │ - swaps     │ │                 │
          └────────┬────────┘ └─────────────┘ └─────────────────┘
                   │
          ┌────────┴────────┐
          │   PostgreSQL    │
          │ (reef_explorer) │
          └────────┬────────┘
                   │
          ┌────────┴────────┐
          │    Indexer      │
          │  (TypeScript)   │
          └────────┬────────┘
                   │
          ┌────────┴────────┐
          │  Reef Chain RPC │
          │ (wss://rpc...)  │
          └─────────────────┘
```

---

## 🌊 Потоки данных

### 1. Dashboard (NetworkStatistics)

| Метрика | Источник | Хук | Обновление |
|---------|----------|-----|------------|
| Blocks/min (Live) | Hasura subscription | `use-tps-live.ts` | Real-time (WS) |
| Total Staked | Subsquid | `use-total-staked.ts` | 5 мин |
| Validators | Subsquid + RPC | `validator-meta.ts` | 30 мин cache |
| Active Wallets (24h) | ICP canister | `use-active-wallets-24h-icp.ts` | 4ч (cron) |
| New Wallets Inflow | ICP canister | `use-new-wallets-inflow-icp.ts` | 4ч (cron) |
| REEF Price | CoinGecko | `use-reef-price.ts` | 5 мин |

### 2. Wallet Page (Transactions)

```
User enters address
        ↓
use-address-resolver.ts (EVM → Native)
        ↓
use-transaction-data-with-blocks.ts
        ↓ PAGINATED_TRANSFERS_QUERY
Hasura/Subsquid → transfer[]
        ↓
transfer-mapper.ts → UiTransfer[]
        ↓
useTanstackTransactionAdapter.ts
        ↓
TransactionTableWithTanStack.tsx
```

**Real-time updates:**
- `useTransferSubscription.ts` — polling каждые 5 сек
- При новых transfers → prepend в Apollo cache

### 3. Holdings Tab

```
use-token-balances.ts
        ↓ TOKEN_HOLDERS_PAGED_QUERY
Hasura → token_holder[]
        ↓
use-token-icons.ts (batch query)
        ↓
use-token-usd-prices.ts
        ↓ poolsReserves (Reefswap Squid)
BalancesTable.tsx
```

### 4. NFTs Tab

```
use-sqwid-collections-by-owner.ts
        ↓ Sqwid REST API
Collections grid
        ↓ (user clicks collection)
use-sqwid-collection.ts
        ↓
use-sqwid-nfts.ts (metadata fetch)
        ↓
NftGallery.tsx
```

---

## 🗄️ База данных (PostgreSQL + Hasura)

### Основные таблицы

| Таблица | Описание | Индексы |
|---------|----------|---------|
| `account` | Аккаунты (SS58 + EVM) | `evm_address`, `active` |
| `verified_contract` | Контракты (ERC20/721/1155) | `type`, `name` (trigram) |
| `transfer` | Все переводы | `from_id`, `to_id`, `timestamp`, `token_id`, `amount` |
| `token_holder` | Балансы токенов | `signer_id`, `token_id`, `balance` |
| `block` | Блоки | `height`, `timestamp` |
| `extrinsic` | Транзакции | `signer_id`, `method`, `section` |
| `event` | События | `section`, `method` |
| `staking` | Стейкинг события | `signer_id`, `type`, `era` |
| `era_validator_info` | Валидаторы по эрам | `era`, `address`, `total` |
| `nft_metadata` | NFT метаданные | `contract_id`, `owner_id` |
| `contract_call` | Вызовы контрактов | `from_id`, `to_id` |
| `indexer_cursor` | Курсор индексера | — |

### Hasura vs Subsquid синтаксис

| Аспект | Subsquid | Hasura |
|--------|----------|--------|
| Root field | `transfersConnection` | `transfer` |
| Pagination | `first/after` (cursor) | `limit/offset` |
| Filters | `{ from: { id_eq: $x } }` | `{ from_id: { _eq: $x } }` |
| Order | `orderBy: [timestamp_DESC]` | `order_by: [{ timestamp: desc }]` |
| Count | `totalCount` | `aggregate { count }` |
| Field names | camelCase | snake_case |

**Runtime switch:** `isHasuraExplorerMode` в `src/utils/transfer-query.ts`

---

## 🐳 Docker Stack

### Сервисы

| Сервис | Порт | Описание |
|--------|------|----------|
| `postgres` | 5432 | PostgreSQL 16 |
| `hasura` | 8080 | GraphQL Engine + Console |
| `pgadmin` | 5050 | Database admin (dev only) |
| `indexer` | — | TypeScript indexer |

### Команды

```bash
# Запуск
cd docker && docker-compose up -d

# Логи индексера
docker-compose logs -f indexer

# SQL запрос
docker exec docker-postgres-1 psql -U reef -d reef_explorer -c "SELECT COUNT(*) FROM transfer;"

# Пересборка индексера
docker-compose up -d --build indexer

# Полная очистка
docker-compose down -v
```

### Environment Variables (indexer)

```env
PG_HOST=postgres
PG_PORT=5432
PG_DB=reef_explorer
PG_USER=reef
PG_PASS=reef_local
RPC_URL=wss://rpc.reefscan.info/ws
START_BLOCK=12834548
BATCH_SIZE=100
CONCURRENCY=10
BACKFILL=true
BACKFILL_TARGET=7834548
```

---

## 🔄 Indexer: что индексируется

| Источник | Таблица | Режим |
|----------|---------|-------|
| `balances.Transfer` | `transfer` (Native) | forward + backfill |
| `evm.Log` (Transfer) | `transfer` (ERC20/NFT) | forward + backfill |
| `evm.Log` (Swap) | `transfer.reefswap_action` | forward + backfill |
| Block headers | `block` | forward + backfill |
| Extrinsics | `extrinsic` | **forward only** |
| Token holders | `token_holder` (upsert) | forward + backfill |
| Accounts | `account` (upsert) | forward + backfill |
| Contracts | `verified_contract` | forward + backfill |

**Inherent extrinsics** (`timestamp`, `parachainSystem`, `authorship`) пропускаются.

---

## ⚡ Оптимизации

### Frontend

1. **Tabs stay mounted** — вкладки не ремаунтятся при переключении
2. **Polling pause** — polling останавливается на неактивных вкладках
3. **Cache-first** — Apollo использует `cache-first` для transfers
4. **Price cache** — TTL 5 минут для цен токенов
5. **Fallback limit** — максимум 5 fallback запросов для цен

### Indexer

1. **Batch insert** — вставка блоками по 100
2. **Parallel processing** — `CONCURRENCY=10` параллельных блоков
3. **Skip extrinsics in backfill** — экономия места
4. **Cursor persistence** — продолжение после restart

---

## 🧪 Тестирование

### Unit (Vitest)

```bash
npm run test:unit
npm run test:unit:watch
```

### E2E (Playwright)

```bash
npm run test:e2e
npm run test:e2e:ui
npm run test:e2e:headed
```

**Стабилизация:** `data-testid`, `waitForLoadState`, `waitForResponse`

---

## 🧭 Конвенции

- **TypeScript:** интерфейсы > типы, избегать enum
- **React:** функциональные компоненты, минимум useEffect
- **Стили:** Tailwind + shadcn/ui, утилита `cn`
- **GraphQL:** dual docs (Subsquid + Hasura) через `parse()`
- **Тесты:** только `data-testid` для E2E селекторов

---

## ✅ Стандарты перед каждым изменением

Перед каждым изменением кода необходимо проверить:

### 1. Компиляция
```bash
npx tsc --noEmit
```
- Исправить все TypeScript ошибки

### 2. Линтинг
```bash
npm run lint
```
- Исправить все предупреждения

### 3. Сборка
```bash
npm run build
```
- Убедиться что билд проходит без ошибок

### 4. Codegen (если менялись GraphQL запросы)
```bash
npm run codegen
```
- Обновить типы в `src/gql/graphql.ts`


---

## 📋 Шаблон progress.md

```markdown
<!-- Don't remove the comments -->
<!-- This file is used to track progress on the project. File uses a strict formatting and template policy:

1. # Next steps section: Always on top, contains a phased plan as a list of tasks to be completed. Formatting:

# Next steps

## Phased plan name

**Goal:**

### Phase 1 name

**Problem:**

**Solution:**

- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

### Phase 2 name

**Problem:**

**Solution:**

- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

etc.

2. # Completed tasks section: Always after the # Next steps section, contains a list of tasks that have been completed. Simply a copy/pasted content of the next steps upon completion of the task. -->


<!-- (# Next steps) Start of the next phased plan -->
```

---

## 📝 TODO

- [ ] Создать агрегатор Active Wallets на Hasura вместо ICP/Subsquid
- [ ] Добавить Unit тесты для хуков


# Changelog

## 2026-03-20

### 🏦 Staking Summary: перенос расчёта Total Staked / APY на backend aggregator
**Файлы:** `aggregator/src/staking-summary.ts`, `aggregator/src/index.ts`, `aggregator/package.json`, `src/hooks/use-total-staked.ts`

- **Что изменено в архитектуре:** тяжёлый расчёт `Total Staked` и `APY` вынесен из фронтенда в `aggregator`. Вместо множества клиентских GraphQL/RPC запросов фронт теперь может получать один готовый JSON с сервера по `GET /v1/staking/summary`.
- **Почему это лучше:** меньше запросов из браузера, быстрее рендер блока Network Statistics, меньше вероятность rate limit / timeout, логика расчёта централизована в одном backend месте.
- **Как работает backend endpoint:**
  - читает актуальные валидаторы из Hasura таблицы `era_validator_info`
  - читает окно reward-событий из Hasura таблицы `staking` (`type = Reward`)
  - читает `total issuance` из Reef RPC через `state_getStorage`
  - батчем читает `Identity.IdentityOf` и `Staking.Validators` из RPC для имён и комиссий валидаторов
  - собирает итоговый ответ: `era`, `totalStakedRaw`, `totalStakedReef`, `totalSupply`, `stakedPct`, `validatorCount`, `apy`, `validators[]`
- **Кэширование на backend:**
  - итоговый staking summary кэшируется по `era`
  - metadata валидаторов кэшируется на 30 минут
  - total issuance кэшируется на 5 минут
  - пока era не изменилась, фронт получает уже готовый cached результат
- **Как работает фронтенд после изменения:** `src/hooks/use-total-staked.ts` сначала пытается забрать серверный staking summary URL, а при ошибке может откатиться на прежнюю клиентскую логику как fallback.

### 🌐 Рекомендуемый способ публикации endpoint
- **Лучший вариант:** проксировать `aggregator` через существующий nginx на том же домене, а не открывать порт `3001` наружу напрямую.
- **Почему это лучший вариант:**
  - один публичный вход через nginx
  - не нужно светить внутренний порт `3001`
  - проще CORS / TLS / firewall
  - у фронтенда будет стабильный путь вида `/api/staking-summary`
- **Рекомендуемая схема:**
```
Browser
  -> nginx/public domain
  -> /api/staking-summary
  -> http://127.0.0.1:3001/v1/staking/summary
```
- **Рекомендуемое значение для фронта:** `VITE_STAKING_SUMMARY_URL=/api/staking-summary`

### ⚙️ Серверные env для aggregator
```env
REEF_EXPLORER_HTTP_URL=http://<hasura-host>:8080/v1/graphql
REEF_EXPLORER_BACKEND=hasura
REEF_EXPLORER_ADMIN_SECRET=<HASURA_GRAPHQL_ADMIN_SECRET>
REEF_RPC_URL=https://rpc.reefscan.info
```

- `REEF_EXPLORER_HTTP_URL` — GraphQL endpoint Hasura
- `REEF_EXPLORER_BACKEND=hasura` — включает Hasura-совместимые GraphQL запросы в `aggregator`
- `REEF_EXPLORER_ADMIN_SECRET` — нужен для доступа к Hasura
- `REEF_RPC_URL` — Reef RPC для issuance / identity / commission

### 🖥️ Как это работает на сервере
- `pm2` запускает процесс `reef-aggregator` из `aggregator/dist/index.js`
- Hasura secret берётся из защищённого server-side `.env` файла и экспортируется в окружение процесса
- после `export` переменные попадают в `pm2 env`
- endpoint локально проверяется через:
```bash
curl http://127.0.0.1:3001/v1/staking/summary
```
- снаружи endpoint лучше отдавать через nginx reverse proxy, а не через прямой доступ к `:3001`

### 🔧 Что пришлось исправить во время серверного запуска
- **Причина первого зависания:** `aggregator` был запущен без нужных `REEF_*` / `HASURA_*` env, поэтому не мог корректно ходить в Hasura/RPC.
- **Причина пустого ответа (`era: null`, `validatorCount: 0`):** парсер backend слишком строго ожидал строковые bigint-поля, а Hasura возвращала `numeric` значения не только как `string`, но и как JSON `number`.
- **Причина ошибки `500`:** некоторые большие значения из Hasura приходили в scientific notation, например `2.5884979171338786e+26`, что ломало прямой `BigInt(...)`.
- **Фикс:** backend нормализует такие значения в обычную целую строку перед вычислениями.

### ✅ Проверено на сервере
Фактический ответ `/v1/staking/summary` после фикса:

- `era = 1763`
- `totalStakedReef = 6512701048.6189`
- `totalSupply = 35616006210`
- `stakedPct = 18.285882505238085`
- `validatorCount = 23`
- `apy = 92.6511988094629`
- в `validators[]` приходят имена, комиссии, stake и индивидуальный APY валидаторов

### 🚀 Минимальный server update workflow
```bash
cd /path/to/project
git pull origin render-deploy
npm --prefix aggregator run build
pm2 restart reef-aggregator --update-env
curl -v --max-time 30 http://127.0.0.1:3001/v1/staking/summary
```

### ✅ Финальный статус после настройки proxy и локального dev
- **Что подтверждено на сервере:**
  - `GET /v1/staking/summary` на `aggregator` отвечает `200 OK`
  - nginx proxy `GET /api/staking-summary` отвечает `200 OK`
  - UI получает готовый server-side summary с полями `era`, `apy`, `totalStakedReef`, `validatorCount`, `validators[]`
- **Что исправлено в nginx:** proxy для staking summary должен жить в отдельном `location = /api/staking-summary`, а существующий `location /api/reef-explorer` должен оставаться направленным на Hasura GraphQL endpoint
- **Как теперь устроен локальный dev:**
  - `VITE_STAKING_SUMMARY_URL=/api/staking-summary`
  - Vite dev server проксирует `/api/staking-summary` через новые server-only env `STAKING_SUMMARY_PROXY_TARGET` и `STAKING_SUMMARY_PROXY_PATH`
  - это позволяет локально использовать тот же path, что и в production, вместо прямого запроса на `http://localhost:3001`
- **Почему в Network всё ещё могут быть запросы к `/api/reef-explorer`:** это нормально для других частей UI, например для GraphQL-запросов блока `Network Statistics` (`Blocks/min`, live block data и другие Hasura-backed виджеты). Успешный `summary` больше не требует fallback-расчёта APY, если `/api/staking-summary` возвращает `200`.

## 2026-03-17

### 🎬 NFTs: как работает загрузка медиа и что оптимизировано
**Файлы:** `src/data/nfts.ts`, `src/hooks/use-sqwid-nfts-infinite.ts`, `src/hooks/use-sqwid-nfts.ts`, `src/utils/ipfs.ts`, `src/components/NftGallery.tsx`, `src/components/media/nft-video-thumb.tsx`, `src/components/media/nft-media-viewer.tsx`

- **Поток данных NFT:** фронт получает список NFT владельца через Hasura (`token_holder` для `ERC721/ERC1155`), затем по каждой паре `(contract, nftId)` подтягивает метаданные (сначала Sqwid API, fallback на `tokenURI`), нормализует IPFS URL и передаёт их в UI-компоненты галереи/просмотра.
- **Почему было `Video unavailable`:** видео-источник мог помечаться как «навсегда сломанный» после временной ошибки gateway/CDN; это убрано — добавлен временный cooldown и повторные попытки загрузки.
- **IPFS стратегия:** отключён агрессивный multi-gateway fallback в UI-пути, оставлен один рабочий gateway через env (`VITE_IPFS_GATEWAY` / первый из `VITE_IPFS_GATEWAYS`) для снижения числа fail-запросов и таймаутов.
- **Fallback UI для видео:** вместо жёсткой заглушки добавлен безопасный вариант с `<video controls>` и ссылкой `Open media`, чтобы пользователь мог открыть файл напрямую даже при проблемах preview.
- **Оптимизация thumbnail/poster:** если `thumbnail` и `media` указывают на один и тот же CID, poster отключается, чтобы не тянуть тяжёлое видео дважды.
- **Причина медленной первой загрузки (~31s):** cold-load большого IPFS-видео (десятки MB), latency gateway и range-запросы браузера. Повторные запросы после этого — ожидаемое поведение для буферизации/переключения источников.
- **Рекомендация для максимального ускорения:** всегда использовать отдельный лёгкий `jpg/webp` thumbnail CID, а не тот же CID, что у видео.

## 2026-03-01

### 📊 Blocks/min (Live) вместо Tx/min
**Файлы:** `src/hooks/use-tps-live.ts`, `src/components/NetworkStatistics.tsx`

- Заменена метрика "Tx/min (Live)" на "Blocks/min (Live)" для более стабильного отображения активности сети
- Добавлены GraphQL subscriptions `BLOCKS_STREAM` для Subsquid и Hasura
- Хук `useTpsLive` теперь поддерживает `source: 'extrinsics' | 'transfers' | 'blocks'`
- Sparkline показывает историю `perMin` значений вместо per-second spikes для плавной визуализации
- Блоки приходят каждые ~6 сек, метрика показывает ~10-18 blocks/min

### 🔄 Indexer: Extrinsics parsing (forward mode only)
**Файлы:** `docker/indexer/src/db.ts`, `docker/indexer/src/parser.ts`, `docker/indexer/src/index.ts`

- Добавлен интерфейс `ExtrinsicRow` для хранения extrinsics
- Расширен `ParsedBlock` и `BlockData` для включения extrinsics
- Extrinsics записываются в БД только в forward режиме (`skipExtrinsics = direction === -1`)
- Inherent extrinsics (`timestamp`, `parachainSystem`, `authorship`) пропускаются для экономии места
- Поля: id, blockHeight, blockHash, extrinsicIndex, hash, signerId, method, section, signature, nonce, tip, fee, success, errorMessage, timestamp

### ⚡ Holdings tab: оптимизация первой загрузки
**Файлы:** `src/hooks/use-token-usd-prices.ts`, `src/components/BalancesTable.tsx`

- **TTL кэша цен** увеличен с 1 минуты до 5 минут — меньше запросов к Reefswap Squid
- **Fallback запросы** ограничены до 5 токенов максимум — остальные получают `null` цену
- **Loading spinner** добавлен в `BalancesTable` — показывается пока данные загружаются
- Batch запрос `poolsReserves` остаётся для всех токенов, fallback `allPoolsList` только для первых 5 не найденных

### 📝 ICP Aggregator: документация
**Memory:** ICP Data Source for Active Wallets & New Wallets Inflow

- Задокументированы URL для ICP данных:
  - `VITE_ICP_ACTIVE_WALLETS_DAILY_URL` → `https://ndhxz-raaaa-aaaag-avdoa-cai.icp0.io/active-wallets-daily.json`
  - `VITE_ICP_NEW_WALLETS_INFLOW_URL` → `https://ndhxz-raaaa-aaaag-avdoa-cai.icp0.io/new-wallets-inflow.json`
- Архитектура: внешний cron скрипт (не в этом репо) читает из Subsquid → загружает JSON на ICP canister каждые 4ч
- **TODO**: Создать свой агрегатор на Hasura вместо Subsquid

---

## 📚 Техническая документация

### 🗄️ Структура базы данных Hasura

**Основные таблицы:**

| Таблица | Описание | Ключевые поля |
|---------|----------|---------------|
| `account` | Аккаунты Reef Chain | `id` (SS58), `evm_address`, `free_balance`, `locked_balance` |
| `verified_contract` | Верифицированные контракты | `id` (адрес), `name`, `type` (ERC20/ERC721/ERC1155), `contract_data` (metadata) |
| `transfer` | Все переводы (Native + ERC20 + NFT) | `from_id`, `to_id`, `token_id`, `amount`, `timestamp`, `reefswap_action` |
| `token_holder` | Балансы токенов по аккаунтам | `signer_id`, `token_id`, `balance`, `nft_id` |
| `block` | Блоки Reef Chain | `height`, `hash`, `timestamp`, `extrinsic_count` |
| `extrinsic` | Транзакции (extrinsics) | `signer_id`, `method`, `section`, `success`, `fee` |
| `event` | События блокчейна | `section`, `method`, `data` (JSONB) |
| `staking` | Стейкинг события | `signer_id`, `type` (Reward/Slash/Bonded), `amount`, `era` |
| `era_validator_info` | Информация о валидаторах по эрам | `era`, `address`, `total`, `own`, `commission` |
| `contract_call` | Вызовы смарт-контрактов | `from_id`, `to_id`, `input`, `output`, `gas_used` |
| `nft_metadata` | Метаданные NFT | `contract_id`, `token_id`, `owner_id`, `metadata` (JSONB) |
| `indexer_cursor` | Курсор индексера | `last_block`, `last_block_hash`, `updated_at` |

**Relationships (Hasura):**
```
account ←→ transfer (from_id, to_id)
account ←→ token_holder (signer_id)
account ←→ staking (signer_id)
account ←→ extrinsic (signer_id)
verified_contract ←→ transfer (token_id)
verified_contract ←→ token_holder (token_id)
block ←→ extrinsic (block_height)
block ←→ event (block_height)
extrinsic ←→ event (extrinsic_id)
```

---

### 🐳 Docker: команды и взаимодействие

**Запуск стека:**
```bash
cd docker
docker-compose up -d                    # Development (с pgAdmin)
docker compose -f docker-compose.prod.yml up -d  # Production
```

**Проверка статуса:**
```bash
docker-compose ps                       # Статус контейнеров
docker-compose logs -f indexer          # Логи индексера
docker-compose logs -f hasura           # Логи Hasura
```

**Работа с PostgreSQL:**
```bash
# Подключение к psql
docker exec -it docker-postgres-1 psql -U reef -d reef_explorer

# Выполнение SQL команды
docker exec docker-postgres-1 psql -U reef -d reef_explorer -c "SELECT COUNT(*) FROM transfer;"

# Проверка курсора индексера
docker exec docker-postgres-1 psql -U reef -d reef_explorer -c "SELECT * FROM indexer_cursor;"

# Проверка размера таблиц
docker exec docker-postgres-1 psql -U reef -d reef_explorer -c "SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC;"
```

**Пересборка индексера:**
```bash
cd docker/indexer && npm run build      # Локальная сборка
docker-compose up -d --build indexer    # Пересборка в Docker
```

**Backup/Restore:**
```bash
# Backup
docker exec docker-postgres-1 pg_dump -U reef reef_explorer > backup.sql

# Restore
cat backup.sql | docker exec -i docker-postgres-1 psql -U reef -d reef_explorer
```

**Полная очистка:**
```bash
docker-compose down -v                  # Удалить контейнеры и volumes
```

---

### 📡 GraphQL запросы: Frontend → Hasura через proxy

**Browser endpoint:** `/api/reef-explorer`
**Local dev endpoint:** `http://localhost:5173/api/reef-explorer`
**Server-side proxy target:** `http://<hasura-host>:8080/v1/graphql`
**Header injection:** `x-hasura-admin-secret` добавляется только на server-side proxy слое (`nginx` или `Vite dev proxy`), а не из браузера

**Основные запросы (Hasura синтаксис):**

```graphql
# Transfers по адресу (пагинация)
query TransfersByAddress($accountId: String!, $limit: Int!, $offset: Int!) {
  transfer(
    where: {
      _or: [
        { from_id: { _eq: $accountId } }
        { to_id: { _eq: $accountId } }
      ]
    }
    order_by: [{ timestamp: desc }, { id: desc }]
    limit: $limit
    offset: $offset
  ) {
    id
    from_id
    to_id
    amount
    timestamp
    token_id
    type
    success
    verified_contract { id name type contract_data }
  }
  transfer_aggregate(where: { _or: [{ from_id: { _eq: $accountId } }, { to_id: { _eq: $accountId } }] }) {
    aggregate { count }
  }
}

# Token balances (Holdings)
query TokenHoldersByAccount($accountId: String!, $first: Int!) {
  token_holder(
    where: {
      signer_id: { _eq: $accountId }
      verified_contract: { type: { _eq: "ERC20" } }
    }
    order_by: [{ balance: desc }]
    limit: $first
  ) {
    signer_id
    balance
    verified_contract { id contract_data }
  }
  token_holder_aggregate(
    where: { signer_id: { _eq: $accountId }, verified_contract: { type: { _eq: "ERC20" } } }
  ) {
    aggregate { count }
  }
}

# Blocks stream (subscription)
subscription BlocksFromHeight($fromHeight: Int!, $limit: Int!) {
  block(
    where: { height: { _gt: $fromHeight } }
    order_by: [{ height: asc }]
    limit: $limit
  ) {
    height
    timestamp
  }
}

# Account resolution (EVM → Native)
query GetAccountByEvm($evmAddress: String!) {
  account(where: { evm_address: { _eq: $evmAddress } }) {
    id
    evm_address
  }
}

# Verified contracts (token icons)
query VerifiedContractsByIds($ids: [String!]!, $first: Int!) {
  verified_contract(where: { id: { _in: $ids } }, limit: $first) {
    id
    contract_data
  }
}
```

**Отличия Hasura от Subsquid:**

| Аспект | Subsquid | Hasura |
|--------|----------|--------|
| Root field | `transfersConnection` | `transfer` / `transfer_aggregate` |
| Pagination | `first/after` (cursor) | `limit/offset` |
| Filters | `where: { from: { id_eq: $x } }` | `where: { from_id: { _eq: $x } }` |
| Order | `orderBy: [timestamp_DESC]` | `order_by: [{ timestamp: desc }]` |
| Count | `totalCount` | `aggregate { count }` |
| Field names | camelCase | snake_case |
| Relations | `from { id }` | `account { id }` или `from_id` |

---

### 🔄 Indexer: поток данных

```
Reef Chain RPC (wss://rpc.reefscan.info/ws)
         ↓
    Indexer (TypeScript)
         ↓ parseBlock()
    PostgreSQL (via pg client)
         ↓
    Hasura (auto-tracks tables)
         ↓
    Frontend (Apollo Client)
```

**Что индексируется:**
- `balances.Transfer` → `transfer` (Native REEF)
- `evm.Log` (Transfer topic) → `transfer` (ERC20/ERC721/ERC1155)
- `evm.Log` (Swap topic) → `transfer.reefswap_action`
- Extrinsics → `extrinsic` (только forward mode)
- Blocks → `block`
- Token holders → `token_holder` (upsert на каждый transfer)
- Accounts → `account` (upsert)
- Contracts → `verified_contract` (auto-create для ERC20)

**Environment variables (indexer):**
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
POLL_INTERVAL_MS=3000
BACKFILL=true
BACKFILL_TARGET=7834548
```

---

## 2026-02-14

### 🐳 Local GraphQL Stack: PostgreSQL + Hasura + pgAdmin + Indexer
**Файлы:** `docker/docker-compose.yml`, `docker/pgadmin-servers.json`, `docker/init.sql`, `docker/seed.sql`, `docker/track-tables.json`, `docker/track-relationships.json`, `docker/indexer/package.json`, `docker/indexer/tsconfig.json`, `docker/indexer/src/index.ts`, `docker/indexer/src/parser.ts`, `docker/indexer/src/db.ts`, `docker/README.md`

- Развёрнут локальный стек в Docker: PostgreSQL, Hasura Console, pgAdmin
- Добавлена SQL-схема (account, verified_contract, transfer, token_holder, staking) с индексами под быстрые фильтры и COUNT
- Настроен tracking таблиц и relationships в Hasura metadata
- Добавлены seed-данные для быстрой проверки GraphQL
- Реализован TypeScript индексер Reef Chain:
  - чтение финализированных блоков через `@polkadot/api`
  - парсинг `balances.Transfer` и EVM `Transfer` логов
  - батч-запись в PostgreSQL
  - upsert аккаунтов, автосоздание ERC20 `verified_contract`
  - обновление `token_holder.balance` на каждом transfer
- Проверена синхронизация: индексер догоняет head и продолжает realtime ingest

### 🔌 Frontend: configurable Reef Explorer endpoint (Subsquid ↔ Local Hasura)
**Файлы:** `src/apollo-client.ts`, `src/reef-explorer-client.ts`, `src/constants/pagination.ts`, `.env.example`

- Убраны хардкоды `https://squid.subsquid.io/reef-explorer/graphql` в Apollo клиентах
- Добавлены env-переменные:
  - `VITE_REEF_EXPLORER_HTTP_URL`
  - `VITE_REEF_EXPLORER_WS_URL` (опционально, авто-derive из HTTP)
  - `REEF_EXPLORER_PROXY_TARGET` (server-only, для локального Vite proxy)
  - `REEF_EXPLORER_PROXY_PATH` (server-only, путь Hasura GraphQL)
  - `REEF_EXPLORER_ADMIN_SECRET` (server-only, для инжекта секрета в proxy)
- HTTP и WS клиенты работают через same-origin proxy endpoint, а `x-hasura-admin-secret` остаётся только на server-side proxy слое
- `API_CONFIG.API_URL` переведён на env-конфигурацию

> Важно: текущие GraphQL документы фронтенда сгенерированы под схему Subsquid. Полное переключение всего UI на локальную Hasura схему требует поэтапной миграции query layer (different root fields/filters/types).

### 🔁 Frontend: миграция Transaction History query layer на Hasura schema
**Файлы:** `src/utils/transfer-query.ts`, `src/data/transfers.ts`, `src/data/addresses.ts`, `src/data/verified-contracts.ts`, `src/data/token-icons.ts`, `src/data/balances.ts`, `src/data/nfts.ts`, `src/hooks/use-transaction-data-with-blocks.ts`, `src/hooks/useTransferSubscription.ts`, `src/hooks/use-swap-partner-legs.ts`, `src/hooks/use-token-metadata-resolver.ts`, `src/hooks/use-token-balances.ts`, `src/hooks/use-nft-count-by-owner.ts`, `src/components/TransactionHistoryWithBlocks.tsx`

- Добавлен runtime-режим `isHasuraExplorerMode` для выбора Hasura/Subsquid синтаксиса в одном коде
- Реализованы Hasura-совместимые:
  - `where` фильтры (`_and/_or`, `_eq/_in/_gte/_lte`, snake_case поля)
  - `orderBy` (`[{ timestamp: 'desc' }, { id: 'desc' }]`)
  - запросы на `transfer` и `transfer_aggregate` вместо `transfersConnection`
- В `src/data/transfers.ts` добавлены dual-документы (Subsquid + Hasura) и экспорт query selector’ов:
  - `PAGINATED_TRANSFERS_QUERY`
  - `PAGINATED_TRANSFERS_MIN_QUERY`
  - `TRANSFERS_COUNT_QUERY`
  - `TRANSFERS_BULK_COUNTS_QUERY`
  - `TRANSFERS_POLLING_QUERY`
- Хук `use-transaction-data-with-blocks` теперь нормализует оба формата ответа в единый `transfersConnection` runtime-shape и поддерживает:
  - cursor pagination (`first/after`) для Subsquid
  - offset pagination (`limit/offset`) для Hasura
- Хук `useTransferSubscription` переведён на общий `buildTransferOrderBy()` и отключает Subsquid-specific cache prepend ветку в Hasura режиме (fallback через refetch остаётся)
- `use-swap-partner-legs` и fast window partner fetch обновлены на Hasura where/order_by формат
- Bulk counts в `TransactionHistoryWithBlocks` поддерживают оба формата (`totalCount` и `aggregate.count`) и не передают `orderBy` в Hasura режиме
- Исправлена extrinsic identity резолюция для Hasura: добавлены `@include` флаги в unified query и корректный `id: extrinsic_id` mapping
- Дополнительно мигрированы смежные запросы, нужные для вкладок и фильтров страницы кошелька:
  - address resolver (`account` vs `accounts`)
  - verified contracts/token icons (`verified_contract` + alias полей)
  - balances (`token_holder` + `token_holder_aggregate`)
  - NFT count/list queries (`token_holder`/`token_holder_aggregate`)

**Технически:** UI transaction history теперь может работать с локальным Hasura endpoint (`/v1/graphql`) без ошибки `transfersConnection not found`, сохраняя обратную совместимость с Subsquid.

### ⚡ Wallet Page: меньше сетевых запросов при переключении вкладок + корректные суммы из Hasura
**Файлы:** `src/components/TransactionHistoryWithBlocks.tsx`, `src/hooks/use-squid-health.ts`, `src/hooks/useTransferSubscription.ts`, `src/hooks/use-transaction-data-with-blocks.ts`, `src/hooks/useTanstackTransactionAdapter.ts`, `src/data/transfer-mapper.ts`, `src/utils/formatters.ts`, `src/utils/token-helpers.ts`

- Вкладки Wallet Page теперь не ремаунтятся при каждом переключении: после первого открытия вкладка остаётся смонтированной и просто скрывается (`hidden`), что убирает лишние повторные стартовые запросы.
- Для Transactions добавлен флаг активности: realtime polling (`useTransferSubscription`) и health polling (`useSquidHealth`) работают только когда вкладка Transactions активна.
- Базовый transactions query переведён на `cache-first` с ручным `refetch` только при возврате на активную вкладку Transactions (transition inactive -> active), чтобы исключить лишние сетевые запросы в фоне.
- В `useTanstackTransactionAdapter` и `useTransactionDataWithBlocks` добавлен `isActive` passthrough: в неактивной вкладке останавливаются swap/base loader paths, при возврате выполняется единичное обновление данных.
- `useTransferSubscription` отвязан от UI-фильтров `incoming/outgoing/all`: подписка всегда работает с `direction: 'any'` и без amount-фильтров, чтобы переключение type-кнопок не пересоздавало polling query каждый раз.
- Исправлен показ `0.00` для больших on-chain значений из Hasura: добавлена нормализация scientific-notation/number в integer raw string перед форматированием и вычислениями.
- В subscription fallback для Hasura убран лишний `refetchQueries`, если новых трансферов не обнаружено.

**Технически:** переключение между Transactions/Holdings/NFTs теперь почти не генерирует новых сетевых запросов, а отображение amount и value остаётся корректным для `numeric` полей Hasura.

### 🧪 Local QA Seed: NFT + Swap тестовые данные
**Файлы:** `docker/seed-nft-swap.sql`

- Добавлен идемпотентный SQL seed для локального стека, который создаёт:
  - swap-ноги в одном `extrinsic_hash` (REEF -> USDC) для проверки вкладки/фильтра `Swap`;
  - NFT transfer (`ERC721`) и `token_holder` запись с `nft_id` для проверки вкладки `NFTs`.
- Seed включает upsert тестовых аккаунтов и контрактов (`REEF`, `USDC`, `TEST-NFT`) через `ON CONFLICT`, чтобы скрипт можно было запускать повторно.
- Базовый адрес для теста после применения seed: `5GNJqTPyNqANBkUVMN1LPPrxXnFouWA2MRQg3gKrUYgw6HEr`.

**Технически:** позволяет проверять полный пользовательский сценарий (Transactions/Holdings/NFTs/Swap) в локальной Hasura БД без ожидания deep backfill indexer.

### 🧱 Indexer: устойчивость к historical metadata decode ошибкам
**Файлы:** `docker/indexer/src/index.ts`, `docker/indexer/src/parser.ts`

- В `ApiPromise.create` добавлены `REEF_TYPE_OVERRIDES` (включая `EvmAddress`, `CurrencyIdOf` и др.) для снижения числа decode-падений на исторических блоках.
- `START_BLOCK` теперь зажимается к `chainHead`, с явным warning в логах, чтобы индексер не «ожидал вхолостую» при старте выше head.
- Парсер переведён на block-scoped `api.at(blockHash)` + чтение `system.events`/`timestamp.now` в `try/catch`; при decode-сбое конкретный блок пропускается с warning вместо бесконечного retry того же блока.
- Исправлен `transfer_from_id_fkey` при deep backfill: для ERC20 `evm.Log` парсер теперь валидирует `from/to` как EVM-адреса и добавляет их в `accounts` batch (id=`0x...`, evm_address=`0x...`) до вставки `transfer`.

**Технически:** deep backfill продолжает прогрессировать даже при отдельных несовместимых исторических блоках/событиях, вместо остановки индексации.

### 🗄️ Indexer: cursor table для production-ready checkpoint
**Файлы:** `docker/init.sql`, `docker/indexer/src/db.ts`, `docker/indexer/src/index.ts`

- Добавлена таблица `indexer_cursor` (id, last_block, last_block_hash, updated_at) для атомарного хранения прогресса индексации независимо от данных в `transfer`.
- `getLastIndexedBlock()` теперь читает из `indexer_cursor` вместо `MAX(block_height) FROM transfer`.
- `setLastIndexedBlock(blockNum, blockHash)` вызывается после каждого успешного батча для персистентности курсора.
- При restart/crash индексер продолжает с точного `last_block` из cursor, а не пересчитывает по transfer-таблице.

**Технически:** критично для production — позволяет безопасно рестартовать индексер без потери прогресса и без зависимости от целостности transfer-данных. Упрощает миграцию на сервер и параллельный запуск нескольких indexer-инстансов (с разными cursor id).

### 🚀 Production-ready Docker setup
**Файлы:** `docker/.env.example`, `docker/docker-compose.prod.yml`, `docker/indexer/Dockerfile`, `docker/README.md`

**Создан production-ready стек:**
- `docker-compose.prod.yml` — production конфигурация с 3 сервисами: postgres, hasura, indexer
- `.env.example` — шаблон для всех секретов и параметров (POSTGRES_PASSWORD, HASURA_GRAPHQL_ADMIN_SECRET, RPC_URL, START_BLOCK, BATCH_SIZE и др.)
- `indexer/Dockerfile` — multi-stage build для indexer с production dependencies
- Hasura настроен для production: `ENABLE_CONSOLE=false`, `DEV_MODE=false`, `UNAUTHORIZED_ROLE=` (пустое = требуется auth)
- Все секреты вынесены в `.env` (не коммитятся в git)
- Indexer запускается автоматически как Docker service с restart policy и log rotation

**Безопасность:**
- PostgreSQL доступен только внутри Docker network (не exposed наружу в prod-compose)
- Hasura console отключена, dev-mode выключен
- Все пароли/секреты конфигурируются через environment variables
- README дополнен инструкциями по backup/restore, мониторингу, обновлению

**Технически:** готово к деплою на сервер — достаточно скопировать `docker/` папку, создать `.env` с production-секретами, и запустить `docker compose -f docker-compose.prod.yml up -d`. Indexer начнёт с cursor position и продолжит backfill автоматически.

## 2026-02-11

### 🔧 Исправления по результатам аудита Wallet Page (12 фиксов)
**Файлы:** `src/components/BalancesTable.tsx`, `src/components/TransactionsFilters.tsx`, `src/stores/use-transaction-filter-store.ts`, `src/components/TransactionHistoryWithBlocks.tsx`, `src/hooks/useTransferSubscription.ts`, `src/hooks/use-ensure-loaded.ts`, `src/hooks/use-transaction-data-with-blocks.ts`

#### React качество кода
- **HOLD-BUG-1+2**: `handleCopy` и `isLocalAsset` обёрнуты в `useCallback` — `React.memo` на `BalanceRow` теперь работает корректно, нет лишних ре-рендеров 50 строк при каждом клике
- **HOLD-BUG-4**: Imperative `img.replaceWith(fallback)` заменён на `TokenIcon` React.memo компонент с `useState(srcIdx)` / `useState(allFailed)` — React полностью контролирует DOM
- **BUG-4**: Stale closure в `useEnsureLoaded` — `initialTransactions`, `filteredTransactions`, `hasNextPage` читаются через refs для актуальных данных в while loop после `await fetchMore()`

#### UX фильтров
- **FILTER-BUG-1**: Quick presets (100/1k/10k/100k) теперь рендерятся только в REEF mode — скрыты для USDC/MRD/custom токенов
- **FILTER-BUG-2**: `direction` добавлен в `partialize` Zustand store — корректно восстанавливается из localStorage при reload

#### Производительность запросов к squid
- **PERF-CRITICAL**: Убран `orderBy: amount_ASC` из `use-transaction-data-with-blocks.ts` — вызывал таймаут squid (35+ сек) из-за full table scan на неиндексированном поле. Теперь всегда `timestamp_DESC`, клиентская сортировка по amount сохранена
- **PERF**: Убран persist `minAmountInput`/`maxAmountInput` из Zustand store — при reload страницы автоматически летели тяжёлые запросы с amount фильтрами, даже если пользователь не включал фильтр
- **PERF**: `orderBy` для bulk counts запроса изменён на `id_DESC` (primary key, легче для squid query plan)
- **OPT-1**: Bulk counts запрос (3× `transfersConnection`) обёрнут в debounce 400ms — при быстрых изменениях фильтров запрос не спамится
- **OPT-2**: Where-варианты в subscription оптимизированы: 3→1 когда оба адреса resolved, 3 только при неполном resolution

#### Прочее
- **BUG-3**: Подтверждён как false positive — `createNewItemDetector` уже имеет LRU eviction с max=200

---

## 2026-02-10

### 🔍 Аудит Transaction History + bugfix maxReefRaw
**Файлы:** `src/utils/transfer-query.ts`, `AUDIT-transaction-history.md`

- **BUG FIX**: `maxReefRaw` не применялся в server-side фильтре — `amount_lte` отсутствовал в `buildTransferWhereFilter`. Сервер возвращал лишние данные, фильтрация была только на клиенте.
- Полный аудит архитектуры wallet page (13 файлов, ~3500 строк) записан в `AUDIT-transaction-history.md`
- Найдено: 1 баг средней серьёзности (исправлен), 2 low-severity, 3 оптимизации

---

### ⏱️ Умный scheduling ICP hooks + health check cron
**Файлы:** `src/hooks/use-active-wallets-24h-icp.ts`, `src/hooks/use-new-wallets-inflow-icp.ts`, `aggregator/src/cron-icp.ts`

- **ICP hooks**: заменён `setInterval(5min)` на smart `setTimeout` — вычисляет время до следующего cron из `asOf` timestamp
- **Stale detection**: если `asOf` не изменился после fetch (cron опоздал) — retry через 30 мин вместо 4ч
- **Self-rescheduling chain**: после каждого fetch пересчитывает следующий таймер из свежего `asOf`
- **Cron health check**: `waitForSubsquid()` перед началом работы — exponential backoff до 30 мин если Subsquid недоступен
- Убран дублирующий `useSquidHealth()` из `App.tsx`

---

### �🛡️ Trusted Validators секция
**Файлы:** `src/components/NetworkStatistics.tsx`

- Секция внутри карточки Total Staked с 3 валидаторами REEFAQ.IO
- Amber стиль: shield иконка, amber фон, галочки
- Данные (commission, APY) берутся из того же массива `staked.validators` — обновляются каждые 5 мин
- Hardcoded массив `TRUSTED_VALIDATORS` для быстрого добавления/удаления

---

### 📈 Fix TpsSparkline — жирная линия и рывки точки
**Файлы:** `src/components/TpsSparkline.tsx`

- **minYSpan = 3** в RAF y-domain interpolation — не даёт диапазону сжаться до микроскопического, предотвращает "толстую" линию
- **strokeWidth = 0.5** постоянный — убрано условное переключение `isFlat ? 0.8 : 0.5`
- **smoothFactor = 0.012** — плавное движение маркера без рывков

---

### 🔧 Аудит сетевых запросов — уменьшение нагрузки
**Файлы:** `src/App.tsx`

- Убран дублирующий `useSquidHealth()` из `App.tsx` — не использовал результат, создавал лишний polling loop
- Итого на главной: ~3 HTTP запроса/мин (health 30с + staking/wallets 5 мин)
- `useTpsLive` работает через WebSocket subscription — 0 дополнительных HTTP

---

### ✨ UX: skeleton загрузка, error handling, сортировка
**Файлы:** `src/components/NetworkStatistics.tsx`, `src/hooks/use-total-staked.ts`

- **Skeleton shimmer** при загрузке Total Staked — amber-тонированные плашки с `animate-pulse`
- **Error state** — красное сообщение + текст ошибки + кнопка "Обновить"
- **squid-outage event** при ошибке — интеграция с `WsStatusToast` для toast уведомлений
- **Сортировка**: валидаторы с именами вверху, безымянные внизу
- **Кнопка validators** — визуальная подсказка (border + bg + hover)
- **Заголовок**: "Total Staked" + "5.88B REEF" оранжевым акцентом

---

### 🏷️ Имена и комиссии валидаторов + точный APY
**Файлы:** `src/hooks/validator-meta.ts` (новый), `src/hooks/use-total-staked.ts`, `src/components/NetworkStatistics.tsx`

**Что показывает:**
- Имя валидатора (on-chain identity) вместо обрезанного адреса
- Комиссия каждого валидатора (%)
- Индивидуальный APY с учётом комиссии: `APY = (reward / stake) × 365 × 100 × (1 - commission)`

**Архитектура (оптимизация запросов):**
- **1 HTTP POST** — batch JSON-RPC: 23 запроса `identity.identityOf` + 23 запроса `staking.validators` = 46 вызовов в одном запросе
- **Кеш 30 минут** — module-level, не повторяем при каждом рендере
- **Ленивая загрузка** — запрашиваем только после получения списка валидаторов из Subsquid
- **Без новых зависимостей** — используем `@polkadot/util-crypto` (уже в проекте) для `xxhashAsHex` и `decodeAddress`

**Как формируются storage keys:**
- `twox128("Identity") + twox128("IdentityOf") + twox64(pubkey) + pubkey` → identity
- `twox128("Staking") + twox128("Validators") + twox64(pubkey) + pubkey` → commission (Perbill LE)

**Декодирование SCALE:**
- Identity: `Registration { judgements: Vec<(u32,Judgement)>, deposit: u128, info: IdentityInfo { additional: BoundedVec, display: Data, ... } }` → парсим offset до `display` поля, `Data::Raw(N)` = tag `N+1` + N байт ASCII
- Judgement::FeePaid (variant 1) содержит u128 Balance — пропускаем 16 байт
- Commission: `Compact<Perbill>` — SCALE compact decoding (mode 0/1/2), затем ÷ 1_000_000_000 × 100 = %
- 20 из 23 валидаторов имеют on-chain identity, остальные показывают обрезанный адрес

---

## 2026-02-09

### 🔒 Total Staked REEF — новый виджет
**Заменил:** Transactions (24h)
**Файлы:** `src/hooks/use-total-staked.ts`, `src/components/NetworkStatistics.tsx`

**Что показывает:**
- Total staked REEF (сумма по всем валидаторам последней эры)
- % от total supply (progress bar)
- APY (~годовая доходность стейкинга) — кеш rewards 30 мин
- Раскрывающийся список валидаторов с именами, комиссиями и индивидуальным APY
- Количество валидаторов, USD эквивалент, номер эры

**Как реализовано:**
- Staked data: GraphQL `eraValidatorInfos` из Subsquid (последняя эра, суммируем `total`)
- Total supply: RPC `state_getStorage` → `system.totalIssuance` с `rpc.reefscan.info`
- APY: пагинация rewards из Subsquid (limit 200, maxPages 20) → `(dailyReward / totalStaked) × 365 × 100`
- USD: через существующий `useReefPrice` (CoinGecko)
- Кеш totalIssuance: 5 мин, кеш dailyReward: 30 мин (module-level)
- Обновление: каждые 5 минут

---

### 👛 Active Wallets вместо New Wallets
**Изменил:** "New Wallets (24h, ICP)" → "Active Wallets (24h, ICP)"
**Файлы:** `src/hooks/use-active-wallets-24h-icp.ts`, `src/components/NetworkStatistics.tsx`

**Что изменилось:**
- Раньше показывал `p.new` (новые адреса за 24ч) — теперь `p.active` (все уникальные адреса за 24ч)
- Обновлены заголовок, tooltip, title на столбиках

---

### 📊 Столбики с датами и пропусками (date-gap filling)
**Файлы:** `src/hooks/use-active-wallets-24h-icp.ts`, `src/components/NetworkStatistics.tsx`

**Что изменилось:**
- Столбики привязаны к реальным датам (раньше — просто массив чисел)
- Если за какой-то день нет данных — показывается маленький пунктирный блок "no data"
- При наведении — дата и значение

**Как реализовано:**
- `fillDateGaps()` — утилита: берёт массив `{value, ts}`, создаёт непрерывный ряд дат, заполняет пропуски `null`
- `sparkDated: SparkDatedPoint[]` — новое поле в хуках, используется для рендера

---

### 🗑️ Удалён Transactions (24h)
**Удалённые файлы:** `src/hooks/use-network-growth-aggregator.ts`
**Изменённые файлы:** `src/data/icp-client.ts`, `aggregator/src/cron-icp.ts`, `src/components/NetworkStatistics.tsx`

**Что убрано:**
- Хук `useNetworkGrowthAggregator`
- `getExtrinsicsSparklineDailyIcp()` из icp-client
- `EXTRINSICS_COUNT` query и `fetchExtrinsicsCount()` из cron-icp
- Cron передаёт `extrinsics: 0` в snapshot (канистра требует поле)
- `VITE_ICP_EXTRINSICS_DAILY_URL` больше не используется

**TODO:** Убрать `extrinsics` из Rust канистры (`lib.rs` + `.did`) и переделоить

---

### 🌐 ICP Canister Setup
**Файл:** `icp-onchain/ICP-SETUP.md`

- Документация по канистрам, identity, командам dfx
- Перенос identity `mainnet` на новый ПК
- II principal добавлен как контроллер
- GitHub Actions `cron-icp` настроен и работает

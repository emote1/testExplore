# Reef Explorer — Полная схема БД

## Обзор

Полная схема для Reef Explorer включает все необходимые таблицы для:
- ✅ Block explorer (blocks, extrinsics, events)
- ✅ Transfer history (transfers, token_holder)
- ✅ Staking analytics (staking, era_validator_info)
- ✅ Contract interactions (contract_call, verified_contract)
- ✅ NFT gallery (nft_metadata)
- ✅ Live metrics (Tx/min через WebSocket)

---

## Таблицы

### 1. **account** (уже реализовано ✅)
Хранит все адреса (Native SS58 + EVM).

**Поля:**
- `id` — Native address (SS58)
- `evm_address` — EVM address (0x...)
- `free_balance`, `locked_balance`, `available_balance`, `reserved_balance`
- `nonce`, `evm_nonce`

**Использование:**
- Wallet page
- Address resolution
- Balance tracking

---

### 2. **verified_contract** (уже реализовано ✅)
Токены (ERC20/ERC721/ERC1155) и verified контракты.

**Поля:**
- `id` — Contract address
- `name`, `type` (ERC20, ERC721, ERC1155)
- `contract_data` — JSONB с metadata (symbol, decimals, icon)
- `source`, `compiled_data` — verification data

**Использование:**
- Token list
- Contract verification
- Token metadata

---

### 3. **transfer** (уже реализовано ✅)
Все переводы (Native REEF, ERC20, NFT).

**Поля:**
- `id`, `block_height`, `block_hash`
- `from_id`, `to_id`, `token_id`
- `amount`, `nft_id`
- `reefswap_action` — Swap detection
- `extrinsic_hash`, `extrinsic_index`

**Использование:**
- Transaction history
- Wallet activity
- Swap detection

---

### 4. **token_holder** (уже реализовано ✅)
Балансы токенов для каждого адреса.

**Поля:**
- `id` — tokenAddr-signerAddr-nftId
- `token_id`, `signer_id`
- `balance`, `nft_id`

**Использование:**
- Token balances
- NFT ownership
- Top holders

---

### 5. **block** (новая таблица 🆕)
Информация о блоках.

**Поля:**
- `height` — Block number (PK)
- `hash`, `parent_hash`
- `author` — Validator address
- `extrinsic_count`, `event_count`
- `timestamp`, `processor_timestamp`

**Использование:**
- Block explorer
- Tx/min metric (WebSocket subscription)
- Validator activity

**Запросы:**
```graphql
query LatestBlock {
  blocks(orderBy: height_DESC, limit: 1) {
    height
    timestamp
  }
}
```

---

### 6. **extrinsic** (новая таблица 🆕)
Все транзакции на уровне блокчейна.

**Поля:**
- `id` — blockNum-extrinsicIndex
- `block_height`, `hash`
- `signer_id`, `method`, `section`
- `fee`, `tip`, `success`
- `args` — JSONB

**Использование:**
- Tx/min metric (WebSocket subscription)
- Transaction details
- Fee analytics
- Failed transactions

**Запросы:**
```graphql
subscription ExtrinsicsFromHeight($fromHeight: Int!) {
  extrinsics(
    where: { block: { height_gt: $fromHeight } }
    orderBy: [id_ASC]
    limit: 5
  ) {
    id
    block { timestamp }
  }
}
```

---

### 7. **event** (новая таблица 🆕)
Все события блокчейна.

**Поля:**
- `id` — blockNum-eventIndex
- `block_height`, `extrinsic_id`
- `section`, `method`
- `data` — JSONB

**Использование:**
- Event explorer
- Debug failed transactions
- Analytics

---

### 8. **staking** (расширенная ✅)
Staking события (rewards, bonded, unbonded).

**Поля:**
- `id`, `signer_id`
- `type` — Reward, Slash, Bonded, Unbonded, Withdrawn
- `amount`, `era`, `validator_id`

**Использование:**
- Staking rewards history
- Validator performance
- APY calculation

---

### 9. **era_validator_info** (новая таблица 🆕)
Агрегированные данные валидаторов по эрам.

**Поля:**
- `id` — era-validatorAddress
- `era`, `address`
- `total` — Total stake
- `own` — Validator's own stake
- `nominators_count`, `commission`

**Использование:**
- **Total Staked** metric
- Validator rankings
- Historical staking data

**Запросы:**
```graphql
query LatestEraValidators {
  eraValidatorInfos(orderBy: era_DESC, limit: 200) {
    era
    address
    total
  }
}
```

---

### 10. **contract_call** (новая таблица 🆕)
EVM contract calls.

**Поля:**
- `id`, `block_height`, `extrinsic_id`
- `from_id`, `to_id`
- `value`, `gas_limit`, `gas_used`
- `input`, `output` — calldata/return data

**Использование:**
- Contract interaction history
- Gas analytics
- Smart contract explorer

---

### 11. **nft_metadata** (новая таблица 🆕)
NFT metadata кэш.

**Поля:**
- `id` — contractAddress-tokenId
- `contract_id`, `token_id`, `owner_id`
- `metadata_uri`, `metadata` — JSONB (name, image, attributes)

**Использование:**
- NFT gallery
- Metadata caching
- Ownership tracking

---

### 12. **indexer_cursor** (уже реализовано ✅)
Прогресс индексации.

**Поля:**
- `id` — 'main'
- `last_block`, `last_block_hash`
- `updated_at`

**Использование:**
- Resume indexing after restart
- Progress tracking

---

## Что поддерживается сейчас vs. после обновления

### Текущая реализация (только transfers)
- ✅ Transfer history
- ✅ Token balances
- ✅ Swap detection
- ❌ Block explorer
- ❌ Tx/min metric
- ❌ Total Staked
- ❌ Failed transactions
- ❌ Fee analytics
- ❌ Contract calls
- ❌ NFT metadata

### После обновления (полная схема)
- ✅ Transfer history
- ✅ Token balances
- ✅ Swap detection
- ✅ Block explorer
- ✅ Tx/min metric (live WebSocket)
- ✅ Total Staked (без RPC)
- ✅ Failed transactions
- ✅ Fee analytics
- ✅ Contract calls
- ✅ NFT metadata
- ✅ Staking history
- ✅ Validator rankings

---

## Следующие шаги

### 1. Обновить indexer parser
Нужно добавить парсинг:
- ✅ Blocks
- ✅ Extrinsics
- ✅ Events
- ✅ Staking events (с era и validator)
- ✅ Era validator info (агрегация)
- ✅ Contract calls (EVM.call)
- ✅ NFT metadata (fetch from URI)

### 2. Пересоздать БД с новой схемой
```bash
# Остановить стек
docker compose -f docker-compose.fast.yml down

# Удалить старый volume
docker volume rm docker_postgres_data

# Запустить с новой схемой
docker compose -f docker-compose.fast.yml up -d
```

### 3. Обновить Hasura metadata
После индексации нужно:
- Track новые таблицы в Hasura Console
- Создать relationships между таблицами
- Настроить permissions

### 4. Обновить frontend queries
Заменить запросы к Subsquid на локальные:
- `eraValidatorInfos` → `era_validator_info`
- `extrinsics` subscription → работает из коробки
- `blocks` query → работает из коробки

---

## Оценка времени индексации

**С текущим indexer (только transfers):**
- Скорость: ~4 blocks/sec
- Время: 7-12 дней

**С полным indexer (все таблицы):**
- Скорость: ~2-3 blocks/sec (больше данных)
- Время: **14-20 дней**

**Рекомендация:**
Запустить на мощном ПК (i9-14900KF) на 2-3 недели для полного genesis backfill.

---

## Приоритеты реализации

### 🔥 Критично (сделать сейчас):
1. ✅ `block` — для Tx/min metric
2. ✅ `extrinsic` — для Tx/min и failed tx
3. ✅ `era_validator_info` — для Total Staked

### 🌟 Важно (сделать скоро):
4. ✅ `event` — для детальной информации
5. ✅ `staking` (расширенная) — для staking history
6. ✅ `contract_call` — для EVM analytics

### 💡 Nice to have (можно позже):
7. ✅ `nft_metadata` — для NFT gallery

---

## Итого

**Схема готова!** 🎉

Теперь нужно:
1. Обновить indexer для парсинга новых таблиц
2. Пересоздать БД
3. Запустить полный genesis backfill (14-20 дней)
4. После завершения — обновить frontend queries

**Все данные будут доступны локально без зависимости от Subsquid!** 🚀

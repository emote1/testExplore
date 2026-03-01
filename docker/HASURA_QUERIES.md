# Hasura GraphQL Queries для Reef Explorer

Документация всех GraphQL запросов для интеграции с frontend.

---

## 🔗 Endpoint

```
HTTP:  http://localhost:8080/v1/graphql
WS:    ws://localhost:8080/v1/graphql
```

**Admin Secret:** `local_dev_secret`

---

## 📊 Основные запросы

### 1. **Получить transfers для кошелька**

```graphql
query GetWalletTransfers($address: String!, $limit: Int = 10, $offset: Int = 0) {
  transfer(
    where: {
      _or: [
        { from_id: { _eq: $address } }
        { to_id: { _eq: $address } }
      ]
    }
    order_by: { timestamp: desc }
    limit: $limit
    offset: $offset
  ) {
    id
    from_id
    to_id
    amount
    type
    timestamp
    token_id
    extrinsic_hash
    extrinsic_index
    event_index
    success
    error_message
    fee_amount
    nft_id
    dapp
    reefswap_action
    verified_contract {
      name
      type
    }
  }
}
```

**Variables:**
```json
{
  "address": "0x8e738780524a533b2d6bdb9ef6bcaa0a819ac62c",
  "limit": 10,
  "offset": 0
}
```

---

### 2. **Подсчитать количество транзакций (для пагинации)**

```graphql
query GetTransactionCounts($address: String!) {
  # Всего транзакций
  total: transfer_aggregate(
    where: {
      _or: [
        { from_id: { _eq: $address } }
        { to_id: { _eq: $address } }
      ]
    }
  ) {
    aggregate {
      count
    }
  }
  
  # Исходящие
  outgoing: transfer_aggregate(
    where: { from_id: { _eq: $address } }
  ) {
    aggregate {
      count
    }
  }
  
  # Входящие
  incoming: transfer_aggregate(
    where: { to_id: { _eq: $address } }
  ) {
    aggregate {
      count
    }
  }
  
  # Свопы
  swaps: transfer_aggregate(
    where: {
      _or: [
        { from_id: { _eq: $address } }
        { to_id: { _eq: $address } }
      ]
      reefswap_action: { _is_null: false }
    }
  ) {
    aggregate {
      count
    }
  }
}
```

**Variables:**
```json
{
  "address": "0x8e738780524a533b2d6bdb9ef6bcaa0a819ac62c"
}
```

---

### 3. **Получить балансы токенов (через address_stats)**

```graphql
query GetWalletBalances($address: String!) {
  address_stats(
    where: { address: { _eq: $address } }
  ) {
    address
    total_transactions
    incoming_transactions
    outgoing_transactions
    first_transaction_at
    last_transaction_at
  }
  
  token_holder(
    where: { signer_id: { _eq: $address } }
  ) {
    signer_id
    token_id
    balance
    verified_contract {
      name
      type
    }
  }
}
```

---

### 4. **Получить информацию об аккаунте**

```graphql
query GetAccountInfo($address: String!) {
  account(where: { id: { _eq: $address } }) {
    id
    evm_address
    native_address
    identity
  }
}
```

---

### 5. **Получить последние блоки**

```graphql
query GetLatestBlocks($limit: Int = 10) {
  block(
    order_by: { height: desc }
    limit: $limit
  ) {
    height
    hash
    parent_hash
    timestamp
    extrinsics_count
    events_count
    author
  }
}
```

---

### 6. **Получить extrinsics для блока**

```graphql
query GetBlockExtrinsics($blockHeight: Int!) {
  extrinsic(
    where: { block_height: { _eq: $blockHeight } }
    order_by: { index: asc }
  ) {
    id
    block_height
    index
    hash
    method
    section
    args
    signer
    signature
    nonce
    success
    error
    fee
    tip
    timestamp
  }
}
```

---

### 7. **Получить события для extrinsic**

```graphql
query GetExtrinsicEvents($extrinsicId: String!) {
  event(
    where: { extrinsic_id: { _eq: $extrinsicId } }
    order_by: { index: asc }
  ) {
    id
    block_height
    extrinsic_id
    index
    phase
    section
    method
    data
    timestamp
  }
}
```

---

### 8. **Получить NFT для кошелька**

```graphql
query GetWalletNFTs($address: String!, $limit: Int = 10) {
  nft_metadata(
    where: { owner: { _eq: $address } }
    order_by: { token_id: asc }
    limit: $limit
  ) {
    contract_id
    token_id
    owner
    metadata_uri
    metadata_json
    verified_contract {
      name
      type
    }
  }
}
```

---

### 9. **Получить staking информацию**

```graphql
query GetStakingInfo($address: String!) {
  staking(
    where: { signer_id: { _eq: $address } }
    order_by: { timestamp: desc }
    limit: 10
  ) {
    id
    signer_id
    type
    amount
    timestamp
    extrinsic_hash
  }
}
```

---

### 10. **Получить валидаторов для эры**

```graphql
query GetEraValidators($era: Int!) {
  era_validator_info(
    where: { era: { _eq: $era } }
    order_by: { total_stake: desc }
  ) {
    era
    validator_id
    total_stake
    own_stake
    nominators_stake
    commission
    reward_points
    is_elected
  }
}
```

---

## 📈 Статистика и аналитика

### 11. **Общая статистика базы данных**

```graphql
query GetDatabaseStats {
  total_transfers: transfer_aggregate {
    aggregate {
      count
    }
  }
  
  total_accounts: account_aggregate {
    aggregate {
      count
    }
  }
  
  total_tokens: verified_contract_aggregate(
    where: { type: { _eq: "ERC20" } }
  ) {
    aggregate {
      count
    }
  }
  
  total_blocks: block_aggregate {
    aggregate {
      count
      max {
        height
      }
    }
  }
  
  reef_transfers: transfer_aggregate(
    where: { token_id: { _eq: "0x0000000000000000000000000000000001000000" } }
  ) {
    aggregate {
      count
    }
  }
}
```

---

### 12. **Дневная статистика (materialized view)**

```graphql
query GetDailyStats($limit: Int = 30) {
  daily_stats(
    order_by: { date: desc }
    limit: $limit
  ) {
    date
    total_transactions
    unique_addresses
    total_volume
    avg_transaction_value
  }
}
```

---

### 13. **Топ токенов за 24 часа (materialized view)**

```graphql
query GetTopTokens24h($limit: Int = 10) {
  top_tokens_24h(
    order_by: { transaction_count: desc }
    limit: $limit
  ) {
    token_id
    token_name
    transaction_count
    unique_users
    total_volume
  }
}
```

---

## 🔄 Real-time Subscriptions

### 14. **Подписка на новые transfers**

```graphql
subscription WatchNewTransfers($address: String) {
  transfer_stream(
    cursor: { initial_value: { timestamp: "2026-02-15T00:00:00Z" } }
    batch_size: 10
    where: {
      _or: [
        { from_id: { _eq: $address } }
        { to_id: { _eq: $address } }
      ]
    }
  ) {
    id
    from_id
    to_id
    amount
    type
    timestamp
    verified_contract {
      name
      type
    }
  }
}
```

---

### 15. **Подписка на новые блоки**

```graphql
subscription WatchNewBlocks {
  block_stream(
    cursor: { initial_value: { height: 0 } }
    batch_size: 1
  ) {
    height
    hash
    timestamp
    extrinsics_count
    events_count
  }
}
```

---

## 🔍 Поиск и фильтрация

### 16. **Поиск transfers по токену**

```graphql
query GetTransfersByToken($tokenId: String!, $limit: Int = 10) {
  transfer(
    where: { token_id: { _eq: $tokenId } }
    order_by: { timestamp: desc }
    limit: $limit
  ) {
    id
    from_id
    to_id
    amount
    timestamp
    verified_contract {
      name
      type
    }
  }
}
```

---

### 17. **Поиск transfers по диапазону дат**

```graphql
query GetTransfersByDateRange(
  $address: String!
  $startDate: timestamptz!
  $endDate: timestamptz!
) {
  transfer(
    where: {
      _and: [
        {
          _or: [
            { from_id: { _eq: $address } }
            { to_id: { _eq: $address } }
          ]
        }
        { timestamp: { _gte: $startDate } }
        { timestamp: { _lte: $endDate } }
      ]
    }
    order_by: { timestamp: desc }
  ) {
    id
    from_id
    to_id
    amount
    timestamp
    verified_contract {
      name
    }
  }
}
```

**Variables:**
```json
{
  "address": "0x8e738780524a533b2d6bdb9ef6bcaa0a819ac62c",
  "startDate": "2026-02-01T00:00:00Z",
  "endDate": "2026-02-15T23:59:59Z"
}
```

---

### 18. **Топ активных кошельков**

```graphql
query GetTopWallets($limit: Int = 10) {
  address_stats(
    order_by: { total_transactions: desc }
    limit: $limit
  ) {
    address
    total_transactions
    incoming_transactions
    outgoing_transactions
    first_transaction_at
    last_transaction_at
  }
}
```

---

## 🛠️ Вспомогательные функции

### 19. **Быстрый подсчёт через helper function**

```graphql
query GetFastTransactionCount($address: String!) {
  get_address_transaction_count(args: { addr: $address }) {
    total
    incoming
    outgoing
  }
}
```

---

### 20. **Пагинация с использованием cursor**

```graphql
query GetTransfersWithCursor(
  $address: String!
  $limit: Int = 10
  $cursor: timestamptz
) {
  transfer(
    where: {
      _and: [
        {
          _or: [
            { from_id: { _eq: $address } }
            { to_id: { _eq: $address } }
          ]
        }
        { timestamp: { _lt: $cursor } }
      ]
    }
    order_by: { timestamp: desc }
    limit: $limit
  ) {
    id
    from_id
    to_id
    amount
    timestamp
    verified_contract {
      name
    }
  }
}
```

---

## 📝 Примечания для интеграции с frontend

### Hasura vs Subsquid различия:

1. **Названия полей:**
   - Subsquid: `from`, `to`
   - Hasura: `from_id`, `to_id`

2. **Фильтрация:**
   - Subsquid: `where: { from_eq: "..." }`
   - Hasura: `where: { from_id: { _eq: "..." } }`

3. **Сортировка:**
   - Subsquid: `orderBy: timestamp_DESC`
   - Hasura: `order_by: { timestamp: desc }`

4. **Пагинация:**
   - Subsquid: `first`, `after`
   - Hasura: `limit`, `offset`

5. **Агрегации:**
   - Subsquid: `transfersConnection { totalCount }`
   - Hasura: `transfer_aggregate { aggregate { count } }`

6. **Subscriptions:**
   - Subsquid: `subscription { transfers { ... } }`
   - Hasura: `subscription { transfer_stream { ... } }`

---

## 🔄 Обновление materialized views

Materialized views нужно обновлять периодически:

```sql
-- Обновить дневную статистику
REFRESH MATERIALIZED VIEW CONCURRENTLY daily_stats;

-- Обновить топ токенов
REFRESH MATERIALIZED VIEW CONCURRENTLY top_tokens_24h;
```

Можно настроить автоматическое обновление через cron или pg_cron.

---

## 🚀 Следующие шаги

1. Интегрировать запросы в `src/data/transfers.ts`
2. Обновить Apollo Client для работы с Hasura
3. Добавить переключатель между Subsquid и Hasura
4. Протестировать все запросы с реальными данными
5. Настроить WebSocket subscriptions для real-time обновлений

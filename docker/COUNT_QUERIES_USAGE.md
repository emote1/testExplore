# Использование Count запросов для пагинации

## Проблема

Для пагинации нужно знать **общее количество** транзакций/трансферов для адреса, чтобы вычислить количество страниц.

**Медленный способ:**
```sql
-- Каждый раз считает все строки (медленно на больших объёмах)
SELECT COUNT(*) FROM transfer WHERE from_id = '5D...' OR to_id = '5D...';
```

**Быстрый способ (наше решение):**
- ✅ Таблица `address_stats` с pre-computed счётчиками
- ✅ Автоматическое обновление через triggers
- ✅ Helper функции для гибких запросов

---

## Решение 1: Таблица `address_stats` (самый быстрый)

### Структура таблицы

```sql
CREATE TABLE address_stats (
  address           TEXT PRIMARY KEY,
  tx_count          INT NOT NULL DEFAULT 0,        -- Транзакции отправленные
  transfer_sent     INT NOT NULL DEFAULT 0,        -- Трансферы отправленные
  transfer_received INT NOT NULL DEFAULT 0,        -- Трансферы полученные
  contract_calls    INT NOT NULL DEFAULT 0,        -- Contract interactions
  first_seen        TIMESTAMPTZ,
  last_seen         TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Как работает

**Автоматическое обновление через triggers:**
- При каждом новом `extrinsic` → обновляется `tx_count`
- При каждом новом `transfer` → обновляется `transfer_sent` и `transfer_received`
- При каждом новом `contract_call` → обновляется `contract_calls`

### Примеры запросов

#### 1. Получить общее количество трансферов для адреса

```graphql
query GetAddressStats($address: String!) {
  addressStats(where: { address: { _eq: $address } }) {
    address
    tx_count
    transfer_sent
    transfer_received
    contract_calls
    first_seen
    last_seen
  }
}
```

**Результат:**
```json
{
  "addressStats": [{
    "address": "5DTestAddress...",
    "tx_count": 1234,
    "transfer_sent": 567,
    "transfer_received": 890,
    "contract_calls": 45,
    "first_seen": "2024-01-01T00:00:00Z",
    "last_seen": "2024-02-15T10:00:00Z"
  }]
}
```

**Вычисление страниц:**
```typescript
const stats = data.addressStats[0];
const totalTransfers = stats.transfer_sent + stats.transfer_received;
const pageSize = 20;
const totalPages = Math.ceil(totalTransfers / pageSize);
```

#### 2. Топ адресов по активности

```graphql
query TopActiveAddresses($limit: Int = 100) {
  addressStats(
    order_by: { tx_count: desc }
    limit: $limit
  ) {
    address
    tx_count
    transfer_sent
    transfer_received
    last_seen
  }
}
```

#### 3. Недавно активные адреса

```graphql
query RecentlyActiveAddresses($limit: Int = 50) {
  addressStats(
    order_by: { last_seen: desc }
    limit: $limit
  ) {
    address
    tx_count
    last_seen
  }
}
```

---

## Решение 2: Helper функции (гибкие фильтры)

Для более сложных запросов с фильтрами (по токену, направлению) используй функции:

### 1. `get_transfer_count()` — подсчёт трансферов

```sql
-- Все трансферы (отправленные + полученные)
SELECT get_transfer_count('5DTestAddress...', 'any', NULL);

-- Только отправленные
SELECT get_transfer_count('5DTestAddress...', 'sent', NULL);

-- Только полученные
SELECT get_transfer_count('5DTestAddress...', 'received', NULL);

-- Трансферы конкретного токена
SELECT get_transfer_count('5DTestAddress...', 'any', '0xTokenAddress...');
```

**Hasura query:**
```graphql
query GetTransferCount($address: String!, $direction: String!, $tokenId: String) {
  get_transfer_count(args: {
    addr: $address,
    direction: $direction,
    token_filter: $tokenId
  })
}
```

### 2. `get_extrinsic_count()` — подсчёт транзакций

```sql
-- Только успешные транзакции
SELECT get_extrinsic_count('5DTestAddress...', true);

-- Все транзакции (включая failed)
SELECT get_extrinsic_count('5DTestAddress...', false);
```

**Hasura query:**
```graphql
query GetExtrinsicCount($address: String!, $successOnly: Boolean!) {
  get_extrinsic_count(args: {
    addr: $address,
    success_only: $successOnly
  })
}
```

---

## Решение 3: Aggregate queries (для сложных фильтров)

Если нужны фильтры, которые не покрыты функциями:

### Пример: Count с фильтром по дате

```graphql
query GetTransferCountWithDateFilter(
  $address: String!,
  $fromDate: timestamptz!,
  $toDate: timestamptz!
) {
  transferAggregate(
    where: {
      _or: [
        { from_id: { _eq: $address } },
        { to_id: { _eq: $address } }
      ],
      timestamp: { _gte: $fromDate, _lte: $toDate }
    }
  ) {
    aggregate {
      count
    }
  }
}
```

### Пример: Count с фильтром по типу токена

```graphql
query GetERC20TransferCount($address: String!) {
  transferAggregate(
    where: {
      _or: [
        { from_id: { _eq: $address } },
        { to_id: { _eq: $address } }
      ],
      type: { _eq: "ERC20" }
    }
  ) {
    aggregate {
      count
    }
  }
}
```

---

## Производительность

### Сравнение методов

| Метод | Скорость | Гибкость | Когда использовать |
|-------|----------|----------|-------------------|
| `address_stats` таблица | ⚡⚡⚡ Мгновенно | ⭐ Базовые счётчики | Общий count для пагинации |
| Helper функции | ⚡⚡ Быстро | ⭐⭐ Фильтры по токену/направлению | Count с простыми фильтрами |
| Aggregate queries | ⚡ Медленно | ⭐⭐⭐ Любые фильтры | Сложные фильтры (дата, тип, etc.) |

### Рекомендации

**Для пагинации (главная страница адреса):**
```typescript
// 1. Получить быстрый count из address_stats
const { data } = await client.query({
  query: GET_ADDRESS_STATS,
  variables: { address }
});

const totalTransfers = data.addressStats[0].transfer_sent + 
                       data.addressStats[0].transfer_received;
const totalPages = Math.ceil(totalTransfers / pageSize);

// 2. Загрузить страницу с трансферами
const { data: transfers } = await client.query({
  query: GET_TRANSFERS_PAGINATED,
  variables: { 
    address, 
    limit: pageSize, 
    offset: currentPage * pageSize 
  }
});
```

**Для фильтрованной пагинации (по токену):**
```typescript
// Используй helper функцию
const { data } = await client.query({
  query: GET_TRANSFER_COUNT_WITH_TOKEN,
  variables: { 
    address, 
    direction: 'any',
    tokenId: selectedToken 
  }
});

const totalPages = Math.ceil(data.get_transfer_count / pageSize);
```

---

## Примеры для Frontend

### React Hook для пагинации

```typescript
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';

const GET_ADDRESS_STATS = gql`
  query GetAddressStats($address: String!) {
    addressStats(where: { address: { _eq: $address } }) {
      transfer_sent
      transfer_received
      tx_count
    }
  }
`;

const GET_TRANSFERS_PAGINATED = gql`
  query GetTransfersPaginated(
    $address: String!,
    $limit: Int!,
    $offset: Int!
  ) {
    transfers(
      where: {
        _or: [
          { from_id: { _eq: $address } },
          { to_id: { _eq: $address } }
        ]
      },
      order_by: { timestamp: desc },
      limit: $limit,
      offset: $offset
    ) {
      id
      from_id
      to_id
      amount
      timestamp
      token {
        name
      }
    }
  }
`;

export function useAddressTransfers(address: string, pageSize: number = 20) {
  const [currentPage, setCurrentPage] = useState(0);

  // Получить count
  const { data: statsData } = useQuery(GET_ADDRESS_STATS, {
    variables: { address },
    skip: !address,
  });

  // Вычислить total pages
  const totalTransfers = statsData?.addressStats[0]
    ? statsData.addressStats[0].transfer_sent + 
      statsData.addressStats[0].transfer_received
    : 0;
  
  const totalPages = Math.ceil(totalTransfers / pageSize);

  // Получить текущую страницу
  const { data, loading, error } = useQuery(GET_TRANSFERS_PAGINATED, {
    variables: {
      address,
      limit: pageSize,
      offset: currentPage * pageSize,
    },
    skip: !address,
  });

  return {
    transfers: data?.transfers || [],
    loading,
    error,
    currentPage,
    totalPages,
    totalTransfers,
    setPage: setCurrentPage,
    hasNextPage: currentPage < totalPages - 1,
    hasPrevPage: currentPage > 0,
  };
}
```

### Использование в компоненте

```typescript
function AddressPage({ address }: { address: string }) {
  const {
    transfers,
    loading,
    currentPage,
    totalPages,
    totalTransfers,
    setPage,
    hasNextPage,
    hasPrevPage,
  } = useAddressTransfers(address, 20);

  return (
    <div>
      <h1>Transfers for {address}</h1>
      <p>Total: {totalTransfers} transfers</p>
      
      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          <TransferTable transfers={transfers} />
          
          <Pagination
            currentPage={currentPage + 1}
            totalPages={totalPages}
            onPageChange={(page) => setPage(page - 1)}
            hasNext={hasNextPage}
            hasPrev={hasPrevPage}
          />
        </>
      )}
    </div>
  );
}
```

---

## Обслуживание

### Обновление materialized views

```sql
-- Обновить дневную статистику (запускать раз в день)
REFRESH MATERIALIZED VIEW CONCURRENTLY daily_stats;

-- Обновить топ токенов (запускать каждый час)
REFRESH MATERIALIZED VIEW CONCURRENTLY top_tokens_24h;
```

**Автоматизация через cron:**
```bash
# Добавить в crontab
0 1 * * * psql -U reef -d reef_explorer -c "REFRESH MATERIALIZED VIEW CONCURRENTLY daily_stats;"
0 * * * * psql -U reef -d reef_explorer -c "REFRESH MATERIALIZED VIEW CONCURRENTLY top_tokens_24h;"
```

### Пересчёт address_stats (если нужно)

```sql
-- Пересчитать все счётчики (только если данные сбились)
TRUNCATE address_stats;

-- Заполнить из extrinsics
INSERT INTO address_stats (address, tx_count, first_seen, last_seen)
SELECT 
  signer_id as address,
  COUNT(*) as tx_count,
  MIN(timestamp) as first_seen,
  MAX(timestamp) as last_seen
FROM extrinsic
WHERE signer_id IS NOT NULL
GROUP BY signer_id;

-- Обновить transfer counts
WITH transfer_counts AS (
  SELECT 
    from_id as address,
    COUNT(*) as sent_count
  FROM transfer
  GROUP BY from_id
)
UPDATE address_stats
SET transfer_sent = tc.sent_count
FROM transfer_counts tc
WHERE address_stats.address = tc.address;

-- И так далее для других счётчиков...
```

---

## Итого

**Для пагинации используй:**
1. ✅ `address_stats` таблица — для быстрого count без фильтров
2. ✅ Helper функции — для count с базовыми фильтрами (токен, направление)
3. ✅ Aggregate queries — только для сложных фильтров

**Преимущества:**
- ⚡ Мгновенный count (без сканирования всей таблицы)
- 🔄 Автоматическое обновление через triggers
- 📊 Дополнительная статистика (first_seen, last_seen)
- 🎯 Поддержка всех типов пагинации

**Схема готова к production!** 🚀

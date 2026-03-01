# Анализ запросов для Reef Explorer

## Текущие страницы и их запросы

### 1. **Home Page (Network Statistics)**

**Текущие метрики:**
- ✅ Tx/min (Live) — `extrinsics` subscription
- ✅ Total Staked — `eraValidatorInfos` query
- ✅ REEF Price — external API
- ✅ Active Wallets 24h — ICP canister
- ✅ New Wallets Inflow — ICP canister

**Дополнительные метрики (могут понадобиться):**

```sql
-- Total Transactions (all time)
SELECT COUNT(*) FROM extrinsic;

-- Total Addresses
SELECT COUNT(*) FROM account WHERE active = true;

-- Total Contracts
SELECT COUNT(*) FROM verified_contract;

-- Total NFTs
SELECT COUNT(*) FROM nft_metadata;

-- Average Block Time (last 1000 blocks)
SELECT AVG(
  EXTRACT(EPOCH FROM (timestamp - LAG(timestamp) OVER (ORDER BY height)))
) as avg_block_time
FROM block
WHERE height > (SELECT MAX(height) - 1000 FROM block);

-- Network Hashrate / Validator Count
SELECT COUNT(DISTINCT author) as active_validators
FROM block
WHERE timestamp > NOW() - INTERVAL '24 hours';

-- Total Value Locked (TVL) in REEF
SELECT SUM(free_balance + locked_balance) / 1e18 as total_reef
FROM account;

-- Daily Transaction Volume
SELECT 
  DATE(timestamp) as date,
  COUNT(*) as tx_count,
  COUNT(DISTINCT signer_id) as unique_users
FROM extrinsic
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY DATE(timestamp)
ORDER BY date DESC;

-- Top Gas Spenders (last 24h)
SELECT 
  signer_id,
  SUM(fee::numeric) / 1e18 as total_fees_reef,
  COUNT(*) as tx_count
FROM extrinsic
WHERE timestamp > NOW() - INTERVAL '24 hours'
  AND fee IS NOT NULL
GROUP BY signer_id
ORDER BY total_fees_reef DESC
LIMIT 10;
```

**Нужные таблицы:** ✅ Все есть

---

### 2. **Block Explorer Page**

**Запросы:**

```sql
-- Latest Blocks (with pagination)
SELECT 
  height,
  hash,
  timestamp,
  author,
  extrinsic_count,
  event_count
FROM block
ORDER BY height DESC
LIMIT 20 OFFSET 0;

-- Block Details by Height
SELECT * FROM block WHERE height = 12345;

-- Block Details by Hash
SELECT * FROM block WHERE hash = '0x...';

-- Extrinsics in Block
SELECT 
  e.*,
  a.evm_address as signer_evm
FROM extrinsic e
LEFT JOIN account a ON e.signer_id = a.id
WHERE e.block_height = 12345
ORDER BY e.extrinsic_index;

-- Events in Block
SELECT * FROM event
WHERE block_height = 12345
ORDER BY event_index;

-- Transfers in Block
SELECT 
  t.*,
  vc.name as token_name,
  vc.contract_data as token_metadata
FROM transfer t
LEFT JOIN verified_contract vc ON t.token_id = vc.id
WHERE t.block_height = 12345
ORDER BY t.event_index;
```

**Нужные таблицы:** ✅ `block`, `extrinsic`, `event`, `transfer`

**Нужные индексы:** ✅ Все есть

---

### 3. **Transaction Details Page**

**Запросы:**

```sql
-- Transaction by Hash
SELECT 
  e.*,
  b.timestamp as block_timestamp,
  a.evm_address as signer_evm
FROM extrinsic e
JOIN block b ON e.block_height = b.height
LEFT JOIN account a ON e.signer_id = a.id
WHERE e.hash = '0x...';

-- Events for Transaction
SELECT * FROM event
WHERE extrinsic_id = '0000012345-abc12-001'
ORDER BY event_index;

-- Transfers in Transaction
SELECT 
  t.*,
  vc.name as token_name,
  from_acc.evm_address as from_evm,
  to_acc.evm_address as to_evm
FROM transfer t
LEFT JOIN verified_contract vc ON t.token_id = vc.id
LEFT JOIN account from_acc ON t.from_id = from_acc.id
LEFT JOIN account to_acc ON t.to_id = to_acc.id
WHERE t.extrinsic_hash = '0x...';

-- Contract Calls in Transaction
SELECT 
  cc.*,
  vc.name as contract_name
FROM contract_call cc
LEFT JOIN verified_contract vc ON cc.to_id = vc.id
WHERE cc.extrinsic_id = '0000012345-abc12-001';
```

**Нужные таблицы:** ✅ Все есть

---

### 4. **Address Page (Wallet)**

**Текущие запросы:**
- ✅ Transfers (paginated)
- ✅ Token balances
- ✅ NFTs owned
- ✅ Staking rewards

**Дополнительные запросы:**

```sql
-- Address Overview
SELECT 
  id,
  evm_address,
  free_balance,
  locked_balance,
  available_balance,
  reserved_balance,
  nonce,
  evm_nonce,
  timestamp as first_seen
FROM account
WHERE id = '5D...' OR evm_address = '0x...';

-- Transaction Count (sent + received)
SELECT 
  COUNT(DISTINCT CASE WHEN signer_id = '5D...' THEN id END) as sent_count,
  COUNT(DISTINCT e.id) as total_interactions
FROM extrinsic e
WHERE signer_id = '5D...';

-- First and Last Activity
SELECT 
  MIN(timestamp) as first_activity,
  MAX(timestamp) as last_activity
FROM extrinsic
WHERE signer_id = '5D...';

-- Contract Interactions
SELECT 
  cc.to_id as contract_address,
  vc.name as contract_name,
  COUNT(*) as interaction_count,
  MAX(cc.timestamp) as last_interaction
FROM contract_call cc
LEFT JOIN verified_contract vc ON cc.to_id = vc.id
WHERE cc.from_id = '5D...'
GROUP BY cc.to_id, vc.name
ORDER BY interaction_count DESC;

-- Gas Spent (total fees)
SELECT 
  SUM(fee::numeric) / 1e18 as total_fees_reef,
  COUNT(*) as tx_count,
  AVG(fee::numeric) / 1e18 as avg_fee_reef
FROM extrinsic
WHERE signer_id = '5D...';

-- Token Transfer Summary
SELECT 
  t.token_id,
  vc.name as token_name,
  COUNT(CASE WHEN t.from_id = '5D...' THEN 1 END) as sent_count,
  COUNT(CASE WHEN t.to_id = '5D...' THEN 1 END) as received_count,
  SUM(CASE WHEN t.from_id = '5D...' THEN t.amount::numeric ELSE 0 END) as total_sent,
  SUM(CASE WHEN t.to_id = '5D...' THEN t.amount::numeric ELSE 0 END) as total_received
FROM transfer t
LEFT JOIN verified_contract vc ON t.token_id = vc.id
WHERE t.from_id = '5D...' OR t.to_id = '5D...'
GROUP BY t.token_id, vc.name;

-- Staking Summary
SELECT 
  type,
  COUNT(*) as event_count,
  SUM(amount::numeric) / 1e18 as total_amount_reef,
  MAX(timestamp) as last_event
FROM staking
WHERE signer_id = '5D...'
GROUP BY type;
```

**Нужные таблицы:** ✅ Все есть

**Дополнительные индексы (для производительности):**

```sql
-- Для быстрого подсчёта транзакций
CREATE INDEX idx_extrinsic_signer_count ON extrinsic (signer_id) WHERE success = true;

-- Для contract interactions
CREATE INDEX idx_contract_call_from_to ON contract_call (from_id, to_id);

-- Для gas analytics
CREATE INDEX idx_extrinsic_fee ON extrinsic (fee) WHERE fee IS NOT NULL;
```

---

### 5. **Token/Contract Page**

**Запросы:**

```sql
-- Token Overview
SELECT 
  id,
  name,
  type,
  contract_data,
  timestamp as deployed_at
FROM verified_contract
WHERE id = '0x...';

-- Token Holders Count
SELECT COUNT(*) as holder_count
FROM token_holder
WHERE token_id = '0x...' AND balance > 0;

-- Top Holders
SELECT 
  th.signer_id,
  a.evm_address,
  th.balance,
  (th.balance::numeric / total.supply * 100) as percentage
FROM token_holder th
LEFT JOIN account a ON th.signer_id = a.id
CROSS JOIN (
  SELECT SUM(balance::numeric) as supply
  FROM token_holder
  WHERE token_id = '0x...'
) total
WHERE th.token_id = '0x...'
  AND th.balance > 0
ORDER BY th.balance DESC
LIMIT 100;

-- Token Transfers (recent)
SELECT 
  t.*,
  from_acc.evm_address as from_evm,
  to_acc.evm_address as to_evm
FROM transfer t
LEFT JOIN account from_acc ON t.from_id = from_acc.id
LEFT JOIN account to_acc ON t.to_id = to_acc.id
WHERE t.token_id = '0x...'
ORDER BY t.timestamp DESC
LIMIT 50;

-- Token Transfer Stats
SELECT 
  COUNT(*) as total_transfers,
  COUNT(DISTINCT from_id) as unique_senders,
  COUNT(DISTINCT to_id) as unique_receivers,
  SUM(amount::numeric) as total_volume
FROM transfer
WHERE token_id = '0x...';

-- Daily Transfer Volume
SELECT 
  DATE(timestamp) as date,
  COUNT(*) as transfer_count,
  SUM(amount::numeric) as volume
FROM transfer
WHERE token_id = '0x...'
  AND timestamp > NOW() - INTERVAL '30 days'
GROUP BY DATE(timestamp)
ORDER BY date DESC;

-- Contract Calls (for smart contracts)
SELECT 
  cc.*,
  a.evm_address as caller_evm,
  e.method,
  e.section
FROM contract_call cc
LEFT JOIN account a ON cc.from_id = a.id
LEFT JOIN extrinsic e ON cc.extrinsic_id = e.id
WHERE cc.to_id = '0x...'
ORDER BY cc.timestamp DESC
LIMIT 50;
```

**Нужные таблицы:** ✅ Все есть

---

### 6. **NFT Gallery Page**

**Запросы:**

```sql
-- NFT Collection Overview
SELECT 
  vc.id,
  vc.name,
  vc.contract_data,
  COUNT(DISTINCT nm.token_id) as total_nfts,
  COUNT(DISTINCT nm.owner_id) as unique_owners
FROM verified_contract vc
LEFT JOIN nft_metadata nm ON vc.id = nm.contract_id
WHERE vc.type IN ('ERC721', 'ERC1155')
GROUP BY vc.id, vc.name, vc.contract_data;

-- NFTs in Collection
SELECT 
  nm.*,
  a.evm_address as owner_evm,
  th.balance
FROM nft_metadata nm
LEFT JOIN account a ON nm.owner_id = a.id
LEFT JOIN token_holder th ON th.token_id = nm.contract_id 
  AND th.signer_id = nm.owner_id 
  AND th.nft_id = nm.token_id
WHERE nm.contract_id = '0x...'
ORDER BY nm.token_id
LIMIT 50 OFFSET 0;

-- NFT Details
SELECT 
  nm.*,
  a.evm_address as owner_evm,
  vc.name as collection_name
FROM nft_metadata nm
LEFT JOIN account a ON nm.owner_id = a.id
LEFT JOIN verified_contract vc ON nm.contract_id = vc.id
WHERE nm.id = '0x...-123';

-- NFT Transfer History
SELECT 
  t.*,
  from_acc.evm_address as from_evm,
  to_acc.evm_address as to_evm
FROM transfer t
LEFT JOIN account from_acc ON t.from_id = from_acc.id
LEFT JOIN account to_acc ON t.to_id = to_acc.id
WHERE t.token_id = '0x...' 
  AND t.nft_id = 123
ORDER BY t.timestamp DESC;

-- NFTs by Owner
SELECT 
  nm.*,
  vc.name as collection_name
FROM nft_metadata nm
LEFT JOIN verified_contract vc ON nm.contract_id = vc.id
WHERE nm.owner_id = '5D...'
ORDER BY nm.timestamp DESC;
```

**Нужные таблицы:** ✅ Все есть

---

### 7. **Staking/Validators Page**

**Запросы:**

```sql
-- Current Era Validators
SELECT 
  address,
  total,
  own,
  nominators_count,
  commission,
  blocked
FROM era_validator_info
WHERE era = (SELECT MAX(era) FROM era_validator_info)
ORDER BY total DESC;

-- Validator Details
SELECT * FROM era_validator_info
WHERE address = '5D...'
ORDER BY era DESC
LIMIT 100;

-- Validator Performance (rewards distributed)
SELECT 
  validator_id,
  COUNT(*) as reward_count,
  SUM(amount::numeric) / 1e18 as total_rewards_reef,
  AVG(amount::numeric) / 1e18 as avg_reward_reef
FROM staking
WHERE type = 'Reward'
  AND validator_id IS NOT NULL
  AND timestamp > NOW() - INTERVAL '30 days'
GROUP BY validator_id
ORDER BY total_rewards_reef DESC;

-- Staking Events by User
SELECT 
  type,
  amount,
  era,
  validator_id,
  timestamp
FROM staking
WHERE signer_id = '5D...'
ORDER BY timestamp DESC
LIMIT 100;

-- Total Staked by Era
SELECT 
  era,
  SUM(total) / 1e18 as total_staked_reef,
  COUNT(*) as validator_count,
  AVG(commission) as avg_commission
FROM era_validator_info
GROUP BY era
ORDER BY era DESC
LIMIT 100;

-- Nominator Count by Validator
SELECT 
  address,
  nominators_count,
  total / 1e18 as total_stake_reef,
  commission
FROM era_validator_info
WHERE era = (SELECT MAX(era) FROM era_validator_info)
ORDER BY nominators_count DESC;
```

**Нужные таблицы:** ✅ `era_validator_info`, `staking`

---

### 8. **Search Page**

**Запросы:**

```sql
-- Search by Block Number
SELECT * FROM block WHERE height = 12345;

-- Search by Block Hash
SELECT * FROM block WHERE hash = '0x...';

-- Search by Transaction Hash
SELECT * FROM extrinsic WHERE hash = '0x...';

-- Search by Address (Native or EVM)
SELECT * FROM account 
WHERE id = '5D...' OR evm_address = '0x...';

-- Search by Contract Address
SELECT * FROM verified_contract WHERE id = '0x...';

-- Search by Contract Name
SELECT * FROM verified_contract 
WHERE name ILIKE '%usdc%'
ORDER BY name
LIMIT 10;

-- Full-text search across multiple entities
-- (requires additional indexes)
```

**Нужные индексы:**

```sql
-- For contract name search
CREATE INDEX idx_verified_contract_name_trgm ON verified_contract 
USING gin (name gin_trgm_ops);

-- Requires pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

---

## Дополнительные таблицы (Nice to have)

### 1. **Daily Statistics (Materialized View)**

```sql
CREATE MATERIALIZED VIEW daily_stats AS
SELECT 
  DATE(timestamp) as date,
  COUNT(DISTINCT e.id) as tx_count,
  COUNT(DISTINCT e.signer_id) as active_users,
  COUNT(DISTINCT b.height) as block_count,
  SUM(e.fee::numeric) / 1e18 as total_fees_reef,
  COUNT(DISTINCT CASE WHEN t.type = 'ERC20' THEN t.id END) as erc20_transfers,
  COUNT(DISTINCT CASE WHEN t.type IN ('ERC721', 'ERC1155') THEN t.id END) as nft_transfers
FROM block b
LEFT JOIN extrinsic e ON b.height = e.block_height
LEFT JOIN transfer t ON b.height = t.block_height
GROUP BY DATE(timestamp);

-- Refresh daily
CREATE INDEX idx_daily_stats_date ON daily_stats (date DESC);
```

### 2. **Token Price History** (если нужно)

```sql
CREATE TABLE token_price_history (
  id SERIAL PRIMARY KEY,
  token_id TEXT NOT NULL REFERENCES verified_contract(id),
  price_usd NUMERIC NOT NULL,
  price_reef NUMERIC,
  volume_24h NUMERIC,
  market_cap NUMERIC,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_token_price_token_ts ON token_price_history (token_id, timestamp DESC);
```

### 3. **Address Labels** (для known addresses)

```sql
CREATE TABLE address_label (
  address TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  category TEXT, -- 'exchange', 'contract', 'validator', 'whale', etc.
  description TEXT,
  verified BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_address_label_category ON address_label (category);
```

### 4. **Contract ABI Storage**

```sql
CREATE TABLE contract_abi (
  contract_id TEXT PRIMARY KEY REFERENCES verified_contract(id),
  abi JSONB NOT NULL,
  compiler_version TEXT,
  optimization BOOLEAN,
  runs INT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Performance Optimization

### Materialized Views для тяжёлых запросов

```sql
-- Top Tokens by Volume
CREATE MATERIALIZED VIEW top_tokens_24h AS
SELECT 
  t.token_id,
  vc.name,
  COUNT(*) as transfer_count,
  COUNT(DISTINCT t.from_id) as unique_senders,
  COUNT(DISTINCT t.to_id) as unique_receivers,
  SUM(t.amount::numeric) as volume
FROM transfer t
LEFT JOIN verified_contract vc ON t.token_id = vc.id
WHERE t.timestamp > NOW() - INTERVAL '24 hours'
GROUP BY t.token_id, vc.name
ORDER BY transfer_count DESC;

-- Refresh every hour
CREATE INDEX idx_top_tokens_24h ON top_tokens_24h (transfer_count DESC);
```

### Partitioning для больших таблиц

```sql
-- Partition transfer table by month (for future scaling)
CREATE TABLE transfer_2024_01 PARTITION OF transfer
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Partition event table by month
CREATE TABLE event_2024_01 PARTITION OF event
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

---

## Итого: Что добавить

### 🔥 Критично (добавить обязательно):
1. ✅ Все основные таблицы уже есть
2. ✅ Индексы для основных запросов есть
3. ➕ **Дополнительные индексы:**
   - `idx_extrinsic_signer_count`
   - `idx_contract_call_from_to`
   - `idx_extrinsic_fee`
   - `idx_verified_contract_name_trgm` (для поиска)

### 🌟 Важно (желательно):
4. ➕ **Materialized View:** `daily_stats`
5. ➕ **Materialized View:** `top_tokens_24h`
6. ➕ **Table:** `address_label` (для known addresses)

### 💡 Nice to have:
7. ➕ **Table:** `token_price_history`
8. ➕ **Table:** `contract_abi`
9. ➕ **Partitioning** для transfer/event (для будущего масштабирования)

---

**Схема практически полная! Нужно только добавить несколько индексов и materialized views для производительности** 🚀

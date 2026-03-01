-- ============================================================
-- Hasura Metadata & Permissions для Production
-- ============================================================
-- Применить: psql -U reef -d reef_explorer -f hasura-metadata.sql

-- ─── Public Read-Only Permissions ───────────────────────────
-- Если хочешь публичный доступ без auth, раскомментируй:

-- Разрешить чтение всех таблиц для роли 'public'
-- INSERT INTO hdb_catalog.hdb_permission (table_schema, table_name, role_name, perm_type, perm_def, comment)
-- VALUES 
--   ('public', 'account', 'public', 'select', '{"columns": ["id", "evm_address", "free_balance", "locked_balance", "available_balance", "timestamp"], "filter": {}}', 'Public read access'),
--   ('public', 'verified_contract', 'public', 'select', '{"columns": ["id", "name", "type", "contract_data", "approved", "timestamp"], "filter": {"approved": {"_eq": true}}}', 'Only approved contracts'),
--   ('public', 'transfer', 'public', 'select', '{"columns": ["id", "block_height", "block_hash", "from_id", "to_id", "token_id", "from_evm_address", "to_evm_address", "type", "reefswap_action", "amount", "nft_id", "success", "timestamp"], "filter": {"success": {"_eq": true}}}', 'Only successful transfers'),
--   ('public', 'token_holder', 'public', 'select', '{"columns": ["id", "token_id", "signer_id", "evm_address", "nft_id", "type", "balance", "timestamp"], "filter": {}}', 'Public read access'),
--   ('public', 'staking', 'public', 'select', '{"columns": ["id", "signer_id", "type", "amount", "timestamp"], "filter": {}}', 'Public read access');

-- ─── Computed Fields для удобных запросов ──────────────────

-- 1. Баланс REEF токена для account
CREATE OR REPLACE FUNCTION account_reef_balance(account_row account)
RETURNS NUMERIC AS $$
  SELECT COALESCE(balance, 0)
  FROM token_holder
  WHERE signer_id = account_row.id
    AND token_id = '0x0000000000000000000000000000000001000000'
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- 2. Количество transfers для account
CREATE OR REPLACE FUNCTION account_transfer_count(account_row account)
RETURNS BIGINT AS $$
  SELECT COUNT(*)
  FROM transfer
  WHERE from_id = account_row.id OR to_id = account_row.id;
$$ LANGUAGE sql STABLE;

-- 3. Последняя активность account
CREATE OR REPLACE FUNCTION account_last_activity(account_row account)
RETURNS TIMESTAMPTZ AS $$
  SELECT MAX(timestamp)
  FROM transfer
  WHERE from_id = account_row.id OR to_id = account_row.id;
$$ LANGUAGE sql STABLE;

-- ─── Materialized Views для тяжёлых агрегаций ──────────────

-- Top holders по REEF токену (обновлять раз в час)
CREATE MATERIALIZED VIEW IF NOT EXISTS top_reef_holders AS
SELECT 
  th.signer_id,
  th.balance,
  a.evm_address,
  th.timestamp
FROM token_holder th
JOIN account a ON a.id = th.signer_id
WHERE th.token_id = '0x0000000000000000000000000000000001000000'
  AND th.balance > 0
ORDER BY th.balance DESC
LIMIT 1000;

CREATE UNIQUE INDEX idx_top_reef_holders_signer ON top_reef_holders (signer_id);

-- Refresh команда (запускать по cron):
-- REFRESH MATERIALIZED VIEW CONCURRENTLY top_reef_holders;

-- ─── Дополнительные индексы для частых запросов ────────────

-- Поиск по EVM адресу (для wallet lookup)
CREATE INDEX IF NOT EXISTS idx_account_evm_address_lower ON account (LOWER(evm_address));

-- Transfers за последние N дней (для dashboard)
CREATE INDEX IF NOT EXISTS idx_transfer_recent ON transfer (timestamp DESC) WHERE timestamp > NOW() - INTERVAL '30 days';

-- Token holders с ненулевым балансом
CREATE INDEX IF NOT EXISTS idx_token_holder_nonzero ON token_holder (token_id, balance DESC) WHERE balance > 0;

-- Swap активность (для analytics)
CREATE INDEX IF NOT EXISTS idx_transfer_swap_timestamp ON transfer (reefswap_action, timestamp DESC) WHERE reefswap_action IS NOT NULL;

-- NFT transfers (для NFT explorer)
CREATE INDEX IF NOT EXISTS idx_transfer_nft ON transfer (token_id, nft_id, timestamp DESC) WHERE nft_id IS NOT NULL;

-- ─── Аналитические Views ───────────────────────────────────

-- Дневная статистика transfers
CREATE OR REPLACE VIEW daily_transfer_stats AS
SELECT 
  DATE(timestamp) AS date,
  COUNT(*) AS total_transfers,
  COUNT(DISTINCT from_id) AS unique_senders,
  COUNT(DISTINCT to_id) AS unique_receivers,
  SUM(CASE WHEN type = 'ERC20' THEN 1 ELSE 0 END) AS erc20_transfers,
  SUM(CASE WHEN type IN ('ERC721', 'ERC1155') THEN 1 ELSE 0 END) AS nft_transfers,
  SUM(CASE WHEN reefswap_action IS NOT NULL THEN 1 ELSE 0 END) AS swap_transfers
FROM transfer
WHERE success = true
GROUP BY DATE(timestamp)
ORDER BY date DESC;

-- Топ токенов по активности
CREATE OR REPLACE VIEW top_tokens_by_activity AS
SELECT 
  vc.id AS token_id,
  vc.name,
  vc.type,
  vc.contract_data,
  COUNT(t.id) AS transfer_count,
  COUNT(DISTINCT t.from_id) + COUNT(DISTINCT t.to_id) AS unique_users,
  MAX(t.timestamp) AS last_activity
FROM verified_contract vc
LEFT JOIN transfer t ON t.token_id = vc.id AND t.success = true
WHERE vc.type IN ('ERC20', 'ERC721', 'ERC1155')
GROUP BY vc.id, vc.name, vc.type, vc.contract_data
ORDER BY transfer_count DESC;

-- ============================================================
-- Применение в Hasura Console:
-- 1. Data -> SQL -> выполнить этот файл
-- 2. Data -> Track -> отметить новые views/functions
-- 3. API -> GraphQL -> протестировать новые queries
-- ============================================================

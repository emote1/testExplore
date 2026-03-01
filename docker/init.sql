-- ============================================================
-- Reef Explorer — PostgreSQL schema for Hasura
-- Matches subsquid-processor schema.graphql
-- ============================================================

-- ======================== ACCOUNTS ==========================
CREATE TABLE account (
  id            TEXT PRIMARY KEY,          -- Native (SS58) address
  evm_address   TEXT,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  free_balance  NUMERIC NOT NULL DEFAULT 0,
  locked_balance NUMERIC NOT NULL DEFAULT 0,
  available_balance NUMERIC NOT NULL DEFAULT 0,
  reserved_balance NUMERIC NOT NULL DEFAULT 0,
  nonce         INT NOT NULL DEFAULT 0,
  evm_nonce     INT NOT NULL DEFAULT 0,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_account_evm_address ON account (evm_address);
CREATE INDEX idx_account_active ON account (active);

-- =================== VERIFIED CONTRACTS =====================
CREATE TABLE verified_contract (
  id                TEXT PRIMARY KEY,       -- Contract address
  name              TEXT NOT NULL DEFAULT '',
  filename          TEXT,
  source            JSONB,
  optimization      BOOLEAN NOT NULL DEFAULT FALSE,
  compiler_version  TEXT NOT NULL DEFAULT '',
  compiled_data     JSONB,
  args              JSONB,
  runs              INT NOT NULL DEFAULT 200,
  target            TEXT NOT NULL DEFAULT '',
  type              TEXT,                   -- ERC20, ERC721, ERC1155, other
  contract_data     JSONB,                  -- token metadata (name, symbol, decimals, icon)
  license           TEXT,
  approved          BOOLEAN DEFAULT TRUE,
  timestamp         TIMESTAMPTZ
);

CREATE INDEX idx_vc_name ON verified_contract (name);
CREATE INDEX idx_vc_type ON verified_contract (type);

-- ====================== TRANSFERS ===========================
CREATE TABLE transfer (
  id               TEXT PRIMARY KEY,        -- 000..blockNum-hash-index
  block_height     INT NOT NULL,
  block_hash       TEXT NOT NULL,
  finalized        BOOLEAN NOT NULL DEFAULT TRUE,
  extrinsic_id     TEXT,
  extrinsic_hash   TEXT,
  extrinsic_index  INT NOT NULL DEFAULT 0,
  event_index      INT NOT NULL DEFAULT 0,
  signed_data      JSONB,
  from_id          TEXT NOT NULL REFERENCES account(id),
  to_id            TEXT NOT NULL REFERENCES account(id),
  token_id         TEXT NOT NULL REFERENCES verified_contract(id),
  from_evm_address TEXT,
  to_evm_address   TEXT,
  type             TEXT NOT NULL DEFAULT 'Native',  -- Native, ERC20, ERC721, ERC1155
  reefswap_action  TEXT,                            -- AddLiquidity, RemoveLiquidity, Swap, NULL
  amount           NUMERIC NOT NULL DEFAULT 0,
  denom            TEXT,
  nft_id           NUMERIC,
  error_message    TEXT,
  success          BOOLEAN NOT NULL DEFAULT TRUE,
  timestamp        TIMESTAMPTZ NOT NULL
);

-- Primary query pattern: transfers by address sorted by time
CREATE INDEX idx_transfer_from_ts ON transfer (from_id, timestamp DESC);
CREATE INDEX idx_transfer_to_ts ON transfer (to_id, timestamp DESC);
CREATE INDEX idx_transfer_from_evm_ts ON transfer (from_evm_address, timestamp DESC);
CREATE INDEX idx_transfer_to_evm_ts ON transfer (to_evm_address, timestamp DESC);

-- Filter by token
CREATE INDEX idx_transfer_token ON transfer (token_id);
CREATE INDEX idx_transfer_token_ts ON transfer (token_id, timestamp DESC);

-- Filter by amount (for min/max REEF filter)
CREATE INDEX idx_transfer_amount ON transfer (amount);

-- Sorting by timestamp (main sort)
CREATE INDEX idx_transfer_timestamp ON transfer (timestamp DESC);

-- Block height for finalization tracking
CREATE INDEX idx_transfer_block_height ON transfer (block_height);

-- Success filter
CREATE INDEX idx_transfer_success ON transfer (success);

-- Reefswap action filter (swap detection)
CREATE INDEX idx_transfer_reefswap ON transfer (reefswap_action) WHERE reefswap_action IS NOT NULL;

-- ==================== TOKEN HOLDERS =========================
CREATE TABLE token_holder (
  id           TEXT PRIMARY KEY,            -- <tokenAddr>-<signerAddr>-<nftId>
  token_id     TEXT NOT NULL REFERENCES verified_contract(id),
  signer_id    TEXT REFERENCES account(id),
  evm_address  TEXT,
  nft_id       NUMERIC,
  type         TEXT NOT NULL DEFAULT 'Account',  -- Account, Contract
  balance      NUMERIC NOT NULL DEFAULT 0,
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_th_signer ON token_holder (signer_id);
CREATE INDEX idx_th_token ON token_holder (token_id);
CREATE INDEX idx_th_balance ON token_holder (balance DESC);
CREATE INDEX idx_th_signer_balance ON token_holder (signer_id, balance DESC);

-- ====================== BLOCKS =============================
CREATE TABLE block (
  height          INT PRIMARY KEY,
  hash            TEXT NOT NULL UNIQUE,
  parent_hash     TEXT,
  state_root      TEXT,
  extrinsics_root TEXT,
  author          TEXT,                    -- validator who produced block
  extrinsic_count INT DEFAULT 0,
  event_count     INT DEFAULT 0,
  timestamp       TIMESTAMPTZ NOT NULL,
  processor_timestamp TIMESTAMPTZ         -- when indexer processed this block
);

CREATE INDEX idx_block_hash ON block (hash);
CREATE INDEX idx_block_author ON block (author);
CREATE INDEX idx_block_timestamp ON block (timestamp DESC);
CREATE INDEX idx_block_processor_timestamp ON block (processor_timestamp DESC);

-- ==================== EXTRINSICS ============================
CREATE TABLE extrinsic (
  id              TEXT PRIMARY KEY,        -- blockNum-extrinsicIndex
  block_height    INT NOT NULL REFERENCES block(height),
  block_hash      TEXT NOT NULL,
  extrinsic_index INT NOT NULL,
  hash            TEXT NOT NULL,
  signer_id       TEXT REFERENCES account(id),
  method          TEXT NOT NULL,           -- transfer, call, bond, etc.
  section         TEXT NOT NULL,           -- balances, evm, staking, etc.
  args            JSONB,
  signature       TEXT,
  nonce           INT,
  tip             NUMERIC DEFAULT 0,
  fee             NUMERIC DEFAULT 0,
  success         BOOLEAN NOT NULL DEFAULT TRUE,
  error_message   TEXT,
  timestamp       TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_extrinsic_block ON extrinsic (block_height);
CREATE INDEX idx_extrinsic_signer ON extrinsic (signer_id, timestamp DESC);
CREATE INDEX idx_extrinsic_hash ON extrinsic (hash);
CREATE INDEX idx_extrinsic_method ON extrinsic (section, method);
CREATE INDEX idx_extrinsic_timestamp ON extrinsic (timestamp DESC);
CREATE INDEX idx_extrinsic_success ON extrinsic (success);

-- ====================== EVENTS ==============================
CREATE TABLE event (
  id              TEXT PRIMARY KEY,        -- blockNum-eventIndex
  block_height    INT NOT NULL REFERENCES block(height),
  block_hash      TEXT NOT NULL,
  event_index     INT NOT NULL,
  extrinsic_id    TEXT REFERENCES extrinsic(id),
  section         TEXT NOT NULL,           -- balances, staking, evm, etc.
  method          TEXT NOT NULL,           -- Transfer, Reward, Log, etc.
  data            JSONB,
  timestamp       TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_event_block ON event (block_height);
CREATE INDEX idx_event_extrinsic ON event (extrinsic_id);
CREATE INDEX idx_event_method ON event (section, method);
CREATE INDEX idx_event_timestamp ON event (timestamp DESC);

-- ==================== STAKING ===============================
CREATE TABLE staking (
  id           TEXT PRIMARY KEY,
  signer_id    TEXT REFERENCES account(id),
  type         TEXT NOT NULL,              -- Reward, Slash, Bonded, Unbonded, Withdrawn
  amount       NUMERIC NOT NULL DEFAULT 0,
  era          INT,
  validator_id TEXT,
  timestamp    TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_staking_signer ON staking (signer_id);
CREATE INDEX idx_staking_type ON staking (type);
CREATE INDEX idx_staking_ts ON staking (timestamp DESC);
CREATE INDEX idx_staking_era ON staking (era DESC);
CREATE INDEX idx_staking_validator ON staking (validator_id);

-- =============== ERA VALIDATOR INFO =========================
CREATE TABLE era_validator_info (
  id               TEXT PRIMARY KEY,       -- era-validatorAddress
  era              INT NOT NULL,
  address          TEXT NOT NULL,
  total            NUMERIC NOT NULL,       -- total stake
  own              NUMERIC NOT NULL,       -- validator's own stake
  nominators_count INT NOT NULL DEFAULT 0,
  commission       NUMERIC,                -- commission %
  blocked          BOOLEAN DEFAULT FALSE,
  timestamp        TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_evi_era ON era_validator_info (era DESC);
CREATE INDEX idx_evi_address ON era_validator_info (address);
CREATE INDEX idx_evi_era_address ON era_validator_info (era, address);
CREATE INDEX idx_evi_total ON era_validator_info (total DESC);

-- ================= CONTRACT CALLS ===========================
CREATE TABLE contract_call (
  id              TEXT PRIMARY KEY,
  block_height    INT NOT NULL REFERENCES block(height),
  extrinsic_id    TEXT REFERENCES extrinsic(id),
  from_id         TEXT REFERENCES account(id),
  to_id           TEXT REFERENCES verified_contract(id),
  value           NUMERIC DEFAULT 0,
  gas_limit       NUMERIC,
  gas_used        NUMERIC,
  input           TEXT,                    -- calldata
  output          TEXT,                    -- return data
  success         BOOLEAN NOT NULL DEFAULT TRUE,
  error_message   TEXT,
  timestamp       TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_cc_from ON contract_call (from_id, timestamp DESC);
CREATE INDEX idx_cc_to ON contract_call (to_id, timestamp DESC);
CREATE INDEX idx_cc_block ON contract_call (block_height);
CREATE INDEX idx_cc_extrinsic ON contract_call (extrinsic_id);

-- ================= NFT METADATA =============================
CREATE TABLE nft_metadata (
  id              TEXT PRIMARY KEY,        -- contractAddress-tokenId
  contract_id     TEXT NOT NULL REFERENCES verified_contract(id),
  token_id        NUMERIC NOT NULL,
  owner_id        TEXT REFERENCES account(id),
  metadata_uri    TEXT,
  metadata        JSONB,                   -- name, description, image, attributes
  last_transfer   TIMESTAMPTZ,
  timestamp       TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_nft_contract ON nft_metadata (contract_id);
CREATE INDEX idx_nft_owner ON nft_metadata (owner_id);
CREATE INDEX idx_nft_token_id ON nft_metadata (contract_id, token_id);

-- ==================== INDEXER CURSOR ========================
CREATE TABLE indexer_cursor (
  id               TEXT PRIMARY KEY,        -- 'main' for primary indexer
  last_block       INT NOT NULL DEFAULT 0,
  last_block_hash  TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default cursor (will be updated by indexer on first run)
-- Note: indexer will use START_BLOCK env var if cursor is 0
INSERT INTO indexer_cursor (id, last_block) VALUES ('main', 0);

-- ============================================================
-- Composite indexes for common query patterns
-- ============================================================

-- Bulk counts: COUNT transfers by address (incoming/outgoing/all)
-- These cover the heaviest query from the frontend
CREATE INDEX idx_transfer_from_id ON transfer (from_id);
CREATE INDEX idx_transfer_to_id ON transfer (to_id);

-- Combined filter: address + token + amount range
CREATE INDEX idx_transfer_from_token_amount ON transfer (from_id, token_id, amount);
CREATE INDEX idx_transfer_to_token_amount ON transfer (to_id, token_id, amount);

-- ============================================================
-- Performance Indexes for Analytics
-- ============================================================

-- For counting transactions by signer (pagination)
CREATE INDEX idx_extrinsic_signer_success ON extrinsic (signer_id, success) WHERE success = true;

-- For contract interaction analytics
CREATE INDEX idx_contract_call_from_to ON contract_call (from_id, to_id);

-- For gas/fee analytics
CREATE INDEX idx_extrinsic_fee ON extrinsic (fee) WHERE fee IS NOT NULL AND fee != '0';

-- For full-text search on contract names
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_verified_contract_name_trgm ON verified_contract USING gin (name gin_trgm_ops);

-- For validator performance queries
CREATE INDEX idx_staking_validator_type ON staking (validator_id, type) WHERE validator_id IS NOT NULL;

-- For token transfer volume queries
CREATE INDEX idx_transfer_token_timestamp ON transfer (token_id, timestamp DESC);

-- ============================================================
-- Address Statistics (for fast pagination counts)
-- ============================================================

CREATE TABLE address_stats (
  address           TEXT PRIMARY KEY,
  tx_count          INT NOT NULL DEFAULT 0,        -- Total transactions sent
  transfer_sent     INT NOT NULL DEFAULT 0,        -- Transfers sent
  transfer_received INT NOT NULL DEFAULT 0,        -- Transfers received
  contract_calls    INT NOT NULL DEFAULT 0,        -- Contract interactions
  first_seen        TIMESTAMPTZ,
  last_seen         TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_address_stats_tx_count ON address_stats (tx_count DESC);
CREATE INDEX idx_address_stats_last_seen ON address_stats (last_seen DESC);

-- ============================================================
-- Materialized Views for Heavy Queries
-- ============================================================

-- Daily network statistics
CREATE MATERIALIZED VIEW daily_stats AS
SELECT 
  DATE(b.timestamp) as date,
  COUNT(DISTINCT b.height) as block_count,
  COUNT(DISTINCT e.id) as tx_count,
  COUNT(DISTINCT e.signer_id) as active_users,
  COALESCE(SUM(e.fee::numeric), 0) / 1e18 as total_fees_reef,
  COUNT(DISTINCT CASE WHEN t.type = 'ERC20' THEN t.id END) as erc20_transfers,
  COUNT(DISTINCT CASE WHEN t.type IN ('ERC721', 'ERC1155') THEN t.id END) as nft_transfers,
  COUNT(DISTINCT CASE WHEN t.type = 'Native' THEN t.id END) as native_transfers
FROM block b
LEFT JOIN extrinsic e ON b.height = e.block_height
LEFT JOIN transfer t ON b.height = t.block_height
GROUP BY DATE(b.timestamp);

CREATE UNIQUE INDEX idx_daily_stats_date ON daily_stats (date DESC);

-- Top tokens by 24h activity
CREATE MATERIALIZED VIEW top_tokens_24h AS
SELECT 
  t.token_id,
  vc.name as token_name,
  vc.type as token_type,
  COUNT(*) as transfer_count,
  COUNT(DISTINCT t.from_id) as unique_senders,
  COUNT(DISTINCT t.to_id) as unique_receivers,
  COALESCE(SUM(t.amount::numeric), 0) as total_volume
FROM transfer t
LEFT JOIN verified_contract vc ON t.token_id = vc.id
WHERE t.timestamp > NOW() - INTERVAL '24 hours'
GROUP BY t.token_id, vc.name, vc.type
ORDER BY transfer_count DESC
LIMIT 100;

CREATE UNIQUE INDEX idx_top_tokens_24h_token ON top_tokens_24h (token_id);
CREATE INDEX idx_top_tokens_24h_count ON top_tokens_24h (transfer_count DESC);

-- ============================================================
-- Helper Functions for Count Queries
-- ============================================================

-- Function to get transfer count for address (for pagination)
CREATE OR REPLACE FUNCTION get_transfer_count(
  addr TEXT,
  direction TEXT DEFAULT 'any',  -- 'any', 'sent', 'received'
  token_filter TEXT DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
  count_result BIGINT;
BEGIN
  IF direction = 'sent' THEN
    SELECT COUNT(*) INTO count_result
    FROM transfer
    WHERE from_id = addr
      AND (token_filter IS NULL OR token_id = token_filter);
  ELSIF direction = 'received' THEN
    SELECT COUNT(*) INTO count_result
    FROM transfer
    WHERE to_id = addr
      AND (token_filter IS NULL OR token_id = token_filter);
  ELSE
    SELECT COUNT(*) INTO count_result
    FROM transfer
    WHERE (from_id = addr OR to_id = addr)
      AND (token_filter IS NULL OR token_id = token_filter);
  END IF;
  
  RETURN count_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get extrinsic count for address
CREATE OR REPLACE FUNCTION get_extrinsic_count(
  addr TEXT,
  success_only BOOLEAN DEFAULT true
) RETURNS BIGINT AS $$
DECLARE
  count_result BIGINT;
BEGIN
  IF success_only THEN
    SELECT COUNT(*) INTO count_result
    FROM extrinsic
    WHERE signer_id = addr AND success = true;
  ELSE
    SELECT COUNT(*) INTO count_result
    FROM extrinsic
    WHERE signer_id = addr;
  END IF;
  
  RETURN count_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- Triggers to Update Address Stats
-- ============================================================

-- Trigger function to update address_stats on new extrinsic
CREATE OR REPLACE FUNCTION update_address_stats_extrinsic()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO address_stats (address, tx_count, first_seen, last_seen, updated_at)
  VALUES (NEW.signer_id, 1, NEW.timestamp, NEW.timestamp, NOW())
  ON CONFLICT (address) DO UPDATE SET
    tx_count = address_stats.tx_count + 1,
    last_seen = GREATEST(address_stats.last_seen, NEW.timestamp),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_address_stats_extrinsic
AFTER INSERT ON extrinsic
FOR EACH ROW
WHEN (NEW.signer_id IS NOT NULL)
EXECUTE FUNCTION update_address_stats_extrinsic();

-- Trigger function to update address_stats on new transfer
CREATE OR REPLACE FUNCTION update_address_stats_transfer()
RETURNS TRIGGER AS $$
BEGIN
  -- Update sender stats
  INSERT INTO address_stats (address, transfer_sent, first_seen, last_seen, updated_at)
  VALUES (NEW.from_id, 1, NEW.timestamp, NEW.timestamp, NOW())
  ON CONFLICT (address) DO UPDATE SET
    transfer_sent = address_stats.transfer_sent + 1,
    last_seen = GREATEST(address_stats.last_seen, NEW.timestamp),
    updated_at = NOW();
  
  -- Update receiver stats
  INSERT INTO address_stats (address, transfer_received, first_seen, last_seen, updated_at)
  VALUES (NEW.to_id, 1, NEW.timestamp, NEW.timestamp, NOW())
  ON CONFLICT (address) DO UPDATE SET
    transfer_received = address_stats.transfer_received + 1,
    last_seen = GREATEST(address_stats.last_seen, NEW.timestamp),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_address_stats_transfer
AFTER INSERT ON transfer
FOR EACH ROW
EXECUTE FUNCTION update_address_stats_transfer();

-- Trigger function to update address_stats on new contract_call
CREATE OR REPLACE FUNCTION update_address_stats_contract_call()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO address_stats (address, contract_calls, first_seen, last_seen, updated_at)
  VALUES (NEW.from_id, 1, NEW.timestamp, NEW.timestamp, NOW())
  ON CONFLICT (address) DO UPDATE SET
    contract_calls = address_stats.contract_calls + 1,
    last_seen = GREATEST(address_stats.last_seen, NEW.timestamp),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_address_stats_contract_call
AFTER INSERT ON contract_call
FOR EACH ROW
WHEN (NEW.from_id IS NOT NULL)
EXECUTE FUNCTION update_address_stats_contract_call();

-- ================= STAKING ACTIVITY VIEW ===================
-- Unified view for staking events with transfer-like structure
CREATE OR REPLACE VIEW staking_activity AS
SELECT
  s.id,
  s.signer_id,
  a.evm_address AS signer_evm_address,
  s.type AS staking_type,
  s.amount,
  s.era,
  s.validator_id,
  s.timestamp
FROM staking s
LEFT JOIN account a ON s.signer_id = a.id;

-- Index for fast staking queries by signer
CREATE INDEX IF NOT EXISTS idx_staking_signer_ts ON staking (signer_id, timestamp DESC);

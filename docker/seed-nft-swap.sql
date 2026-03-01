-- ============================================================
-- Seed NFT + Swap test data (idempotent)
-- ============================================================

BEGIN;

-- Test accounts (native + EVM mapping)
INSERT INTO account (id, evm_address, active, timestamp)
VALUES
  ('5GNJqTPyNqANBkUVMN1LPPrxXnFouWA2MRQg3gKrUYgw6HEr', '0x0000000000000000000000000000000000000001', TRUE, NOW()),
  ('5HGjWAeFDfFCWPsjFQdVV2Msvz2XtMktvgocEZcCj68kUMaw', '0x0000000000000000000000000000000000000002', TRUE, NOW()),
  ('5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy', '0x0000000000000000000000000000000000000003', TRUE, NOW())
ON CONFLICT (id) DO UPDATE SET
  evm_address = COALESCE(EXCLUDED.evm_address, account.evm_address),
  active = TRUE,
  timestamp = NOW();

-- Tokens/contracts used by tests
INSERT INTO verified_contract (id, name, type, contract_data, approved, timestamp)
VALUES
  ('0x0000000000000000000000000000000001000000', 'REEF', 'ERC20', '{"name":"REEF","symbol":"REEF","decimals":18}', TRUE, NOW()),
  ('0x0000000000000000000000000000000002000000', 'USDC', 'ERC20', '{"name":"USDC","symbol":"USDC","decimals":6}', TRUE, NOW()),
  ('0x0000000000000000000000000000000003000000', 'TEST-NFT', 'ERC721', '{"name":"TEST-NFT","symbol":"TNFT"}', TRUE, NOW())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  contract_data = COALESCE(EXCLUDED.contract_data, verified_contract.contract_data),
  approved = TRUE,
  timestamp = NOW();

-- Swap legs for address 5GNJ... (REEF -> USDC in one extrinsic hash)
INSERT INTO transfer (
  id, block_height, block_hash, finalized,
  extrinsic_id, extrinsic_hash, extrinsic_index, event_index,
  from_id, to_id, token_id, from_evm_address, to_evm_address,
  type, reefswap_action, amount, nft_id, success, timestamp
)
VALUES
  (
    '0019999000-swapa-000', 19999000, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0001', TRUE,
    '0019999000-aaaaa-001', '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 1, 0,
    '5GNJqTPyNqANBkUVMN1LPPrxXnFouWA2MRQg3gKrUYgw6HEr', '5HGjWAeFDfFCWPsjFQdVV2Msvz2XtMktvgocEZcCj68kUMaw',
    '0x0000000000000000000000000000000001000000',
    '0x0000000000000000000000000000000000000001', '0x0000000000000000000000000000000000000002',
    'Native', 'Swap', 5000000000000000000, NULL, TRUE, NOW() - INTERVAL '5 minute'
  ),
  (
    '0019999000-swapa-001', 19999000, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0001', TRUE,
    '0019999000-aaaaa-001', '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 1, 1,
    '5HGjWAeFDfFCWPsjFQdVV2Msvz2XtMktvgocEZcCj68kUMaw', '5GNJqTPyNqANBkUVMN1LPPrxXnFouWA2MRQg3gKrUYgw6HEr',
    '0x0000000000000000000000000000000002000000',
    '0x0000000000000000000000000000000000000002', '0x0000000000000000000000000000000000000001',
    'ERC20', 'Swap', 12500000, NULL, TRUE, NOW() - INTERVAL '5 minute'
  )
ON CONFLICT (id) DO NOTHING;

-- NFT transfer + owner record for same test address
INSERT INTO transfer (
  id, block_height, block_hash, finalized,
  extrinsic_id, extrinsic_hash, extrinsic_index, event_index,
  from_id, to_id, token_id, from_evm_address, to_evm_address,
  type, amount, nft_id, success, timestamp
)
VALUES
  (
    '0019999001-nftaa-000', 19999001, '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb0001', TRUE,
    '0019999001-bbbbb-001', '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 1, 0,
    '5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy', '5GNJqTPyNqANBkUVMN1LPPrxXnFouWA2MRQg3gKrUYgw6HEr',
    '0x0000000000000000000000000000000003000000',
    '0x0000000000000000000000000000000000000003', '0x0000000000000000000000000000000000000001',
    'ERC721', 1, 1001, TRUE, NOW() - INTERVAL '4 minute'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO token_holder (id, token_id, signer_id, evm_address, nft_id, type, balance, timestamp)
VALUES
  (
    '0x0000000000000000000000000000000003000000-5GNJqTPyNqANBkUVMN1LPPrxXnFouWA2MRQg3gKrUYgw6HEr-1001',
    '0x0000000000000000000000000000000003000000',
    '5GNJqTPyNqANBkUVMN1LPPrxXnFouWA2MRQg3gKrUYgw6HEr',
    '0x0000000000000000000000000000000000000001',
    1001,
    'Account',
    1,
    NOW()
  )
ON CONFLICT (id) DO UPDATE SET
  balance = GREATEST(token_holder.balance, EXCLUDED.balance),
  timestamp = NOW();

COMMIT;

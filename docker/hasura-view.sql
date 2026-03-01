-- Create a view that wraps transfer table with Subsquid-compatible structure
-- This allows Hasura to expose data in the same format as Subsquid API

CREATE OR REPLACE VIEW transfer_subsquid_compat AS
SELECT 
  t.id,
  t.amount,
  t.timestamp,
  t.success,
  t.type,
  t.reefswap_action,
  t.extrinsic_hash,
  t.extrinsic_id,
  t.block_height,
  t.extrinsic_index,
  t.event_index,
  t.from_evm_address,
  t.to_evm_address,
  t.nft_id,
  t.dapp,
  t.fee_amount,
  t.error_message,
  -- Create nested objects for from/to
  jsonb_build_object('id', t.from_id) as "from",
  jsonb_build_object('id', t.to_id) as "to",
  -- Create nested object for token with data from verified_contract
  jsonb_build_object(
    'id', vc.id,
    'name', vc.name,
    'type', vc.type,
    'contractData', vc.contract_data
  ) as token,
  -- Keep original IDs for filtering
  t.from_id,
  t.to_id,
  t.token_id
FROM transfer t
LEFT JOIN verified_contract vc ON t.token_id = vc.id;

-- Create indexes for the view (optional, for better performance)
-- Note: Indexes on views are not directly supported, but the underlying table indexes will be used

COMMENT ON VIEW transfer_subsquid_compat IS 'Subsquid-compatible view of transfer table with nested from/to/token objects';

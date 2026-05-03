-- Restore foreign key constraints that were missing from the original schema.
-- Hasura requires physical FKs for `foreign_key_constraint_on` relationships;
-- without them every relation in metadata showed as "inconsistent" and the
-- corresponding GraphQL fields were missing from the schema.
--
-- All FKs use the default ON DELETE NO ACTION / ON UPDATE NO ACTION so that
-- orphaning rows fails loudly instead of cascading. Wrap in a single
-- transaction so a partial application leaves the schema unchanged.

BEGIN;

ALTER TABLE event
  ADD CONSTRAINT event_block_height_fkey
  FOREIGN KEY (block_height) REFERENCES block(height);

ALTER TABLE event
  ADD CONSTRAINT event_extrinsic_id_fkey
  FOREIGN KEY (extrinsic_id) REFERENCES extrinsic(id);

ALTER TABLE extrinsic
  ADD CONSTRAINT extrinsic_block_height_fkey
  FOREIGN KEY (block_height) REFERENCES block(height);

ALTER TABLE extrinsic
  ADD CONSTRAINT extrinsic_signer_id_fkey
  FOREIGN KEY (signer_id) REFERENCES account(id);

ALTER TABLE contract_call
  ADD CONSTRAINT contract_call_block_height_fkey
  FOREIGN KEY (block_height) REFERENCES block(height);

ALTER TABLE contract_call
  ADD CONSTRAINT contract_call_extrinsic_id_fkey
  FOREIGN KEY (extrinsic_id) REFERENCES extrinsic(id);

ALTER TABLE contract_call
  ADD CONSTRAINT contract_call_from_id_fkey
  FOREIGN KEY (from_id) REFERENCES account(id);

ALTER TABLE contract_call
  ADD CONSTRAINT contract_call_to_id_fkey
  FOREIGN KEY (to_id) REFERENCES verified_contract(id);

ALTER TABLE transfer
  ADD CONSTRAINT transfer_token_id_fkey
  FOREIGN KEY (token_id) REFERENCES verified_contract(id);

ALTER TABLE transfer
  ADD CONSTRAINT transfer_from_id_fkey
  FOREIGN KEY (from_id) REFERENCES account(id);

ALTER TABLE transfer
  ADD CONSTRAINT transfer_to_id_fkey
  FOREIGN KEY (to_id) REFERENCES account(id);

ALTER TABLE staking
  ADD CONSTRAINT staking_signer_id_fkey
  FOREIGN KEY (signer_id) REFERENCES account(id);

-- token_holder.token_id_fkey already added manually on 2026-05-03 prod
ALTER TABLE token_holder
  ADD CONSTRAINT token_holder_signer_id_fkey
  FOREIGN KEY (signer_id) REFERENCES account(id);

ALTER TABLE nft_metadata
  ADD CONSTRAINT nft_metadata_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES verified_contract(id);

ALTER TABLE nft_metadata
  ADD CONSTRAINT nft_metadata_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES account(id);

COMMIT;

import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PG_HOST ?? 'localhost',
  port: Number(process.env.PG_PORT ?? 5432),
  database: process.env.PG_DB ?? 'reef_explorer',
  user: process.env.PG_USER ?? 'reef',
  password: process.env.PG_PASS ?? 'reef_local',
  max: 5,
});

export async function query(text: string, params?: unknown[]) {
  return pool.query(text, params);
}

export async function getLastIndexedBlock(): Promise<number> {
  const res = await query("SELECT last_block FROM indexer_cursor WHERE id = 'main'");
  return res.rows.length > 0 ? Number(res.rows[0].last_block) : 0;
}

export async function setLastIndexedBlock(blockNum: number, blockHash: string): Promise<void> {
  await query(
    "UPDATE indexer_cursor SET last_block = $1, last_block_hash = $2, updated_at = NOW() WHERE id = 'main'",
    [blockNum, blockHash]
  );
}

// ─── Backfill cursor (reverse indexing) ──────────────────────
export async function getBackfillCursor(): Promise<number | null> {
  const res = await query("SELECT last_block FROM indexer_cursor WHERE id = 'backfill'");
  return res.rows.length > 0 ? Number(res.rows[0].last_block) : null;
}

export async function setBackfillCursor(blockNum: number, blockHash: string): Promise<void> {
  await query(
    `INSERT INTO indexer_cursor (id, last_block, last_block_hash, updated_at)
     VALUES ('backfill', $1, $2, NOW())
     ON CONFLICT (id) DO UPDATE SET last_block = $1, last_block_hash = $2, updated_at = NOW()`,
    [blockNum, blockHash]
  );
}

export async function upsertAccount(id: string, evmAddress: string | null) {
  await query(
    `INSERT INTO account (id, evm_address, timestamp)
     VALUES ($1, $2, NOW())
     ON CONFLICT (id) DO UPDATE SET evm_address = COALESCE(EXCLUDED.evm_address, account.evm_address)`,
    [id, evmAddress]
  );
}

export async function upsertVerifiedContract(
  id: string,
  name: string,
  type: string,
  contractData: Record<string, unknown> | null
) {
  await query(
    `INSERT INTO verified_contract (id, name, type, contract_data, timestamp)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (id) DO UPDATE SET
       name = COALESCE(EXCLUDED.name, verified_contract.name),
       contract_data = COALESCE(EXCLUDED.contract_data, verified_contract.contract_data)`,
    [id, name, type, contractData ? JSON.stringify(contractData) : null]
  );
}

export interface StakingRow {
  id: string;
  signerId: string;
  type: string;       // Reward, Slash, Bonded, Unbonded, Withdrawn
  amount: string;
  era: number | null;
  validatorId: string | null;
  timestamp: Date;
}

export interface EraValidatorRow {
  id: string;
  era: number;
  address: string;
  total: string;
  own: string;
  nominatorsCount: number;
  commission: number | null;
  blocked: boolean;
  timestamp: Date;
}

export interface NftRecord {
  id: string;           // contractAddress-tokenId
  contractId: string;
  tokenId: string;
  ownerId: string;
  timestamp: Date;
}

export interface TransferRow {
  id: string;
  blockHeight: number;
  blockHash: string;
  finalized: boolean;
  extrinsicId: string | null;
  extrinsicHash: string | null;
  extrinsicIndex: number;
  eventIndex: number;
  fromId: string;
  toId: string;
  tokenId: string;
  fromEvmAddress: string | null;
  toEvmAddress: string | null;
  type: string;
  reefswapAction: string | null;
  amount: string;
  denom: string | null;
  nftId: string | null;
  success: boolean;
  timestamp: Date;
}

export interface ContractCallRow {
  id: string;
  blockHeight: number;
  extrinsicId: string | null;
  fromId: string;
  toId: string;              // contract address
  value: string;             // REEF sent with call
  gasLimit: string | null;
  gasUsed: string | null;
  input: string | null;      // calldata (first 10 chars for method selector)
  success: boolean;
  errorMessage: string | null;
  timestamp: Date;
}

export interface ExtrinsicRow {
  id: string;
  blockHeight: number;
  blockHash: string;
  extrinsicIndex: number;
  hash: string;
  signerId: string | null;
  method: string;
  section: string;
  args: Record<string, unknown> | null;
  signature: string | null;
  nonce: number | null;
  tip: string;
  fee: string;
  success: boolean;
  errorMessage: string | null;
  timestamp: Date;
}

export async function insertTransfer(t: TransferRow) {
  await query(
    `INSERT INTO transfer (
       id, block_height, block_hash, finalized,
       extrinsic_id, extrinsic_hash, extrinsic_index, event_index,
       from_id, to_id, token_id,
       from_evm_address, to_evm_address,
       type, reefswap_action, amount, denom, nft_id,
       success, timestamp
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
     ON CONFLICT (id) DO NOTHING`,
    [
      t.id, t.blockHeight, t.blockHash, t.finalized,
      t.extrinsicId, t.extrinsicHash, t.extrinsicIndex, t.eventIndex,
      t.fromId, t.toId, t.tokenId,
      t.fromEvmAddress, t.toEvmAddress,
      t.type, t.reefswapAction, t.amount, t.denom, t.nftId,
      t.success, t.timestamp,
    ]
  );
}

export async function insertTransferBatch(transfers: TransferRow[]) {
  if (transfers.length === 0) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const t of transfers) {
      await client.query(
        `INSERT INTO transfer (
           id, block_height, block_hash, finalized,
           extrinsic_id, extrinsic_hash, extrinsic_index, event_index,
           from_id, to_id, token_id,
           from_evm_address, to_evm_address,
           type, reefswap_action, amount, denom, nft_id,
           success, timestamp
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
         ON CONFLICT (id) DO NOTHING`,
        [
          t.id, t.blockHeight, t.blockHash, t.finalized,
          t.extrinsicId, t.extrinsicHash, t.extrinsicIndex, t.eventIndex,
          t.fromId, t.toId, t.tokenId,
          t.fromEvmAddress, t.toEvmAddress,
          t.type, t.reefswapAction, t.amount, t.denom, t.nftId,
          t.success, t.timestamp,
        ]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function upsertTokenHolder(
  tokenId: string,
  signerId: string,
  evmAddress: string | null,
  amountDelta: bigint,
  type: string,
  timestamp: Date
) {
  const holderId = `${tokenId}-${signerId}-0`;
  await query(
    `INSERT INTO token_holder (id, token_id, signer_id, evm_address, type, balance, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6::numeric, $7)
     ON CONFLICT (id) DO UPDATE SET
       balance = GREATEST(0, token_holder.balance + $6::numeric),
       timestamp = EXCLUDED.timestamp`,
    [holderId, tokenId, signerId, evmAddress, type, amountDelta.toString(), timestamp]
  );
}

export interface BlockData {
  height: number;
  hash: string;
  timestamp: Date;
  accounts: Map<string, string | null>;
  contracts: Map<string, { name: string; type: string; data: Record<string, unknown> | null }>;
  transfers: TransferRow[];
  stakingEvents: StakingRow[];
  eraValidators: EraValidatorRow[];
  nfts: NftRecord[];
  contractCalls: ContractCallRow[];
  extrinsics: ExtrinsicRow[];
}

export async function insertBlockBatch(block: BlockData) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 0. Insert block metadata
    await client.query(
      `INSERT INTO block (height, hash, timestamp, processor_timestamp)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (height) DO UPDATE SET
         processor_timestamp = NOW()`,
      [block.height, block.hash, block.timestamp]
    );

    // Even if there is no account/transfer activity in this block, keep
    // processor_timestamp fresh so health checks reflect live indexing.
    if (block.transfers.length === 0 && block.accounts.size === 0 && block.contracts.size === 0) {
      await client.query('COMMIT');
      return;
    }

    // 1. Upsert accounts
    for (const [addr, evmAddr] of block.accounts) {
      await client.query(
        `INSERT INTO account (id, evm_address, timestamp)
         VALUES ($1, $2, NOW())
         ON CONFLICT (id) DO UPDATE SET evm_address = COALESCE(EXCLUDED.evm_address, account.evm_address)`,
        [addr, evmAddr]
      );
    }

    // 2. Upsert verified contracts (ERC20 tokens)
    for (const [addr, info] of block.contracts) {
      // NFT types (ERC721/ERC1155) take priority over ERC20
      await client.query(
        `INSERT INTO verified_contract (id, name, type, contract_data, timestamp)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (id) DO UPDATE SET
           type = CASE
             WHEN EXCLUDED.type IN ('ERC721', 'ERC1155') AND verified_contract.type = 'ERC20'
             THEN EXCLUDED.type
             ELSE verified_contract.type
           END,
           name = CASE
             WHEN EXCLUDED.type IN ('ERC721', 'ERC1155') AND verified_contract.type = 'ERC20'
             THEN EXCLUDED.name
             ELSE verified_contract.name
           END`,
        [addr, info.name, info.type, info.data ? JSON.stringify(info.data) : null]
      );
    }

    // 3. Insert transfers
    for (const t of block.transfers) {
      // nft_id column is NUMERIC - extract only the token id number from "contractAddr-tokenId" format
      const nftIdNumeric = t.nftId ? (t.nftId.includes('-') ? t.nftId.split('-').pop() : t.nftId) : null;
      await client.query(
        `INSERT INTO transfer (
           id, block_height, block_hash, finalized,
           extrinsic_id, extrinsic_hash, extrinsic_index, event_index,
           from_id, to_id, token_id,
           from_evm_address, to_evm_address,
           type, reefswap_action, amount, denom, nft_id,
           success, timestamp
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
         ON CONFLICT (id) DO NOTHING`,
        [
          t.id, t.blockHeight, t.blockHash, t.finalized,
          t.extrinsicId, t.extrinsicHash, t.extrinsicIndex, t.eventIndex,
          t.fromId, t.toId, t.tokenId,
          t.fromEvmAddress, t.toEvmAddress,
          t.type, t.reefswapAction, t.amount, t.denom, nftIdNumeric,
          t.success, t.timestamp,
        ]
      );

      // 4. Update token holder balances
      if (t.success) {
        const isNft = t.type === 'ERC721' || t.type === 'ERC1155';
        const nftSuffix = isNft && t.nftId ? t.nftId.split('-')[1] ?? '0' : '0';
        const amt = BigInt(t.amount);

        // Receiver gets +amount
        const toHolderId = `${t.tokenId}-${t.toId}-${nftSuffix}`;
        await client.query(
          `INSERT INTO token_holder (id, token_id, signer_id, evm_address, nft_id, type, balance, timestamp)
           VALUES ($1, $2, $3, $4, $5, 'Account', $6::numeric, $7)
           ON CONFLICT (id) DO UPDATE SET
             balance = token_holder.balance + $6::numeric,
             timestamp = EXCLUDED.timestamp`,
          [toHolderId, t.tokenId, t.toId, t.toEvmAddress, isNft ? nftSuffix : null, amt.toString(), t.timestamp]
        );
        // Sender gets -amount (skip zero-address mints)
        const fromZero = t.fromId === '0x0000000000000000000000000000000000000000';
        if (!fromZero) {
          const fromHolderId = `${t.tokenId}-${t.fromId}-${nftSuffix}`;
          await client.query(
            `INSERT INTO token_holder (id, token_id, signer_id, evm_address, nft_id, type, balance, timestamp)
             VALUES ($1, $2, $3, $4, $5, 'Account', -($6::numeric), $7)
             ON CONFLICT (id) DO UPDATE SET
               balance = GREATEST(0, token_holder.balance - $6::numeric),
               timestamp = EXCLUDED.timestamp`,
            [fromHolderId, t.tokenId, t.fromId, t.fromEvmAddress, isNft ? nftSuffix : null, amt.toString(), t.timestamp]
          );
        }
      }
    }

    // 5. Insert staking events
    for (const s of block.stakingEvents) {
      await client.query(
        `INSERT INTO staking (id, signer_id, type, amount, era, validator_id, timestamp)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO NOTHING`,
        [s.id, s.signerId, s.type, s.amount, s.era, s.validatorId, s.timestamp]
      );
    }

    // 7. Upsert NFT metadata (ownership tracking)
    for (const nft of block.nfts) {
      await client.query(
        `INSERT INTO nft_metadata (id, contract_id, token_id, owner_id, last_transfer, timestamp)
         VALUES ($1, $2, $3, $4, $5, $5)
         ON CONFLICT (id) DO UPDATE SET
           owner_id = EXCLUDED.owner_id,
           last_transfer = EXCLUDED.last_transfer`,
        [nft.id, nft.contractId, nft.tokenId, nft.ownerId, nft.timestamp]
      );
    }

    // 8. Upsert era validator info
    for (const v of block.eraValidators) {
      await client.query(
        `INSERT INTO era_validator_info (id, era, address, total, own, nominators_count, commission, blocked, timestamp)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO UPDATE SET
           total = EXCLUDED.total,
           own = EXCLUDED.own,
           nominators_count = EXCLUDED.nominators_count,
           commission = EXCLUDED.commission,
           blocked = EXCLUDED.blocked,
           timestamp = EXCLUDED.timestamp`,
        [v.id, v.era, v.address, v.total, v.own, v.nominatorsCount, v.commission, v.blocked, v.timestamp]
      );
    }

    // 9. Insert contract calls
    for (const cc of block.contractCalls) {
      await client.query(
        `INSERT INTO contract_call (id, block_height, extrinsic_id, from_id, to_id, value, gas_limit, gas_used, input, success, error_message, timestamp)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (id) DO NOTHING`,
        [cc.id, cc.blockHeight, cc.extrinsicId, cc.fromId, cc.toId, cc.value, cc.gasLimit, cc.gasUsed, cc.input, cc.success, cc.errorMessage, cc.timestamp]
      );
    }

    // 10. Insert extrinsics
    for (const ext of block.extrinsics) {
      await client.query(
        `INSERT INTO extrinsic (id, block_height, block_hash, extrinsic_index, hash, signer_id, method, section, args, signature, nonce, tip, fee, success, error_message, timestamp)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (id) DO NOTHING`,
        [ext.id, ext.blockHeight, ext.blockHash, ext.extrinsicIndex, ext.hash, ext.signerId, ext.method, ext.section, ext.args ? JSON.stringify(ext.args) : null, ext.signature, ext.nonce, ext.tip, ext.fee, ext.success, ext.errorMessage, ext.timestamp]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function close() {
  await pool.end();
}

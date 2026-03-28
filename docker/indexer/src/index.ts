import { ApiPromise, WsProvider } from '@polkadot/api';
import {
  getLastIndexedBlock,
  setLastIndexedBlock,
  getBackfillCursor,
  setBackfillCursor,
  upsertVerifiedContract,
  insertBlockBatch,
  getContractsWithoutIcon,
  mergeContractIcon,
  close,
} from './db.js';
import { parseBlock, fetchContractIcon } from './parser.js';

// ─── Configuration ──────────────────────────────────────────
const RPC_URL = process.env.RPC_URL ?? 'wss://rpc.reefscan.info/ws';
const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? 10);
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 6000);
const START_BLOCK = Number(process.env.START_BLOCK ?? 0); // 0 = auto-detect
const BACKFILL = (process.env.BACKFILL ?? 'false').toLowerCase() === 'true';
const BACKFILL_TARGET = Number(process.env.BACKFILL_TARGET ?? 1); // stop at this block

const REEF_TYPE_OVERRIDES = {
  EvmAddress: 'H160',
  CurrencyId: 'u32',
  CurrencyIdOf: 'u32',
  AmountOf: 'i128',
  AsOriginId: 'u32',
  PalletBalanceOf: 'u128',
  ScheduleTaskIndex: 'u32',
  LockDuration: 'u64',
  DispatchTime: 'u64',
  CommitmentOf: 'H256',
  CodeInfo: 'Bytes',
  EvmAccountInfo: 'Bytes',
} as const;

// REEF native token — ensure it exists in verified_contract
const REEF_CONTRACT = '0x0000000000000000000000000000000001000000';

// ─── Main ───────────────────────────────────────────────────
// ─── Icon enrichment: backfill iconUrl from Reefscan for all existing contracts ──
async function enrichContractIcons(): Promise<void> {
  const ids = await getContractsWithoutIcon();
  if (ids.length === 0) {
    console.log('🎨 All contracts already have icons (or none registered)');
    return;
  }
  console.log(`🎨 Enriching icons for ${ids.length} contracts from Reefscan...`);

  let enriched = 0;
  let skipped = 0;

  // Log first few for debugging; enable debug mode for known icon contracts
  const debugFirst = 3;
  const knownWithIcon = new Set(['0x468ff1d6544de171394de9d9f47f3d276f7355bb', '0x95a2af50040b7256a4b4c405a4afd4dd573da115']);
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    try {
      const debug = i < debugFirst || knownWithIcon.has(id.toLowerCase());
      const iconUrl = await fetchContractIcon(id, debug);
      if (i < debugFirst || debug) {
        console.log(`🎨 [${i}] ${id} → ${iconUrl ?? 'no icon'}`);
      }
      if (iconUrl) {
        await mergeContractIcon(id, iconUrl);
        enriched++;
        if (debug) console.log(`🎨 [${i}] ${id} → SAVED`);
      } else {
        skipped++;
      }
    } catch (err) {
      console.log(`🎨 [${i}] ${id} → ERROR: ${(err as Error).message}`);
      skipped++;
    }
    // Rate limit: ~100ms between requests to avoid hammering Reefscan
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`🎨 Icon enrichment done: ${enriched} updated, ${skipped} no icon available`);
}

async function main() {
  console.log('🔗 Connecting to Reef Chain RPC:', RPC_URL);
  const provider = new WsProvider(RPC_URL);
  const api = await ApiPromise.create({ provider, types: REEF_TYPE_OVERRIDES });

  const chain = await api.rpc.system.chain();
  const finalizedHead = await api.rpc.chain.getFinalizedHead();
  const finalizedHeader = await api.rpc.chain.getHeader(finalizedHead);
  const chainHead = finalizedHeader.number.toNumber();

  console.log(`✅ Connected to ${chain.toString()}`);
  console.log(`📦 Chain head: #${chainHead}`);

  // Ensure REEF token exists
  await upsertVerifiedContract(REEF_CONTRACT, 'REEF', 'ERC20', {
    name: 'REEF',
    symbol: 'REEF',
    decimals: 18,
  });

  // Determine start block
  let fromBlock: number;
  const lastIndexed = await getLastIndexedBlock();
  
  if (lastIndexed > 0) {
    // Resume from last indexed block
    fromBlock = lastIndexed + 1;
  } else if (START_BLOCK > 0) {
    // Use START_BLOCK from env if cursor is 0
    fromBlock = Math.min(START_BLOCK, chainHead);
    if (START_BLOCK > chainHead) {
      console.warn(`⚠️ START_BLOCK=${START_BLOCK} is above head #${chainHead}, clamped to #${fromBlock}`);
    }
  } else {
    // Default: index last 1000 blocks if starting fresh
    fromBlock = Math.max(1, chainHead - 1000);
  }

  console.log(`🚀 Starting forward from block #${fromBlock}`);
  console.log(`📊 Batch size: ${BATCH_SIZE}, Poll interval: ${POLL_INTERVAL_MS}ms`);

  // ─── Backfill state ──────────────────────────────────────
  let backfillBlock: number | null = null;
  let backfillDone = true;

  console.log(`⏪ Backfill config: BACKFILL=${BACKFILL}, START_BLOCK=${START_BLOCK}, BACKFILL_TARGET=${BACKFILL_TARGET}`);
  if (BACKFILL && START_BLOCK > BACKFILL_TARGET) {
    const savedCursor = await getBackfillCursor();
    backfillBlock = savedCursor !== null ? savedCursor - 1 : START_BLOCK - 1;
    backfillDone = backfillBlock < BACKFILL_TARGET;
    if (backfillDone) {
      console.log(`⏪ Backfill already complete!`);
    } else {
      console.log(`⏪ Backfill enabled: #${backfillBlock} → #${BACKFILL_TARGET}`);
    }
  }
  console.log('');

  // ─── Enrich contract icons from Reefscan (non-blocking) ──
  enrichContractIcons().catch((err) =>
    console.warn('⚠️ Icon enrichment failed:', (err as Error).message)
  );

  let currentBlock = fromBlock;

  // ─── Main loop: alternates forward + backfill batches ────
  while (true) {
    // ── Forward batch ──
    try {
      const head = await api.rpc.chain.getFinalizedHead();
      const header = await api.rpc.chain.getHeader(head);
      const headNum = header.number.toNumber();

      if (currentBlock > headNum) {
        process.stdout.write(`⏳ Caught up at #${headNum}, waiting...\r`);
        await sleep(POLL_INTERVAL_MS);
      } else {
        const toBlock = Math.min(currentBlock + BATCH_SIZE - 1, headNum);
        const stats = await processBatch(api, provider, currentBlock, toBlock, 1);

        const behind = headNum - toBlock;
        console.log(
          `📦 #${currentBlock}..#${toBlock} (${stats.blocks} blocks) — ` +
          formatStats(stats) + ' — ' +
          `${stats.elapsed}ms` +
          (behind > 0 ? ` — ${behind} blocks behind` : ' — ✅ synced')
        );

        const lastBlockHash = await api.rpc.chain.getBlockHash(toBlock);
        await setLastIndexedBlock(toBlock, lastBlockHash.toHex());
        currentBlock = toBlock + 1;
      }
    } catch (err) {
      console.error('❌ Forward error:', (err as Error).message);
      await sleep(5000);
    }

    // ── Backfill batch (if enabled and not done) ──
    if (!backfillDone && backfillBlock !== null && backfillBlock >= BACKFILL_TARGET) {
      try {
        const fromBlock = Math.max(backfillBlock - BATCH_SIZE + 1, BACKFILL_TARGET);
        const stats = await processBatch(api, provider, fromBlock, backfillBlock, -1);

        const remaining = fromBlock - BACKFILL_TARGET;
        console.log(
          `⏪ #${backfillBlock}..#${fromBlock} (${stats.blocks} blocks) — ` +
          formatStats(stats) + ' — ' +
          `${stats.elapsed}ms` +
          (remaining > 0 ? ` — ${remaining} blocks remaining` : ' — ✅ backfill complete')
        );

        const lowestHash = await api.rpc.chain.getBlockHash(fromBlock);
        await setBackfillCursor(fromBlock, lowestHash.toHex());
        backfillBlock = fromBlock - 1;

        if (backfillBlock < BACKFILL_TARGET) {
          backfillDone = true;
          console.log(`⏪ Backfill complete! Indexed down to block #${BACKFILL_TARGET}`);
        }
      } catch (err) {
        console.error('⏪ Backfill error:', (err as Error).message);
        await sleep(2000);
      }
    }

    await sleep(100);
  }
}

interface BatchStats {
  blocks: number;
  elapsed: number;
  transfers: number;
  accounts: number;
  contracts: number;
  staking: number;
  validators: number;
  nfts: number;
}

const CONCURRENCY = Number(process.env.CONCURRENCY ?? 5);

async function processBatch(
  api: ApiPromise,
  provider: WsProvider,
  fromBlock: number,
  toBlock: number,
  direction: 1 | -1,
): Promise<BatchStats> {
  const batchStart = Date.now();
  let transfers = 0, accounts = 0, contracts = 0;
  let staking = 0, validators = 0, nfts = 0;

  const skipExtrinsics = direction === -1; // backfill: no getBlock needed

  // Build ordered list of block numbers
  const blockNums: number[] = [];
  if (direction === 1) {
    for (let i = fromBlock; i <= toBlock; i++) blockNums.push(i);
  } else {
    for (let i = toBlock; i >= fromBlock; i--) blockNums.push(i);
  }

  // Process in parallel chunks
  for (let i = 0; i < blockNums.length; i += CONCURRENCY) {
    const chunk = blockNums.slice(i, i + CONCURRENCY);

    // Parse blocks in parallel
    const results = await Promise.allSettled(
      chunk.map(async (blockNum) => {
        const blockHash = await api.rpc.chain.getBlockHash(blockNum);
        return parseBlock(api, provider, blockHash.toHex(), skipExtrinsics, skipExtrinsics);
      })
    );

    // Insert results sequentially (preserves DB consistency)
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const blockNum = chunk[j];
      if (result.status === 'fulfilled') {
        try {
          await insertBlockBatch(result.value);
          transfers += result.value.transfers.length;
          accounts += result.value.accounts.size;
          contracts += result.value.contracts.size;
          staking += result.value.stakingEvents.length;
          validators += result.value.eraValidators.length;
          nfts += result.value.nfts.length;
        } catch (dbErr) {
          console.warn(`${direction === 1 ? '⚠️' : '⏪'} DB error block #${blockNum}: ${(dbErr as Error).message.split('\n')[0]}`);
        }
      } else {
        console.warn(`${direction === 1 ? '⚠️' : '⏪'} Skip block #${blockNum}: ${result.reason?.message?.split('\n')[0] ?? 'unknown'}`);
        if (direction === 1) {
          await setLastIndexedBlock(blockNum, '0x0000000000000000000000000000000000000000000000000000000000000000');
        }
      }
    }
  }

  return {
    blocks: Math.abs(toBlock - fromBlock) + 1,
    elapsed: Date.now() - batchStart,
    transfers, accounts, contracts, staking, validators, nfts,
  };
}

function formatStats(s: BatchStats): string {
  let out = `${s.transfers} tx, ${s.accounts} acc`;
  if (s.contracts > 0) out += `, ${s.contracts} tokens`;
  if (s.staking > 0) out += `, ${s.staking} stk`;
  if (s.validators > 0) out += `, ${s.validators} val`;
  if (s.nfts > 0) out += `, ${s.nfts} nft`;
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Graceful shutdown ──────────────────────────────────────
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down...');
  await close();
  process.exit(0);
});

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

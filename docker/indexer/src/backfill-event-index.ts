// One-off backfill: rewrite transfer.event_index to the event's position
// within its block's event list (Subsquid/Reefscan numbering).
//
// Historic rows stored a per-block *transfer counter* instead, which breaks
// Reefscan deep links (/transfer/{block}/{extrinsicIndex}/{eventIndex}).
// For every block that has transfer rows, this re-reads system.events at that
// block and maps the k-th transfer-shaped event (same order the parser
// indexed them in) to row id `{paddedBlock}-{hash5}-{kkk}`.
//
// Per-block sanity check: the number of transfer-shaped events found on chain
// must equal the number of DB rows for that block — mismatched blocks (e.g.
// indexed by an older parser version) are skipped and reported, never guessed.
// Safe to re-run any time; it only UPDATEs rows whose value is wrong.
//
//   build:  npm run build            (compiles to dist/backfill-event-index.js)
//   run:    node dist/backfill-event-index.js
//   tune:   EVIDX_CONCURRENCY=10     (blocks processed in parallel)
//           EVIDX_FROM / EVIDX_TO    (optional block height range)
//           EVIDX_BLOCKS=16223997    (comma-separated heights: dry-run mode —
//                                     hashes come from RPC, nothing is written)

import { ApiPromise, WsProvider } from '@polkadot/api';
import { query, close } from './db.js';
import { makeTransferId, isValidEvmAddress } from './parser.js';
import { REEF_API_OPTIONS } from './reef-types.js';

const RPC_URL = process.env.RPC_URL ?? 'wss://rpc.reefscan.info/ws';
const CONCURRENCY = Math.max(1, Number(process.env.EVIDX_CONCURRENCY ?? 10));

// Transfer(address,address,uint256) — shared by ERC20 (3 topics) and ERC721 (4 topics)
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
// TransferSingle(address,address,address,uint256,uint256)
const TRANSFER_SINGLE_TOPIC = '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62';

interface EventRecordLike {
  event: { section: string; method: string; data: unknown[] };
}

/**
 * Mirrors exactly which events parser.ts turns into transfer rows (and in the
 * same order), so the k-th match here corresponds to row id suffix k. Keep in
 * sync with the balances.Transfer / evm.Log branches of parseBlock.
 */
function isTransferShapedEvent(record: EventRecordLike): boolean {
  const { event } = record;
  if (event.section === 'balances' && event.method === 'Transfer') return true;
  if (event.section !== 'evm' || event.method !== 'Log') return false;
  try {
    const logData = event.data[0] as {
      topics?: Array<{ toString(): string }>;
      data?: { toString(): string };
    };
    if (!logData?.topics || logData.topics.length < 1) return false;
    const topic0 = logData.topics[0].toString();
    if (topic0 === TRANSFER_TOPIC && logData.topics.length === 4) {
      const fromEvm = ('0x' + logData.topics[1].toString().slice(-40)).toLowerCase();
      const toEvm = ('0x' + logData.topics[2].toString().slice(-40)).toLowerCase();
      return isValidEvmAddress(fromEvm) && isValidEvmAddress(toEvm);
    }
    if (topic0 === TRANSFER_TOPIC && logData.topics.length === 3) {
      const fromEvm = ('0x' + logData.topics[1].toString().slice(-40)).toLowerCase();
      const toEvm = ('0x' + logData.topics[2].toString().slice(-40)).toLowerCase();
      return isValidEvmAddress(fromEvm) && isValidEvmAddress(toEvm);
    }
    if (topic0 === TRANSFER_SINGLE_TOPIC && logData.topics.length >= 4) {
      const fromEvm = ('0x' + logData.topics[2].toString().slice(-40)).toLowerCase();
      const toEvm = ('0x' + logData.topics[3].toString().slice(-40)).toLowerCase();
      if (!isValidEvmAddress(fromEvm) || !isValidEvmAddress(toEvm)) return false;
      const rawData = logData.data?.toString() ?? '0x';
      return rawData.length >= 130;
    }
  } catch {
    return false;
  }
  return false;
}

interface BlockTask {
  height: number;
  hash: string;
  rowCount: number; // 0 = unknown (dry-run without DB)
}

interface BlockResult {
  updates: Array<{ id: string; eventIndex: number }>;
  mismatch?: string;
}

async function processBlock(api: ApiPromise, task: BlockTask): Promise<BlockResult> {
  const apiAt = await api.at(task.hash);
  const events = (await apiAt.query.system.events()) as unknown as EventRecordLike[];
  const updates: Array<{ id: string; eventIndex: number }> = [];
  let k = 0;
  for (const [eventIdx, record] of events.entries()) {
    if (!isTransferShapedEvent(record)) continue;
    updates.push({ id: makeTransferId(task.height, task.hash, k), eventIndex: eventIdx });
    k++;
  }
  if (task.rowCount > 0 && updates.length !== task.rowCount) {
    return {
      updates: [],
      mismatch: `block #${task.height}: chain has ${updates.length} transfer events, DB has ${task.rowCount} rows — skipped`,
    };
  }
  return { updates };
}

async function applyUpdates(updates: Array<{ id: string; eventIndex: number }>): Promise<number> {
  if (updates.length === 0) return 0;
  const values: string[] = [];
  const params: unknown[] = [];
  updates.forEach((u, i) => {
    values.push(`($${i * 2 + 1}, $${i * 2 + 2}::int)`);
    params.push(u.id, u.eventIndex);
  });
  const res = await query(
    `UPDATE transfer AS t SET event_index = v.ev
       FROM (VALUES ${values.join(',')}) AS v(id, ev)
      WHERE t.id = v.id AND t.event_index IS DISTINCT FROM v.ev`,
    params,
  );
  return res.rowCount ?? 0;
}

async function main() {
  console.log('🔗 Connecting to Reef Chain RPC:', RPC_URL);
  const provider = new WsProvider(RPC_URL);
  const api = await ApiPromise.create({ provider, ...REEF_API_OPTIONS });

  const dryBlocks = (process.env.EVIDX_BLOCKS ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const dryRun = dryBlocks.length > 0;

  let tasks: BlockTask[];
  if (dryRun) {
    console.log(`🧪 Dry run for block(s) ${dryBlocks.join(', ')} — no DB writes`);
    tasks = await Promise.all(dryBlocks.map(async (height) => {
      const hash = (await api.rpc.chain.getBlockHash(height)).toHex();
      return { height, hash, rowCount: 0 };
    }));
  } else {
    const range: string[] = [];
    const params: unknown[] = [];
    if (process.env.EVIDX_FROM) { params.push(Number(process.env.EVIDX_FROM)); range.push(`block_height >= $${params.length}`); }
    if (process.env.EVIDX_TO) { params.push(Number(process.env.EVIDX_TO)); range.push(`block_height <= $${params.length}`); }
    const where = range.length ? `WHERE ${range.join(' AND ')}` : '';
    const res = await query(
      `SELECT block_height, block_hash, COUNT(*)::int AS n
         FROM transfer ${where}
        GROUP BY block_height, block_hash
        ORDER BY block_height`,
      params,
    );
    tasks = res.rows.map((r: { block_height: number; block_hash: string; n: number }) => ({
      height: Number(r.block_height), hash: r.block_hash, rowCount: Number(r.n),
    }));
    console.log(`📦 ${tasks.length} blocks with transfers to re-index (concurrency=${CONCURRENCY})`);
  }

  let processed = 0;
  let updated = 0;
  let failed = 0;
  const mismatches: string[] = [];
  const start = Date.now();
  let cursor = 0;

  async function worker() {
    for (;;) {
      const i = cursor++;
      if (i >= tasks.length) return;
      const task = tasks[i];
      try {
        const { updates, mismatch } = await processBlock(api, task);
        if (mismatch) {
          mismatches.push(mismatch);
        } else if (dryRun) {
          for (const u of updates) console.log(`  would set ${u.id} -> event_index=${u.eventIndex}`);
        } else {
          updated += await applyUpdates(updates);
        }
      } catch (err) {
        failed++;
        if (failed <= 20) console.warn(`⚠️ block #${task.height} failed: ${(err as Error).message.split('\n')[0]}`);
      }
      processed++;
      if (!dryRun && (processed % 5000 === 0 || processed === tasks.length)) {
        const pct = ((processed / tasks.length) * 100).toFixed(1);
        const rate = processed / Math.max(1, (Date.now() - start) / 1000);
        console.log(`  ${processed}/${tasks.length} blocks (${pct}%) — ${updated} rows corrected — ${rate.toFixed(0)} blk/s`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, () => worker()));

  if (mismatches.length) {
    console.warn(`⚠️ ${mismatches.length} blocks skipped (chain/DB row-count mismatch):`);
    for (const m of mismatches.slice(0, 50)) console.warn('   ' + m);
  }
  console.log(`✅ event_index backfill done: ${updated} rows corrected across ${processed} blocks, ${failed} failed, ${mismatches.length} skipped in ${Math.round((Date.now() - start) / 1000)}s`);
  if (!dryRun) await close();
  await api.disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

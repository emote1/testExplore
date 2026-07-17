// Heal historical blocks lost to the CurrencyId decode bug.
//
// The old hand-rolled type overrides declared CurrencyId as 'u32' (it is a
// 1+n byte enum), so any block containing a currencies.* event — notably every
// ReefSwap swap with a REEF leg — mis-aligned the SCALE stream, system.events
// failed to decode and parseBlock skipped the whole block silently. With
// reef-types.ts in place decode works for every era; this script re-parses a
// set of blocks and REPLACES their transfer rows.
//
// Modes (combine with HEAL_FROM/HEAL_TO):
//   HEAL_FROM=700000 HEAL_TO=2200000   walk every block in the range
//   HEAL_SQUID=true                    only heights where the public Subsquid
//                                      has transfers in the range (much faster)
//   HEAL_BLOCKS=1311605,1449234        explicit comma-separated list (testing)
//   HEAL_DRY=true                      parse + report, write nothing
//   HEAL_CONCURRENCY=8                 parallel block parses
//
// Replace semantics: before inserting fresh rows, the block's existing
// transfer rows are deleted and their additive token_holder deltas reversed
// (insertBlockBatch re-applies them), so re-running a block is ~idempotent.
// Staking rows are left untouched (skipStaking=true). Progress is appended to
// heal-progress.log next to the working directory for easy resume.

import * as fs from 'node:fs';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { parseBlock } from './parser.js';
import { insertBlockBatch, query, close } from './db.js';
import { REEF_API_OPTIONS } from './reef-types.js';

const RPC_URL = process.env.RPC_URL ?? 'wss://rpc.reefscan.info/ws';
const SQUID_URL = 'https://squid.subsquid.io/reef-explorer/graphql';
const FROM = Number(process.env.HEAL_FROM ?? 700000);
const TO = Number(process.env.HEAL_TO ?? 2200000);
const USE_SQUID = (process.env.HEAL_SQUID ?? 'false').toLowerCase() === 'true';
const DRY = (process.env.HEAL_DRY ?? 'false').toLowerCase() === 'true';
const CONC = Math.max(1, Number(process.env.HEAL_CONCURRENCY ?? 8));
const EXPLICIT = (process.env.HEAL_BLOCKS ?? '')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n) && n > 0);
const PROGRESS_FILE = process.env.HEAL_PROGRESS_FILE ?? 'heal-progress.log';

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

interface SquidTransferRow {
  id: string;
  blockHeight: number;
}

/** Heights in [from, to] where the public Subsquid has at least one transfer. */
async function squidHeights(from: number, to: number): Promise<number[]> {
  const heights = new Set<number>();
  let afterId = '';
  let fetched = 0;
  for (;;) {
    const res = await fetch(SQUID_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        // limit 200: the public squid rejects larger pages ("response might
        // exceed the size limit")
        query:
          'query($f:Int!,$t:Int!,$a:String!){ transfers(where:{blockHeight_gte:$f, blockHeight_lte:$t, id_gt:$a}, orderBy: id_ASC, limit: 200){ id blockHeight } }',
        variables: { f: from, t: to, a: afterId },
      }),
    });
    if (!res.ok) throw new Error(`squid HTTP ${res.status}`);
    const json = (await res.json()) as { data?: { transfers?: SquidTransferRow[] }; errors?: unknown };
    if (json.errors) throw new Error(`squid error: ${JSON.stringify(json.errors).slice(0, 200)}`);
    const rows = json.data?.transfers ?? [];
    if (rows.length === 0) break;
    fetched += rows.length;
    for (const r of rows) heights.add(r.blockHeight);
    afterId = rows[rows.length - 1].id;
    if (heights.size % 5000 < 1000) {
      console.log(`  squid scan: ${fetched} transfers, ${heights.size} distinct blocks…`);
    }
    if (rows.length < 200) break;
  }
  return [...heights].sort((a, b) => a - b);
}

/** Reverse the token_holder deltas of a block's rows, then delete the rows. */
async function unapplyBlockTransfers(height: number): Promise<number> {
  const res = await query(
    'SELECT token_id, from_id, to_id, type, amount, nft_id, success FROM transfer WHERE block_height = $1',
    [height],
  );
  for (const r of res.rows) {
    if (!r.success) continue;
    const isNft = r.type === 'ERC721' || r.type === 'ERC1155';
    const suffix = isNft && r.nft_id != null ? String(r.nft_id) : '0';
    await query(
      'UPDATE token_holder SET balance = GREATEST(0, balance - $2::numeric) WHERE id = $1',
      [`${r.token_id}-${r.to_id}-${suffix}`, r.amount],
    );
    if (r.from_id !== ZERO_ADDR) {
      await query('UPDATE token_holder SET balance = balance + $2::numeric WHERE id = $1', [
        `${r.token_id}-${r.from_id}-${suffix}`,
        r.amount,
      ]);
    }
  }
  const del = await query('DELETE FROM transfer WHERE block_height = $1', [height]);
  return del.rowCount ?? 0;
}

async function main() {
  console.log('🔗 Connecting to Reef Chain RPC:', RPC_URL);
  const provider = new WsProvider(RPC_URL);
  const api = await ApiPromise.create({ provider, ...REEF_API_OPTIONS });

  // Build the work list
  let heights: number[];
  if (EXPLICIT.length > 0) {
    heights = EXPLICIT;
    console.log(`🩹 Healing ${heights.length} explicit blocks`);
  } else if (USE_SQUID) {
    console.log(`🩹 Asking Subsquid for active blocks in [${FROM}, ${TO}]…`);
    heights = await squidHeights(FROM, TO);
    console.log(`🩹 ${heights.length} blocks with transfers to heal`);
  } else {
    heights = [];
    for (let h = FROM; h <= TO; h++) heights.push(h);
    console.log(`🩹 Healing full range [${FROM}, ${TO}] — ${heights.length} blocks`);
  }
  if (DRY) console.log('🧪 DRY RUN — nothing will be written');

  // Blocks that already have rows (their token_holder deltas need reversal)
  const existing = new Set<number>();
  try {
    const res = await query(
      'SELECT DISTINCT block_height FROM transfer WHERE block_height BETWEEN $1 AND $2',
      [Math.min(...heights), Math.max(...heights)],
    );
    for (const r of res.rows) existing.add(Number(r.block_height));
    console.log(`🩹 ${existing.size} of them already have rows (will be replaced)`);
  } catch (err) {
    if (!DRY) throw err;
    console.warn(`🧪 DB not reachable (${(err as Error).message.split('\n')[0]}) — dry run continues without replace info`);
  }

  let done = 0;
  let healedRows = 0;
  let replacedBlocks = 0;
  let failed: number[] = [];
  const started = Date.now();

  for (let i = 0; i < heights.length; i += CONC) {
    const chunk = heights.slice(i, i + CONC);
    const results = await Promise.allSettled(
      chunk.map(async (h) => {
        const hash = await api.rpc.chain.getBlockHash(h);
        return parseBlock(api, provider, hash.toHex(), false, true);
      }),
    );

    for (let j = 0; j < results.length; j++) {
      const h = chunk[j];
      const r = results[j];
      if (r.status !== 'fulfilled') {
        failed.push(h);
        console.warn(`🩹 #${h} FAILED: ${(r.reason as Error)?.message?.split('\n')[0] ?? 'unknown'}`);
        continue;
      }
      const parsed = r.value;
      if (DRY) {
        if (parsed.transfers.length > 0) {
          console.log(`🧪 #${h}: would write ${parsed.transfers.length} transfers (${existing.has(h) ? 'replacing existing' : 'new'})`);
          healedRows += parsed.transfers.length;
        }
        continue;
      }
      try {
        if (existing.has(h)) {
          await unapplyBlockTransfers(h);
          replacedBlocks++;
        }
        if (parsed.transfers.length > 0 || parsed.accounts.size > 0 || parsed.contracts.size > 0) {
          await insertBlockBatch(parsed);
          healedRows += parsed.transfers.length;
        }
      } catch (dbErr) {
        failed.push(h);
        console.warn(`🩹 #${h} DB error: ${(dbErr as Error).message.split('\n')[0]}`);
      }
    }

    done += chunk.length;
    if (done % 200 < CONC || done === heights.length) {
      const rate = done / Math.max(1, (Date.now() - started) / 1000);
      const eta = Math.round((heights.length - done) / Math.max(0.1, rate));
      const line = `🩹 ${done}/${heights.length} blocks — ${healedRows} rows written, ${replacedBlocks} replaced, ${failed.length} failed — ${rate.toFixed(1)} blk/s, ETA ${Math.floor(eta / 60)}m${eta % 60}s (last #${chunk[chunk.length - 1]})`;
      console.log(line);
      try {
        fs.appendFileSync(PROGRESS_FILE, `${new Date().toISOString()} ${line}\n`);
      } catch {
        /* progress file is best-effort */
      }
    }
  }

  console.log(`\n✅ Heal done: ${healedRows} transfer rows, ${replacedBlocks} blocks replaced, ${failed.length} failed`);
  if (failed.length > 0) {
    console.log(`❌ Failed blocks: ${failed.slice(0, 50).join(',')}${failed.length > 50 ? '…' : ''}`);
  }

  await close();
  await api.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

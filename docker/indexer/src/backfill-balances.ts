// One-off backfill: snapshot the current on-chain balance breakdown
// (free/locked/available/reserved) for every native account already in the DB.
//
// The forward indexer only refreshes accounts as they transact; this fills in
// the whole back-catalogue (~118k accounts) in one pass at the live chain head.
// Safe to re-run any time to re-sync (e.g. on a schedule) — it only UPDATEs.
//
//   build:  npm run build           (compiles to dist/backfill-balances.js)
//   run:    node dist/backfill-balances.js
//   tune:   BAL_CHUNK=500  (accounts per system.account.multi call)

import { ApiPromise, WsProvider } from '@polkadot/api';
import { query, updateAccountBalances, close } from './db.js';
import { fetchBalances } from './balances.js';
import { REEF_API_OPTIONS } from './reef-types.js';

const RPC_URL = process.env.RPC_URL ?? 'wss://rpc.reefscan.info/ws';
const CHUNK = Number(process.env.BAL_CHUNK ?? 500);

async function main() {
  console.log('🔗 Connecting to Reef Chain RPC:', RPC_URL);
  const provider = new WsProvider(RPC_URL);
  const api = await ApiPromise.create({ provider, ...REEF_API_OPTIONS });
  const head = await api.rpc.chain.getFinalizedHead();
  const header = await api.rpc.chain.getHeader(head);
  console.log(`📦 Reading balances at finalized head #${header.number.toNumber()}`);

  // Native account ids only — EVM-keyed rows (0x…) aren't real Substrate accounts.
  const res = await query("SELECT id FROM account WHERE id NOT LIKE '0x%' ORDER BY id");
  const ids: string[] = res.rows.map((r: { id: string }) => r.id);
  console.log(`👛 ${ids.length} native accounts to backfill (chunk=${CHUNK})`);

  let processed = 0;
  let updated = 0;
  const start = Date.now();

  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    try {
      const rows = await fetchBalances(api, chunk);
      await updateAccountBalances(rows);
      updated += rows.length;
    } catch (err) {
      console.warn(`⚠️ chunk @${i} failed: ${(err as Error).message.split('\n')[0]}`);
    }
    processed += chunk.length;
    if (processed % 10000 < CHUNK || processed === ids.length) {
      const pct = ((processed / ids.length) * 100).toFixed(1);
      console.log(`  ${processed}/${ids.length} (${pct}%) — ${updated} updated — ${Math.round((Date.now() - start) / 1000)}s`);
    }
  }

  console.log(`✅ Balance backfill done: ${updated}/${ids.length} accounts updated in ${Math.round((Date.now() - start) / 1000)}s`);
  await close();
  await api.disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

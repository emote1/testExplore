// One-off backfill: populate account.evm_address for every claimed EVM binding.
//
// Reads the full evmAccounts.accounts storage map (EvmAddress -> AccountId) at
// the finalized head and writes the pairs onto account rows. On-chain claims
// are authoritative, so an existing different evm_address is overwritten.
// Native accounts missing from the DB are inserted (balances get filled by the
// regular refresh / backfill-balances later).
//
//   build:  npx tsc -p tsconfig.json
//   run:    node dist/scan-evm-accounts.js
//   env:    SCAN_PAGE=1000  SCAN_DRY=true (report only, no writes)

import { ApiPromise, WsProvider } from '@polkadot/api';
import { query, close } from './db.js';
import { REEF_API_OPTIONS } from './reef-types.js';

const RPC_URL = process.env.RPC_URL ?? 'wss://rpc.reefscan.info/ws';
const PAGE = Math.max(10, Number(process.env.SCAN_PAGE ?? 1000));
const DRY = (process.env.SCAN_DRY ?? 'false').toLowerCase() === 'true';

async function main() {
  console.log('🔗 Connecting to Reef Chain RPC:', RPC_URL);
  const provider = new WsProvider(RPC_URL);
  const api = await ApiPromise.create({ provider, ...REEF_API_OPTIONS });
  const head = await api.rpc.chain.getFinalizedHead();
  const header = await api.rpc.chain.getHeader(head);
  console.log(`🔎 Scanning evmAccounts.accounts at #${header.number.toNumber()} (page=${PAGE}${DRY ? ', DRY RUN' : ''})`);

  let startKey: string | undefined;
  let pairs = 0;
  let written = 0;
  let pages = 0;

  for (;;) {
    const entries = await api.query.evmAccounts.accounts.entriesPaged({
      args: [],
      pageSize: PAGE,
      startKey,
    });
    if (entries.length === 0) break;
    pages++;

    // native id -> evm address (dedupe within the page, claims are 1:1 anyway)
    const byNative = new Map<string, string>();
    for (const [key, value] of entries) {
      const evm = (key.args[0]?.toString() ?? '').toLowerCase();
      const v = value as unknown as {
        isSome?: boolean;
        unwrap?: () => { toString(): string };
        toString(): string;
      };
      const native =
        typeof v?.isSome === 'boolean' ? (v.isSome ? v.unwrap!().toString() : '') : v.toString();
      if (native && /^0x[0-9a-f]{40}$/.test(evm)) byNative.set(native, evm);
    }
    pairs += byNative.size;

    if (!DRY && byNative.size > 0) {
      const values: unknown[] = [];
      const tuples = [...byNative.entries()]
        .map(([n, e], i) => {
          values.push(n, e);
          return `($${i * 2 + 1}, $${i * 2 + 2}, NOW())`;
        })
        .join(',');
      const res = await query(
        `INSERT INTO account (id, evm_address, timestamp) VALUES ${tuples}
         ON CONFLICT (id) DO UPDATE SET evm_address = EXCLUDED.evm_address`,
        values,
      );
      written += res.rowCount ?? 0;
    }

    startKey = entries[entries.length - 1][0].toHex();
    if (pages % 10 === 0) console.log(`  …${pairs} bindings so far`);
    if (entries.length < PAGE) break;
  }

  console.log(
    `✅ ${pairs} claimed EVM bindings${DRY ? ' (dry run, nothing written)' : `, ${written} account rows upserted`}`,
  );

  const check = await query(
    'SELECT id, evm_address FROM account WHERE evm_address IS NOT NULL LIMIT 3',
  );
  console.log('sample rows:', JSON.stringify(check.rows));

  await close();
  await api.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

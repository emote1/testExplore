# План обновления Indexer для полной схемы

## Текущая ситуация

**Indexer работает:** ~2000+ блоков обработано  
**Схема обновлена:** Все таблицы добавлены в `init.sql`  
**Нужно:** Обновить parser для заполнения новых таблиц  

---

## Что нужно обновить

### 1. Типы в `db.ts`

Добавить новые типы для строк БД:

```typescript
export interface BlockRow {
  height: number;
  hash: string;
  parentHash: string;
  stateRoot: string;
  extrinsicsRoot: string;
  author: string | null;
  extrinsicCount: number;
  eventCount: number;
  timestamp: Date;
  processorTimestamp: Date;
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

export interface EventRow {
  id: string;
  blockHeight: number;
  blockHash: string;
  eventIndex: number;
  extrinsicId: string | null;
  section: string;
  method: string;
  data: Record<string, unknown> | null;
  timestamp: Date;
}

export interface StakingRow {
  id: string;
  signerId: string | null;
  type: string; // Reward, Slash, Bonded, Unbonded, Withdrawn
  amount: string;
  era: number | null;
  validatorId: string | null;
  timestamp: Date;
}
```

### 2. Функции вставки в `db.ts`

```typescript
export async function insertBlockBatch(
  blocks: BlockRow[],
  extrinsics: ExtrinsicRow[],
  events: EventRow[],
  transfers: TransferRow[],
  staking: StakingRow[]
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert blocks
    if (blocks.length > 0) {
      const blockValues = blocks.map((b, i) => 
        `($${i * 10 + 1}, $${i * 10 + 2}, $${i * 10 + 3}, $${i * 10 + 4}, $${i * 10 + 5}, $${i * 10 + 6}, $${i * 10 + 7}, $${i * 10 + 8}, $${i * 10 + 9}, $${i * 10 + 10})`
      ).join(',');
      
      const blockParams = blocks.flatMap(b => [
        b.height, b.hash, b.parentHash, b.stateRoot, b.extrinsicsRoot,
        b.author, b.extrinsicCount, b.eventCount, b.timestamp, b.processorTimestamp
      ]);

      await client.query(
        `INSERT INTO block (height, hash, parent_hash, state_root, extrinsics_root, author, extrinsic_count, event_count, timestamp, processor_timestamp)
         VALUES ${blockValues}
         ON CONFLICT (height) DO NOTHING`,
        blockParams
      );
    }

    // Insert extrinsics
    if (extrinsics.length > 0) {
      const extrinsicValues = extrinsics.map((e, i) =>
        `($${i * 14 + 1}, $${i * 14 + 2}, $${i * 14 + 3}, $${i * 14 + 4}, $${i * 14 + 5}, $${i * 14 + 6}, $${i * 14 + 7}, $${i * 14 + 8}, $${i * 14 + 9}, $${i * 14 + 10}, $${i * 14 + 11}, $${i * 14 + 12}, $${i * 14 + 13}, $${i * 14 + 14})`
      ).join(',');

      const extrinsicParams = extrinsics.flatMap(e => [
        e.id, e.blockHeight, e.blockHash, e.extrinsicIndex, e.hash, e.signerId,
        e.method, e.section, e.args ? JSON.stringify(e.args) : null,
        e.signature, e.nonce, e.tip, e.fee, e.success, e.errorMessage, e.timestamp
      ]);

      await client.query(
        `INSERT INTO extrinsic (id, block_height, block_hash, extrinsic_index, hash, signer_id, method, section, args, signature, nonce, tip, fee, success, error_message, timestamp)
         VALUES ${extrinsicValues}
         ON CONFLICT (id) DO NOTHING`,
        extrinsicParams
      );
    }

    // Insert events
    if (events.length > 0) {
      const eventValues = events.map((e, i) =>
        `($${i * 8 + 1}, $${i * 8 + 2}, $${i * 8 + 3}, $${i * 8 + 4}, $${i * 8 + 5}, $${i * 8 + 6}, $${i * 8 + 7}, $${i * 8 + 8})`
      ).join(',');

      const eventParams = events.flatMap(e => [
        e.id, e.blockHeight, e.blockHash, e.eventIndex, e.extrinsicId,
        e.section, e.method, e.data ? JSON.stringify(e.data) : null, e.timestamp
      ]);

      await client.query(
        `INSERT INTO event (id, block_height, block_hash, event_index, extrinsic_id, section, method, data, timestamp)
         VALUES ${eventValues}
         ON CONFLICT (id) DO NOTHING`,
        eventParams
      );
    }

    // Insert transfers (existing code)
    if (transfers.length > 0) {
      // ... existing transfer insert code ...
    }

    // Insert staking
    if (staking.length > 0) {
      const stakingValues = staking.map((s, i) =>
        `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7})`
      ).join(',');

      const stakingParams = staking.flatMap(s => [
        s.id, s.signerId, s.type, s.amount, s.era, s.validatorId, s.timestamp
      ]);

      await client.query(
        `INSERT INTO staking (id, signer_id, type, amount, era, validator_id, timestamp)
         VALUES ${stakingValues}
         ON CONFLICT (id) DO NOTHING`,
        stakingParams
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### 3. Обновить `parser.ts`

Основные изменения:

```typescript
export async function parseBlock(api: ApiPromise, blockHash: string): Promise<ParsedBlock> {
  const accounts = new Map<string, string | null>();
  const contracts = new Map<string, { name: string; type: string; data: Record<string, unknown> | null }>();
  const extrinsics: ExtrinsicRow[] = [];
  const events: EventRow[] = [];
  const transfers: TransferRow[] = [];
  const staking: StakingRow[] = [];

  const [header, apiAt, signedBlock] = await Promise.all([
    api.rpc.chain.getHeader(blockHash),
    api.at(blockHash),
    api.rpc.chain.getBlock(blockHash),
  ]);

  const blockHeight = header.number.toNumber();
  const parentHash = header.parentHash.toHex();
  const stateRoot = header.stateRoot.toHex();
  const extrinsicsRoot = header.extrinsicsRoot.toHex();
  
  let eventsRaw: unknown;
  let timestamp = new Date();
  let author: string | null = null;

  try {
    const [evts, tsNow] = await Promise.all([
      apiAt.query.system.events(),
      apiAt.query.timestamp.now(),
    ]);
    eventsRaw = evts;
    timestamp = new Date(Number(tsNow.toString()));
    
    // Get block author (validator)
    try {
      const digest = header.digest;
      // Extract author from PreRuntime consensus digest
      // This is simplified - actual implementation depends on consensus
      author = null; // TODO: implement author extraction
    } catch {
      author = null;
    }
  } catch (error) {
    console.warn(`⚠️ Skip block #${blockHeight}: failed to decode`, error);
    return {
      block: {
        height: blockHeight,
        hash: blockHash,
        parentHash,
        stateRoot,
        extrinsicsRoot,
        author,
        extrinsicCount: 0,
        eventCount: 0,
        timestamp,
        processorTimestamp: new Date(),
      },
      accounts,
      contracts,
      extrinsics: [],
      events: [],
      transfers: [],
      staking: [],
    };
  }

  // Parse extrinsics
  const blockExtrinsics = signedBlock.block.extrinsics;
  for (let i = 0; i < blockExtrinsics.length; i++) {
    const ext = blockExtrinsics[i];
    const extrinsicId = `${padBlockNum(blockHeight)}-${blockHash.slice(2, 7)}-${String(i).padStart(3, '0')}`;
    
    let signerId: string | null = null;
    let signature: string | null = null;
    let nonce: number | null = null;
    let tip = '0';

    if (ext.isSigned) {
      signerId = ext.signer.toString();
      signature = ext.signature.toString();
      nonce = ext.nonce.toNumber();
      tip = ext.tip?.toString() ?? '0';
      accounts.set(signerId, null);
    }

    const method = ext.method.method;
    const section = ext.method.section;
    const args = ext.method.args.toJSON() as Record<string, unknown>;

    extrinsics.push({
      id: extrinsicId,
      blockHeight,
      blockHash,
      extrinsicIndex: i,
      hash: ext.hash.toHex(),
      signerId,
      method,
      section,
      args,
      signature,
      nonce,
      tip,
      fee: '0', // Will be calculated from events
      success: true, // Will be updated from events
      errorMessage: null,
      timestamp,
    });
  }

  // Parse events
  let transferIndex = 0;
  let stakingIndex = 0;
  const eventsList = eventsRaw as unknown as Array<{
    event: { section: string; method: string; data: unknown[] };
    phase: { isApplyExtrinsic: boolean; asApplyExtrinsic: { toNumber(): number } };
  }>;

  for (let eventIndex = 0; eventIndex < eventsList.length; eventIndex++) {
    const record = eventsList[eventIndex];
    const { event, phase } = record;
    const extrinsicIndex = phase.isApplyExtrinsic ? phase.asApplyExtrinsic.toNumber() : null;
    const extrinsicId = extrinsicIndex !== null
      ? `${padBlockNum(blockHeight)}-${blockHash.slice(2, 7)}-${String(extrinsicIndex).padStart(3, '0')}`
      : null;

    // Store event
    events.push({
      id: `${padBlockNum(blockHeight)}-${String(eventIndex).padStart(6, '0')}`,
      blockHeight,
      blockHash,
      eventIndex,
      extrinsicId,
      section: event.section,
      method: event.method,
      data: event.data.toJSON() as Record<string, unknown>,
      timestamp,
    });

    // Parse specific events for transfers and staking
    
    // Native REEF transfer
    if (event.section === 'balances' && event.method === 'Transfer') {
      const [from, to, amount] = event.data as unknown as [
        { toString(): string },
        { toString(): string },
        { toString(): string },
      ];

      const fromAddr = from.toString();
      const toAddr = to.toString();
      accounts.set(fromAddr, null);
      accounts.set(toAddr, null);

      transfers.push({
        id: makeTransferId(blockHeight, blockHash, transferIndex++),
        blockHeight,
        blockHash,
        finalized: true,
        extrinsicId,
        extrinsicHash: extrinsicIndex !== null ? extrinsics[extrinsicIndex]?.hash : null,
        extrinsicIndex: extrinsicIndex ?? 0,
        eventIndex,
        fromId: fromAddr,
        toId: toAddr,
        tokenId: REEF_CONTRACT,
        fromEvmAddress: null,
        toEvmAddress: null,
        type: 'Native',
        reefswapAction: null,
        amount: amount.toString(),
        denom: null,
        nftId: null,
        success: true,
        timestamp,
      });
    }

    // Staking Reward
    if (event.section === 'staking' && event.method === 'Reward') {
      const [staker, amount] = event.data as unknown as [
        { toString(): string },
        { toString(): string },
      ];

      const stakerId = staker.toString();
      accounts.set(stakerId, null);

      staking.push({
        id: `${padBlockNum(blockHeight)}-staking-${String(stakingIndex++).padStart(6, '0')}`,
        signerId: stakerId,
        type: 'Reward',
        amount: amount.toString(),
        era: null, // TODO: get current era
        validatorId: null,
        timestamp,
      });
    }

    // Staking Bonded
    if (event.section === 'staking' && event.method === 'Bonded') {
      const [staker, amount] = event.data as unknown as [
        { toString(): string },
        { toString(): string },
      ];

      const stakerId = staker.toString();
      accounts.set(stakerId, null);

      staking.push({
        id: `${padBlockNum(blockHeight)}-staking-${String(stakingIndex++).padStart(6, '0')}`,
        signerId: stakerId,
        type: 'Bonded',
        amount: amount.toString(),
        era: null,
        validatorId: null,
        timestamp,
      });
    }

    // ERC20 Transfer (from EVM logs)
    if (event.section === 'evm' && event.method === 'Log') {
      // ... existing ERC20 parsing code ...
    }

    // ExtrinsicFailed - mark extrinsic as failed
    if (event.section === 'system' && event.method === 'ExtrinsicFailed') {
      if (extrinsicIndex !== null && extrinsics[extrinsicIndex]) {
        extrinsics[extrinsicIndex].success = false;
        extrinsics[extrinsicIndex].errorMessage = JSON.stringify(event.data.toJSON());
      }
    }
  }

  // Detect swaps
  detectAndMarkSwaps(transfers);

  // Create block row
  const block: BlockRow = {
    height: blockHeight,
    hash: blockHash,
    parentHash,
    stateRoot,
    extrinsicsRoot,
    author,
    extrinsicCount: extrinsics.length,
    eventCount: events.length,
    timestamp,
    processorTimestamp: new Date(),
  };

  return {
    block,
    accounts,
    contracts,
    extrinsics,
    events,
    transfers,
    staking,
  };
}
```

---

## Когда обновлять

**Рекомендация:** Дождись завершения текущего genesis backfill (~2000 блоков → 14M блоков)

**Или:** Если хочешь обновить сейчас:
1. Останови indexer: `docker compose -f docker-compose.fast.yml stop indexer`
2. Пересоздай БД с новой схемой (уже готова в `init.sql`)
3. Обнови код parser и db.ts
4. Пересобери Docker image: `docker compose -f docker-compose.fast.yml build indexer`
5. Запусти: `docker compose -f docker-compose.fast.yml up -d`

---

## Оценка времени

**С полным parser (все таблицы):**
- Скорость: ~2-3 blocks/sec (больше данных для записи)
- Время полного backfill: **14-20 дней**

**Преимущества:**
- ✅ Tx/min metric (WebSocket)
- ✅ Total Staked (без RPC)
- ✅ Block explorer
- ✅ Failed transactions
- ✅ Fee analytics
- ✅ Staking history

---

## Следующие шаги после backfill

1. **Track таблицы в Hasura Console**
2. **Обновить frontend queries** для использования локальных данных
3. **Протестировать все метрики**
4. **Деплой на Hetzner CX43**

---

**Схема готова! Parser план готов! Можно обновлять когда будешь готов** 🚀

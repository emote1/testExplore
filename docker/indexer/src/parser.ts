import type { ApiPromise } from '@polkadot/api';
import type { TransferRow, StakingRow, EraValidatorRow, NftRecord, ContractCallRow, ExtrinsicRow } from './db.js';

// REEF native token contract address (used by squid convention)
const REEF_CONTRACT = '0x0000000000000000000000000000000001000000';

export interface ParsedBlock {
  height: number;
  hash: string;
  timestamp: Date;
  accounts: Map<string, string | null>; // nativeAddr → evmAddr|null
  contracts: Map<string, { name: string; type: string; data: Record<string, unknown> | null }>;
  transfers: TransferRow[];
  stakingEvents: StakingRow[];
  eraValidators: EraValidatorRow[];
  nfts: NftRecord[];
  contractCalls: ContractCallRow[];
  extrinsics: ExtrinsicRow[];
}

// Track last known era to detect era changes
let lastKnownEra: number | null = null;

function padBlockNum(n: number): string {
  return String(n).padStart(10, '0');
}

function makeTransferId(blockHeight: number, blockHash: string, index: number): string {
  const shortHash = blockHash.slice(2, 7);
  return `${padBlockNum(blockHeight)}-${shortHash}-${String(index).padStart(3, '0')}`;
}

function isValidEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

// Cache for token names to avoid repeated RPC calls
const tokenNameCache = new Map<string, string>();

// ERC20 name() selector: 0x06fdde03
// ERC20 symbol() selector: 0x95d89b41
async function fetchTokenName(api: ApiPromise, contractAddress: string): Promise<string> {
  if (tokenNameCache.has(contractAddress)) {
    return tokenNameCache.get(contractAddress)!;
  }

  const fallbackName = `ERC20-${contractAddress.slice(0, 8)}`;

  try {
    // Call name() function
    const nameResult = await api.rpc.eth.call({
      to: contractAddress,
      data: '0x06fdde03', // name() selector
    });

    const hex = nameResult.toString();
    if (hex && hex.length > 2) {
      // Decode ABI-encoded string (skip 0x, offset 64 chars, length 64 chars, then string data)
      const data = hex.slice(2);
      if (data.length >= 128) {
        const lengthHex = data.slice(64, 128);
        const strLength = parseInt(lengthHex, 16);
        if (strLength > 0 && strLength < 100) {
          const strHex = data.slice(128, 128 + strLength * 2);
          const name = Buffer.from(strHex, 'hex').toString('utf8').trim();
          if (name && name.length > 0 && /^[\x20-\x7E]+$/.test(name)) {
            tokenNameCache.set(contractAddress, name);
            return name;
          }
        }
      }
    }
  } catch {
    // Ignore errors, use fallback
  }

  tokenNameCache.set(contractAddress, fallbackName);
  return fallbackName;
}

export async function parseBlock(api: ApiPromise, blockHash: string, skipExtrinsics = false, skipStaking = false): Promise<ParsedBlock> {
  const accounts = new Map<string, string | null>();
  const contracts = new Map<string, { name: string; type: string; data: Record<string, unknown> | null }>();
  const transfers: TransferRow[] = [];
  const stakingEvents: StakingRow[] = [];
  const eraValidators: EraValidatorRow[] = [];
  const nfts: NftRecord[] = [];
  const contractCalls: ContractCallRow[] = [];
  const extrinsics: ExtrinsicRow[] = [];

  // Fetch header + api.at first (lightweight, fast)
  const [header, apiAt] = await Promise.all([
    api.rpc.chain.getHeader(blockHash),
    api.at(blockHash),
  ]);
  const blockHeight = header.number.toNumber();
  let timestamp = new Date();
  const emptyResult: ParsedBlock = { height: blockHeight, hash: blockHash, timestamp, accounts, contracts, transfers, stakingEvents, eraValidators, nfts, contractCalls, extrinsics };

  // Decode events + timestamp (can fail on incompatible runtime)
  let events: unknown;
  try {
    const [eventsRaw, tsNow] = await Promise.all([
      apiAt.query.system.events(),
      apiAt.query.timestamp.now(),
    ]);
    events = eventsRaw;
    timestamp = new Date(Number(tsNow.toString()));
    emptyResult.timestamp = timestamp;
  } catch (error) {
    console.warn(`⚠️ Skip block #${blockHeight}: failed to decode events/timestamp: ${(error as Error).message.split('\n')[0]}`);
    return emptyResult;
  }

  // Only fetch full block body when extrinsics are needed (forward mode)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let signedBlock: any = null;
  if (!skipExtrinsics) {
    try {
      signedBlock = await (api.rpc.chain.getBlock(blockHash) as Promise<unknown>);
    } catch (error) {
      console.warn(`⚠️ Block #${blockHeight}: getBlock failed, extrinsics will be empty: ${(error as Error).message.split('\n')[0]}`);
    }
  }

  // ── Extract extrinsics from block body ──
  const eventRecords = events as unknown as Array<{
    event: { section: string; method: string; data: unknown[] };
    phase: { isApplyExtrinsic: boolean; asApplyExtrinsic: { toNumber(): number } };
  }>;

  // Build a map: extrinsicIndex → success (from ExtrinsicSuccess/ExtrinsicFailed events)
  const extrinsicSuccess = new Map<number, { success: boolean; errorMessage: string | null }>();
  for (const record of eventRecords) {
    const { event, phase } = record;
    if (!phase.isApplyExtrinsic) continue;
    const idx = phase.asApplyExtrinsic.toNumber();
    if (event.section === 'system' && event.method === 'ExtrinsicSuccess') {
      extrinsicSuccess.set(idx, { success: true, errorMessage: null });
    } else if (event.section === 'system' && event.method === 'ExtrinsicFailed') {
      const errStr = event.data?.[0]?.toString() ?? 'Unknown error';
      extrinsicSuccess.set(idx, { success: false, errorMessage: errStr });
    }
  }

  if (signedBlock?.block?.extrinsics) try {
    const blockExtrinsics = signedBlock.block.extrinsics;
    for (let i = 0; i < blockExtrinsics.length; i++) {
      const ext = blockExtrinsics[i];
      const section = ext.method.section;
      const method = ext.method.method;

      // Skip inherent extrinsics (timestamp.set, parachainSystem, etc.)
      if (section === 'timestamp' || section === 'parachainSystem' || section === 'authorship') continue;

      const signer = ext.isSigned ? ext.signer.toString() : null;
      const exHash = ext.hash.toHex();
      const nonce = ext.isSigned ? ext.nonce.toNumber() : null;
      const tip = ext.isSigned ? ext.tip.toString() : '0';
      const signature = ext.isSigned ? ext.signature.toString() : null;

      const result = extrinsicSuccess.get(i) ?? { success: true, errorMessage: null };

      // Add extrinsic to the list
      extrinsics.push({
        id: `${padBlockNum(blockHeight)}-${String(i).padStart(3, '0')}`,
        blockHeight,
        blockHash,
        extrinsicIndex: i,
        hash: exHash,
        signerId: signer,
        method,
        section,
        args: null, // Skip args to reduce storage
        signature,
        nonce,
        tip,
        fee: '0', // Fee calculated from events if needed
        success: result.success,
        errorMessage: result.errorMessage,
        timestamp,
      });

      if (signer) {
        accounts.set(signer, null);
      }

      // Parse EVM calls (evm.call extrinsics) for contract interaction history
      if (section === 'evm' && method === 'call' && signer) {
        try {
          const args = ext.method.args;
          // evm.call(target, input, value, gas_limit, max_fee_per_gas, max_priority_fee_per_gas, nonce, access_list)
          const target = args[0]?.toString()?.toLowerCase();
          const input = args[1]?.toString();
          const value = args[2]?.toString() ?? '0';
          const gasLimit = args[3]?.toString() ?? null;

          if (target && isValidEvmAddress(target)) {
            // Register contract if not known
            if (!contracts.has(target)) {
              contracts.set(target, {
                name: `Contract-${target.slice(0, 8)}`,
                type: 'Contract',
                data: null,
              });
            }

            contractCalls.push({
              id: `${padBlockNum(blockHeight)}-${String(i).padStart(3, '0')}-call`,
              blockHeight,
              extrinsicId: `${padBlockNum(blockHeight)}-${String(i).padStart(3, '0')}`,
              fromId: signer,
              toId: target,
              value,
              gasLimit,
              gasUsed: null, // would need receipt to get this
              input: input ? input.slice(0, 10) : null, // method selector only (4 bytes = 10 chars with 0x)
              success: result.success,
              errorMessage: result.errorMessage,
              timestamp,
            });

            accounts.set(signer, null);
          }
        } catch (e) {
          // Skip malformed evm.call
        }
      }
    }
  } catch (err) {
    console.warn(`⚠️ Block #${blockHeight}: failed to parse extrinsics: ${(err as Error).message.split('\n')[0]}`);
  }

  let transferIndex = 0;
  let stakingEventIndex = 0;

  // Process all events looking for balance transfers and staking events
  for (const record of eventRecords) {
    const { event, phase } = record;
    const extrinsicIndex = phase.isApplyExtrinsic ? phase.asApplyExtrinsic.toNumber() : 0;

    // Native REEF transfer: balances.Transfer(from, to, amount)
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

      const extrinsicHash = null;

      transfers.push({
        id: makeTransferId(blockHeight, blockHash, transferIndex++),
        blockHeight,
        blockHash,
        finalized: true,
        extrinsicId: `${padBlockNum(blockHeight)}-${blockHash.slice(2, 7)}-${String(extrinsicIndex).padStart(3, '0')}`,
        extrinsicHash,
        extrinsicIndex,
        eventIndex: transferIndex - 1,
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

    // EVM Log events: ERC20 Transfer, ERC721 Transfer, ERC1155 TransferSingle
    if (event.section === 'evm' && event.method === 'Log') {
      try {
        const logData = event.data[0] as unknown as {
          address?: { toString(): string };
          topics?: Array<{ toString(): string }>;
          data?: { toString(): string };
        };

        if (!logData?.topics || logData.topics.length < 1) continue;

        const topic0 = logData.topics[0].toString();
        const contractAddress = (logData.address?.toString() ?? '').toLowerCase();
        // Transfer(address,address,uint256) — shared by ERC20 (3 topics) and ERC721 (4 topics)
        const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
        // TransferSingle(address,address,address,uint256,uint256)
        const TRANSFER_SINGLE_TOPIC = '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62';

        // ── ERC721 Transfer: 4 topics (from, to, tokenId all indexed) ──
        if (topic0 === TRANSFER_TOPIC && logData.topics.length === 4) {
          const fromEvm = ('0x' + logData.topics[1].toString().slice(-40)).toLowerCase();
          const toEvm = ('0x' + logData.topics[2].toString().slice(-40)).toLowerCase();
          const tokenIdHex = logData.topics[3].toString();
          const nftTokenId = BigInt(tokenIdHex).toString();

          if (!isValidEvmAddress(fromEvm) || !isValidEvmAddress(toEvm)) continue;

          accounts.set(fromEvm, fromEvm);
          accounts.set(toEvm, toEvm);

          // ERC721 type takes priority over ERC20 (same Transfer topic but 4 topics vs 3)
          if (contractAddress) {
            const existing = contracts.get(contractAddress);
            if (!existing || existing.type === 'ERC20') {
              contracts.set(contractAddress, {
                name: `ERC721-${contractAddress.slice(0, 8)}`,
                type: 'ERC721',
                data: null,
              });
            }
          }

          const nftId = `${contractAddress}-${nftTokenId}`;

          transfers.push({
            id: makeTransferId(blockHeight, blockHash, transferIndex++),
            blockHeight,
            blockHash,
            finalized: true,
            extrinsicId: `${padBlockNum(blockHeight)}-${blockHash.slice(2, 7)}-${String(extrinsicIndex).padStart(3, '0')}`,
            extrinsicHash: null,
            extrinsicIndex,
            eventIndex: transferIndex - 1,
            fromId: fromEvm,
            toId: toEvm,
            tokenId: contractAddress,
            fromEvmAddress: fromEvm,
            toEvmAddress: toEvm,
            type: 'ERC721',
            reefswapAction: null,
            amount: '1',
            denom: null,
            nftId,
            success: true,
            timestamp,
          });

          nfts.push({
            id: nftId,
            contractId: contractAddress,
            tokenId: nftTokenId,
            ownerId: toEvm,
            timestamp,
          });

          continue;
        }

        // ── ERC20 Transfer: 3 topics (from, to indexed, value in data) ──
        if (topic0 === TRANSFER_TOPIC && logData.topics.length === 3) {
          const fromEvm = ('0x' + logData.topics[1].toString().slice(-40)).toLowerCase();
          const toEvm = ('0x' + logData.topics[2].toString().slice(-40)).toLowerCase();

          if (!isValidEvmAddress(fromEvm) || !isValidEvmAddress(toEvm)) continue;

          accounts.set(fromEvm, fromEvm);
          accounts.set(toEvm, toEvm);

          if (contractAddress && !contracts.has(contractAddress)) {
            contracts.set(contractAddress, {
              name: `ERC20-${contractAddress.slice(0, 8)}`,
              type: 'ERC20',
              data: null,
            });
          }
          const rawData = logData.data?.toString() ?? '0x0';
          const amountBig = BigInt(rawData).toString();

          transfers.push({
            id: makeTransferId(blockHeight, blockHash, transferIndex++),
            blockHeight,
            blockHash,
            finalized: true,
            extrinsicId: `${padBlockNum(blockHeight)}-${blockHash.slice(2, 7)}-${String(extrinsicIndex).padStart(3, '0')}`,
            extrinsicHash: null,
            extrinsicIndex,
            eventIndex: transferIndex - 1,
            fromId: fromEvm,
            toId: toEvm,
            tokenId: contractAddress,
            fromEvmAddress: fromEvm,
            toEvmAddress: toEvm,
            type: 'ERC20',
            reefswapAction: null,
            amount: amountBig,
            denom: null,
            nftId: null,
            success: true,
            timestamp,
          });

          continue;
        }

        // ── ERC1155 TransferSingle: topics=[sig, operator, from, to], data=[id, value] ──
        if (topic0 === TRANSFER_SINGLE_TOPIC && logData.topics.length >= 4) {
          const fromEvm = ('0x' + logData.topics[2].toString().slice(-40)).toLowerCase();
          const toEvm = ('0x' + logData.topics[3].toString().slice(-40)).toLowerCase();

          if (!isValidEvmAddress(fromEvm) || !isValidEvmAddress(toEvm)) continue;

          // data = abi.encode(uint256 id, uint256 value)
          const rawData = logData.data?.toString() ?? '0x';
          if (rawData.length < 130) continue; // need at least 2x 32-byte words
          const nftTokenId = BigInt('0x' + rawData.slice(2, 66)).toString();
          const amount = BigInt('0x' + rawData.slice(66, 130)).toString();

          accounts.set(fromEvm, fromEvm);
          accounts.set(toEvm, toEvm);

          if (contractAddress && !contracts.has(contractAddress)) {
            contracts.set(contractAddress, {
              name: `ERC1155-${contractAddress.slice(0, 8)}`,
              type: 'ERC1155',
              data: null,
            });
          }

          const nftId = `${contractAddress}-${nftTokenId}`;

          transfers.push({
            id: makeTransferId(blockHeight, blockHash, transferIndex++),
            blockHeight,
            blockHash,
            finalized: true,
            extrinsicId: `${padBlockNum(blockHeight)}-${blockHash.slice(2, 7)}-${String(extrinsicIndex).padStart(3, '0')}`,
            extrinsicHash: null,
            extrinsicIndex,
            eventIndex: transferIndex - 1,
            fromId: fromEvm,
            toId: toEvm,
            tokenId: contractAddress,
            fromEvmAddress: fromEvm,
            toEvmAddress: toEvm,
            type: 'ERC1155',
            reefswapAction: null,
            amount,
            denom: null,
            nftId,
            success: true,
            timestamp,
          });

          nfts.push({
            id: nftId,
            contractId: contractAddress,
            tokenId: nftTokenId,
            ownerId: toEvm,
            timestamp,
          });

          continue;
        }
      } catch {
        // Skip malformed EVM logs
      }
    }

    // ── Staking events: Reward, Slash, Bonded, Unbonded, Withdrawn ──
    if (!skipStaking && event.section === 'staking') {
      try {
        const stakingType = event.method; // Reward, Slash, Bonded, Unbonded, Withdrawn, etc.
        if (['Rewarded', 'Reward', 'Slashed', 'Slash', 'Bonded', 'Unbonded', 'Withdrawn'].includes(stakingType)) {
          const normalizedType = stakingType === 'Rewarded' ? 'Reward'
            : stakingType === 'Slashed' ? 'Slash'
            : stakingType;

          // Reward/Slash: (AccountId, Balance) or (stash, amount)
          const staker = event.data[0]?.toString() ?? '';
          const amount = event.data[1]?.toString() ?? '0';

          if (staker) {
            accounts.set(staker, null);
            stakingEvents.push({
              id: `${padBlockNum(blockHeight)}-stk-${String(stakingEventIndex++).padStart(3, '0')}`,
              signerId: staker,
              type: normalizedType,
              amount,
              era: null, // will be filled if we can query current era
              validatorId: null,
              timestamp,
            });
          }
        }
      } catch {
        // Skip malformed staking events
      }
    }
  }

  // ── Try to fill era for staking events and detect era change ──
  if (!skipStaking) try {
    const currentEraRaw = await apiAt.query.staking.currentEra();
    const eraNum = Number(currentEraRaw.toString());
    const currentEra = Number.isFinite(eraNum) && eraNum > 0 ? eraNum : null;

    if (currentEra !== null) {
      // Fill era in staking events
      for (const s of stakingEvents) {
        s.era = currentEra;
      }

      // Detect era change and fetch validator info
      if (lastKnownEra !== null && currentEra > lastKnownEra) {
        console.log(`🏛️ Era change detected: ${lastKnownEra} → ${currentEra} at block #${blockHeight}`);
        try {
          const validators = await apiAt.query.session.validators();
          const validatorAddrs = (validators as unknown as Array<{ toString(): string }>).map(v => v.toString());

          for (const addr of validatorAddrs) {
            try {
              const exposure = await apiAt.query.staking.erasStakers(currentEra, addr);
              const exp = exposure as unknown as {
                total: { toString(): string };
                own: { toString(): string };
                others: Array<unknown>;
              };

              const prefs = await apiAt.query.staking.erasValidatorPrefs(currentEra, addr);
              const commission = Number((prefs as unknown as { commission: { toNumber(): number } }).commission.toNumber()) / 10_000_000; // Perbill → %

              accounts.set(addr, null);
              eraValidators.push({
                id: `${currentEra}-${addr}`,
                era: currentEra,
                address: addr,
                total: exp.total.toString(),
                own: exp.own.toString(),
                nominatorsCount: Array.isArray(exp.others) ? exp.others.length : 0,
                commission,
                blocked: false,
                timestamp,
              });
            } catch {
              // Skip individual validator errors
            }
          }
          console.log(`🏛️ Indexed ${eraValidators.length} validators for era ${currentEra}`);
        } catch (err) {
          console.warn(`⚠️ Failed to fetch validators for era ${currentEra}: ${(err as Error).message.split('\n')[0]}`);
        }
      }
      lastKnownEra = currentEra;
    }
  } catch {
    // staking.currentEra not available — skip
  }

  // Detect swaps by analyzing transfers grouped by extrinsicHash
  detectAndMarkSwaps(transfers);

  // Fetch real names for new ERC20/ERC721/ERC1155 contracts (skip REEF native)
  const contractsToFetchNames = [...contracts.entries()].filter(
    ([addr, c]) => (c.type === 'ERC20' || c.type === 'ERC721' || c.type === 'ERC1155') && addr !== REEF_CONTRACT && c.name.startsWith('ERC')
  );
  if (contractsToFetchNames.length > 0) {
    await Promise.all(
      contractsToFetchNames.map(async ([addr, c]) => {
        const name = await fetchTokenName(api, addr);
        c.name = name;
      })
    );
  }

  return { height: blockHeight, hash: blockHash, timestamp, accounts, contracts, transfers, stakingEvents, eraValidators, nfts, contractCalls, extrinsics };
}

/**
 * Detects swap patterns in transfers and marks them with reefswapAction.
 * A swap is detected when:
 * - Multiple ERC20 transfers in same extrinsic
 * - At least one incoming and one outgoing transfer
 * - Different tokens involved (token_id differs)
 */
function detectAndMarkSwaps(transfers: TransferRow[]): void {
  // Group transfers by extrinsicHash
  const byExtrinsic = new Map<string, TransferRow[]>();
  for (const t of transfers) {
    if (!t.extrinsicHash || t.type !== 'ERC20') continue;
    const group = byExtrinsic.get(t.extrinsicHash) || [];
    group.push(t);
    byExtrinsic.set(t.extrinsicHash, group);
  }

  // Analyze each extrinsic group
  for (const [, group] of byExtrinsic.entries()) {
    if (group.length < 2) continue; // Need at least 2 legs for swap

    // Collect unique addresses and tokens
    const addresses = new Set<string>();
    const tokens = new Set<string>();
    for (const t of group) {
      addresses.add(t.fromId.toLowerCase());
      addresses.add(t.toId.toLowerCase());
      tokens.add(t.tokenId.toLowerCase());
    }

    // Swap requires at least 2 different tokens
    if (tokens.size < 2) continue;

    // Find a user address (appears in both from and to across different legs)
    let userAddress: string | null = null;
    for (const addr of addresses) {
      const hasOutgoing = group.some(t => t.fromId.toLowerCase() === addr);
      const hasIncoming = group.some(t => t.toId.toLowerCase() === addr);
      if (hasOutgoing && hasIncoming) {
        userAddress = addr;
        break;
      }
    }

    if (!userAddress) continue; // No clear user address found

    // Identify incoming and outgoing legs for the user
    const outgoing = group.filter(t => t.fromId.toLowerCase() === userAddress);
    const incoming = group.filter(t => t.toId.toLowerCase() === userAddress);

    if (outgoing.length === 0 || incoming.length === 0) continue;

    // Check if tokens differ between largest incoming and outgoing
    const maxOut = outgoing.reduce((max, t) => 
      BigInt(t.amount) > BigInt(max.amount) ? t : max
    );
    const maxIn = incoming.reduce((max, t) => 
      BigInt(t.amount) > BigInt(max.amount) ? t : max
    );

    if (maxOut.tokenId.toLowerCase() === maxIn.tokenId.toLowerCase()) continue;

    // Mark all transfers in this extrinsic as Swap
    for (const t of group) {
      t.reefswapAction = 'Swap';
    }
  }
}

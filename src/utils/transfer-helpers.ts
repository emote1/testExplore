import { UiTransfer } from '../data/transfer-mapper';
import { toEpochMs, safeBigInt } from './token-helpers';

import { getString } from './object';

interface TransferNode {
  extrinsicHash?: string;
  reefswapAction?: unknown;
  isNft?: boolean;
  type?: string;
}

/**
 * Identifies extrinsic hashes that might have missing swap partner legs.
 */
export function identifyMissingPartnerHashes(
  nodes: TransferNode[],
  alreadyLoadedHashes: Set<string> = new Set(),
  options: { strict?: boolean } = {}
): string[] {
  const byHash: Record<string, TransferNode[]> = {};
  for (const n of nodes) {
    const h = getString(n, ['extrinsicHash']);
    if (!h) continue;
    (byHash[h] = byHash[h] || []).push(n);
  }

  const missing: string[] = [];
  for (const [h, arr] of Object.entries(byHash)) {
    if (alreadyLoadedHashes.has(h)) continue;
    
    const hasFlag = arr.some((g) => Boolean(g.reefswapAction));
    
    if (options.strict) {
      const fungible = arr.filter((g) => !g.isNft);
      const hasIn = fungible.some((g) => String(g.type) === 'INCOMING');
      const hasOut = fungible.some((g) => String(g.type) === 'OUTGOING');
      if (hasFlag || !(hasIn && hasOut)) missing.push(h);
    } else {
      if (hasFlag) missing.push(h);
    }
  }
  return missing;
}

/**
 * Ensures a list of transfers has unique IDs.
 */
export function ensureUniqueTransfers(transfers: UiTransfer[]): UiTransfer[] {
  const seen = new Set<string>();
  const unique: UiTransfer[] = [];
  for (const t of transfers) {
    if (t && !seen.has(t.id)) {
      seen.add(t.id);
      unique.push(t);
    }
  }
  return unique;
}

/**
 * Sorts transfers by amount (ASC) and then ID (ASC).
 */
export function sortTransfersByAmount(transfers: UiTransfer[]): UiTransfer[] {
  return [...transfers].sort((a, b) => {
    const da = a.amountBI ?? safeBigInt(a.amount);
    const db = b.amountBI ?? safeBigInt(b.amount);
    if (da !== db) return da < db ? -1 : 1;
    if (a.id === b.id) return 0;
    return a.id < b.id ? -1 : 1;
  });
}

/**
 * Sorts transfers by timestamp (DESC) and then ID (DESC).
 */
export function sortTransfersByTimestamp(transfers: UiTransfer[]): UiTransfer[] {
  return [...transfers].sort((a, b) => {
    const ta = toEpochMs(a.timestamp);
    const tb = toEpochMs(b.timestamp);
    if (tb !== ta) return tb - ta; // newer first
    if (a.id === b.id) return 0;
    return a.id < b.id ? 1 : -1;
  });
}

/**
 * Aggregates individual transfer legs into logical SWAP transactions.
 */
export function aggregateSwaps(transfers: UiTransfer[]): UiTransfer[] {
  // Group by extrinsicHash to detect swaps (incoming + outgoing different tokens).
  const byHash = new Map<string, UiTransfer[]>();
  for (const t of transfers) {
    const h = t.extrinsicHash || t.id;
    const arr = byHash.get(h) || [];
    arr.push(t);
    byHash.set(h, arr);
  }

  const aggregated: UiTransfer[] = [];
  for (const [hash, group] of byHash.entries()) {
    const fungible = group.filter(g => !g.isNft);
    const incoming = fungible.filter(g => g.type === 'INCOMING');
    const outgoing = fungible.filter(g => g.type === 'OUTGOING');

    if (!(incoming.length > 0 && outgoing.length > 0)) {
      aggregated.push(...group);
      continue;
    }

    // Pick the largest legs per direction by raw amount
    function pickMax(list: UiTransfer[]): UiTransfer {
      let best = list[0]!;
      for (const it of list) {
        const a = it.amountBI ?? safeBigInt(it.amount);
        const b = best.amountBI ?? safeBigInt(best.amount);
        if (a > b) best = it;
      }
      return best;
    }
    const maxIn = pickMax(incoming);
    const maxOut = pickMax(outgoing);

    // Build SWAP only if dominant tokens differ; otherwise keep individual legs
    if (maxIn.token.id === maxOut.token.id) {
      aggregated.push(...group);
      continue;
    }

    const ts = maxIn.timestamp || maxOut.timestamp;
    const success = group.every(g => g.success);

    // Try to capture a concrete transfer id for linking
    function extractTripleId(src?: string): string | undefined {
      if (!src) return undefined;
      const m = src.match(/0*(\d+)-0*(\d+)-0*(\d+)/);
      if (!m) return undefined;
      return `${String(Number(m[1]))}-${String(Number(m[2]))}-${String(Number(m[3]))}`;
    }
    function buildFromExId(leg?: { extrinsicId?: string; eventIndex?: number }): string | undefined {
      if (!leg?.extrinsicId || leg?.eventIndex == null) return undefined;
      const m = String(leg.extrinsicId).match(/0*(\d+)-0*(\d+)/);
      if (!m) return undefined;
      const event = String(Number(leg.eventIndex));
      if (!Number.isFinite(Number(event))) return undefined;
      return `${String(Number(m[1]))}-${String(Number(m[2]))}-${event}`;
    }
    const preferId = extractTripleId(maxIn.id)
      ?? extractTripleId(maxOut.id)
      ?? buildFromExId(maxIn)
      ?? buildFromExId(maxOut);

    aggregated.push({
      id: `${hash}:swap`,
      from: maxOut.from,
      to: maxIn.to,
      type: 'SWAP',
      method: 'swap',
      amount: maxIn.amount,
      amountBI: maxIn.amountBI ?? safeBigInt(maxIn.amount),
      isNft: false,
      tokenId: null,
      token: maxIn.token,
      timestamp: ts,
      success,
      extrinsicHash: hash,
      blockHeight: (maxIn.blockHeight ?? maxOut.blockHeight),
      extrinsicIndex: (maxIn.extrinsicIndex ?? maxOut.extrinsicIndex),
      eventIndex: (maxIn.eventIndex ?? maxOut.eventIndex),
      extrinsicId: (maxIn.extrinsicId ?? maxOut.extrinsicId),
      swapInfo: {
        sold: { amount: maxOut.amount, amountBI: maxOut.amountBI ?? safeBigInt(maxOut.amount), token: maxOut.token },
        bought: { amount: maxIn.amount, amountBI: maxIn.amountBI ?? safeBigInt(maxIn.amount), token: maxIn.token },
        preferredTransferId: preferId,
      },
    });
  }
  return aggregated;
}

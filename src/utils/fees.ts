// src/utils/fees.ts

/**
 * Utilities for parsing transaction fees from Subsquid Event.data payloads.
 *
 * We expect TransactionPayment::TransactionFeePaid events with data similar to:
 * [who, actual_fee, tip] or an object { who, actual_fee, tip } depending on the indexer.
 * Amounts are assumed to be in REEF base units (18 decimals) and returned as a string BigInt.
 */

export interface FeeParseResult {
  fee: string; // total fee in base units as a decimal string
}

function toBigIntSafe(value: unknown): bigint | null {
  try {
    if (value == null) return null;
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') {
      // Avoid unsafe integers
      if (!Number.isFinite(value)) return null;
      return BigInt(Math.trunc(value));
    }
    if (typeof value === 'string') {
      const v = value.trim();
      if (!v) return null;
      // hex or decimal
      if (/^0x[0-9a-fA-F]+$/.test(v)) return BigInt(v);
      if (/^[0-9]+$/.test(v)) return BigInt(v);
      return null;
    }
    if (typeof value === 'object') {
      // try common wrappers
      const anyObj = value as Record<string, unknown>;
      if (anyObj.value != null) return toBigIntSafe(anyObj.value);
      if (anyObj.actual_fee != null) return toBigIntSafe(anyObj.actual_fee);
      if (anyObj.actualFee != null) return toBigIntSafe(anyObj.actualFee);
      if (anyObj.tip != null) return toBigIntSafe(anyObj.tip);
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extracts total fee from a single TransactionFeePaid event `data` payload.
 * Handles array and object shapes. Returns decimal string. Falls back to '0'.
 */
export function extractFeeFromEventData(data: unknown): string {
  // Array form: [who, actual_fee, tip]
  if (Array.isArray(data)) {
    const actual = toBigIntSafe(data[1]) ?? 0n;
    const tip = toBigIntSafe(data[2]) ?? 0n;
    return (actual + tip).toString();
  }

  // Object form: { who, actual_fee/actualFee, tip }
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const actual = toBigIntSafe(obj.actual_fee ?? obj.actualFee) ?? 0n;
    const tip = toBigIntSafe(obj.tip) ?? 0n;
    const fee = actual + tip;
    if (fee > 0n) return fee.toString();
  }

  // Unknown form
  const n = toBigIntSafe(data);
  return (n ?? 0n).toString();
}

/**
 * Sums fees across a list of TransactionFeePaid events for the same extrinsic.
 */
export function sumFeesFromEvents(events: Array<{ data: unknown }> | undefined | null): string {
  if (!events || events.length === 0) return '0';
  let total = 0n;
  for (const ev of events) {
    const fee = extractFeeFromEventData(ev?.data);
    try {
      total += BigInt(fee);
    } catch {
      // ignore invalid entries
    }
  }
  return total.toString();
}

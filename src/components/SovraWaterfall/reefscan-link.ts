import { REEFSCAN_ORIGIN } from '@/constants/reefscan';
import type { SovraTx } from './types';

/**
 * Reefscan's transfer route is /transfer/{block}/{extrinsicIndex}/{eventIndex},
 * where eventIndex is the event's position within the WHOLE block. Since the
 * parser fix + the backfill-event-index run, our `event_index` column stores
 * exactly that, so the link is built straight from the row. Rows without the
 * indices (staking rewards, unverifiable legacy rows) fall back to an
 * always-valid extrinsic/block route.
 */
export function reefscanTransferHref(tx: SovraTx): string {
  const exI = Number(tx.extrinsicIndex);
  const evI = Number(tx.eventIndex);
  if (
    tx.block > 0 &&
    tx.extrinsicIndex != null && Number.isFinite(exI) &&
    tx.eventIndex != null && Number.isFinite(evI)
  ) {
    return `${REEFSCAN_ORIGIN}/transfer/${tx.block}/${exI}/${evI}`;
  }
  if (tx.hash.startsWith('0x')) return `${REEFSCAN_ORIGIN}/extrinsic/${tx.hash}`;
  return `${REEFSCAN_ORIGIN}/block/${tx.block}`;
}

import { useEffect, useState } from 'react';
import { useApolloClient } from '@apollo/client';
import type { ApolloClient, NormalizedCacheObject } from '@apollo/client';
import type { UiTransfer } from '@/data/transfer-mapper';
import { AddressDisplay } from './AddressDisplay';
import { ExternalLink } from './ui/external-link';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { REEFSCAN_ORIGIN } from '@/constants/reefscan';
import { formatTimestampFull, formatTokenAmount, formatFee, shortenHash } from '@/utils/formatters';
import { fetchFeeUnifiedOnce, fetchFeeDeepLookupOnce, fetchExtrinsicIdentityOnce, fetchAnyTransferIndicesOnce } from '@/data/transfers';
import { Copy, Check, ChevronRight, ChevronDown, Info } from 'lucide-react';
import { useReefPriceHistory } from '@/hooks/use-reef-price-history';
import { useTokenUsdThenFromSwap } from '@/hooks/use-token-usd-then';
import { PnLDualMiniChart } from './PnLDualMiniChart';

interface TransactionDetailsModalProps {
  open: boolean;
  transfer: UiTransfer | null;
  onClose: () => void;
  pricesById?: Record<string, number | null>;
  reefUsd?: number | null;
}

// Numeric helpers for USD computation and formatting
function toNumericAmount(amount: string, decimals: number): number | null {
  if (!/^[0-9]+$/.test(String(amount || ''))) return null;
  try {
    const bi = BigInt(amount);
    const d = Math.max(0, decimals || 0);
    const div = 10n ** BigInt(d);
    const ip = div === 0n ? 0n : bi / (div || 1n);
    const fp = div === 0n ? '0' : (bi % div).toString().padStart(d, '0');
    const n = d === 0 ? Number(ip) : parseFloat(`${ip}.${fp}`);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}

function usdNumberFor(token: { id?: string; name?: string; decimals: number }, amount: string, pricesById?: Record<string, number | null>, reefUsd?: number | null): number | null {
  const n = toNumericAmount(amount, token.decimals);
  if (n == null || n <= 0) return null;
  let usdPerUnit: number | undefined;
  if ((token.name || '').toUpperCase() === 'REEF' && typeof reefUsd === 'number') usdPerUnit = reefUsd as number;
  else if (token.decimals > 0 && token.id && pricesById) usdPerUnit = pricesById[(token.id || '').toLowerCase()] ?? undefined;
  if (typeof usdPerUnit !== 'number' || !Number.isFinite(usdPerUnit)) return null;
  const usd = n * usdPerUnit;
  return Number.isFinite(usd) ? usd : null;
}

function formatUsd(n: number | null): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

function fmt4(n: number | null): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 4 });
}


function buildReefscanLink(t: UiTransfer): { href: string; title: string } {
  let href = `${REEFSCAN_ORIGIN}/`;
  let source = 'home';

  const candidate = (t.method === 'swap' && t.swapInfo?.preferredTransferId)
    ? t.swapInfo.preferredTransferId!
    : (t.id || '');

  const mAnchored = /^0*(\d+)-0*(\d+)-0*(\d+)(?:-|$)/.exec(candidate);

  let eventFromCandidate: string | undefined;
  {
    const parts = candidate.split('-');
    if (parts.length >= 3) {
      const evDigits = parts[2]?.match(/\d+/g)?.pop();
      if (evDigits) eventFromCandidate = String(Number(evDigits));
    }
  }

  if (t.extrinsicId) {
    const mEx = /^0*(\d+)-0*(\d+)$/.exec(t.extrinsicId);
    if (mEx) {
      const [, block, extrinsic] = mEx;
      const evCandidate = (t.eventIndex ?? eventFromCandidate);
      if (evCandidate !== undefined && Number.isFinite(Number(evCandidate))) {
        const event = String(Number(evCandidate));
        href = `${REEFSCAN_ORIGIN}/transfer/${block}/${extrinsic}/${event}`;
        source = 'extrinsicId';
        const title = `${href} (${source})`;
        return { href, title };
      }
    }
  }

  if (
    Number.isFinite(Number((t as any).blockHeight)) &&
    Number.isFinite(Number((t as any).extrinsicIndex)) &&
    Number.isFinite(Number((t as any).eventIndex))
  ) {
    const block = String(Number((t as any).blockHeight));
    const extrinsic = String(Number((t as any).extrinsicIndex));
    const event = String(Number((t as any).eventIndex));
    href = `${REEFSCAN_ORIGIN}/transfer/${block}/${extrinsic}/${event}`;
    source = 'indices';
  } else if (mAnchored) {
    const [, block, extrinsic, event] = mAnchored;
    href = `${REEFSCAN_ORIGIN}/transfer/${block}/${extrinsic}/${event}`;
    source = 'anchored-id';
  } else if (t.extrinsicHash) {
    href = `${REEFSCAN_ORIGIN}/extrinsic/${t.extrinsicHash}`;
    source = 'hash';
  }
  const title = `${href} (${source})`;
  return { href, title };
}

export function TransactionDetailsModal({ open, transfer, onClose, pricesById, reefUsd }: TransactionDetailsModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Keep hooks above any conditional returns to preserve hook order
  const [expandTech, setExpandTech] = useState(false);
  const [copied, setCopied] = useState<{ hash?: boolean; exid?: boolean; idx?: boolean; from?: boolean; to?: boolean }>({});
  const [feeRaw, setFeeRaw] = useState<string | null>(null);
  const [isDeepLookupLoading, setIsDeepLookupLoading] = useState(false);
  const [exHashLocal, setExHashLocal] = useState<string | null>(null);
  const [exIdLocal, setExIdLocal] = useState<string | null>(null);
  const [blockLocal, setBlockLocal] = useState<number | null>(null);
  const [extrinsicLocal, setExtrinsicLocal] = useState<number | null>(null);
  const [eventLocal, setEventLocal] = useState<number | null>(null);
  const apollo = useApolloClient() as ApolloClient<NormalizedCacheObject>;
  const { history: reefHistory } = useReefPriceHistory('max');
  const [viewMode, setViewMode] = useState<'basic' | 'advanced'>(() => {
    try { return (localStorage.getItem('tx_view_mode') === 'advanced') ? 'advanced' : 'basic'; } catch { return 'basic'; }
  });
  const [showInverse, setShowInverse] = useState<boolean>(() => {
    try { return localStorage.getItem('tx_show_inv') === '1'; } catch { return false; }
  });
  // Persist lightweight UI preferences
  useEffect(() => { try { localStorage.setItem('tx_view_mode', viewMode); } catch {} }, [viewMode]);
  useEffect(() => { try { localStorage.setItem('tx_show_inv', showInverse ? '1' : '0'); } catch {} }, [showInverse]);

  // Prepare inputs for historical USD hooks (safe even when transfer is null)
  const hookBlockHeight = Number((transfer as any)?.blockHeight);
  const hookExtrinsicIndex = Number((transfer as any)?.extrinsicIndex);
  const hookTimestamp = (transfer as any)?.timestamp ?? null;
  const normalToken = (transfer as any)?.token ?? null;
  const boughtToken = (transfer as any)?.swapInfo?.bought?.token ?? null;
  const soldToken = (transfer as any)?.swapInfo?.sold?.token ?? null;
  // Call hooks unconditionally to preserve order; they are no-ops when inputs are missing
  const { usdThenPerUnit: usdThenPerUnitNormal } = useTokenUsdThenFromSwap({
    tokenId: normalToken?.id,
    decimals: normalToken?.decimals,
    blockHeight: Number.isFinite(hookBlockHeight) ? hookBlockHeight : undefined,
    extrinsicIndex: Number.isFinite(hookExtrinsicIndex) ? hookExtrinsicIndex : undefined,
    timestamp: hookTimestamp,
  });
  // Midpoint (T+7d) per-unit USD via nearest swap at timestamp
  // mid horizon lookup removed
  const { usdThenPerUnit: usdThenPerUnitBought } = useTokenUsdThenFromSwap({
    tokenId: boughtToken?.id,
    decimals: boughtToken?.decimals,
    blockHeight: Number.isFinite(hookBlockHeight) ? hookBlockHeight : undefined,
    extrinsicIndex: Number.isFinite(hookExtrinsicIndex) ? hookExtrinsicIndex : undefined,
    timestamp: hookTimestamp,
  });
  const { usdThenPerUnit: usdThenPerUnitSold } = useTokenUsdThenFromSwap({
    tokenId: soldToken?.id,
    decimals: soldToken?.decimals,
    blockHeight: Number.isFinite(hookBlockHeight) ? hookBlockHeight : undefined,
    extrinsicIndex: Number.isFinite(hookExtrinsicIndex) ? hookExtrinsicIndex : undefined,
    timestamp: hookTimestamp,
  });

  function copyToClipboard(text: string, key: 'hash' | 'exid' | 'idx' | 'from' | 'to') {
    try {
      navigator.clipboard?.writeText(text).then(() => {
        setCopied(prev => ({ ...prev, [key]: true }));
        window.setTimeout(() => setCopied(prev => ({ ...prev, [key]: false })), 1200);
      }).catch(() => {});
    } catch {}
  }

  // Lazy-load fee when modal opens using a single unified request.
  useEffect(() => {
    if (!open) { setFeeRaw(null); return; }
    const hash = transfer?.extrinsicHash;
    const idFromField = transfer?.extrinsicId;
    const idFromIndices = (transfer as any)?.blockHeight != null && (transfer as any)?.extrinsicIndex != null
      ? `${Number((transfer as any).blockHeight)}-${Number((transfer as any).extrinsicIndex)}`
      : undefined;
    const extrinsicId = idFromField || idFromIndices;
    if (!hash && !extrinsicId) { setFeeRaw(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const height = Number((transfer as any)?.blockHeight);
        const index = Number((transfer as any)?.extrinsicIndex);
        const fee = await fetchFeeUnifiedOnce(apollo, {
          hash: hash || undefined,
          extrinsicId: extrinsicId || undefined,
          height: Number.isFinite(height) ? height : undefined,
          index: Number.isFinite(index) ? index : undefined,
        });
        if (!cancelled) setFeeRaw(fee || null);
      } catch {
        if (!cancelled) setFeeRaw(null);
      }
    })();
    return () => { cancelled = true; };
  }, [open, transfer?.extrinsicHash, (transfer as any)?.extrinsicId, (transfer as any)?.blockHeight, (transfer as any)?.extrinsicIndex, apollo]);

  // On-demand resolve extrinsic identity (hash/id) if missing (typical for swap items)
  useEffect(() => {
    if (!open || !transfer) { setExHashLocal(null); setExIdLocal(null); return; }
    const hasHash = Boolean(transfer.extrinsicHash);
    const hasId = Boolean(transfer.extrinsicId);
    const height = Number((transfer as any)?.blockHeight);
    const index = Number((transfer as any)?.extrinsicIndex);
    if (hasHash && hasId) { setExHashLocal(transfer.extrinsicHash || null); setExIdLocal(transfer.extrinsicId || null); return; }
    if (!hasHash || !hasId) {
      if (!hasHash && !hasId && !(Number.isFinite(height) && Number.isFinite(index))) return;
      let cancelled = false;
      (async () => {
        try {
          const res = await fetchExtrinsicIdentityOnce(apollo, {
            hash: transfer.extrinsicHash || undefined,
            extrinsicId: transfer.extrinsicId || undefined,
            height: Number.isFinite(height) ? height : undefined,
            index: Number.isFinite(index) ? index : undefined,
          });
          if (!cancelled && res) {
            if (!hasHash && res.hash) setExHashLocal(res.hash);
            if (!hasId && res.id) setExIdLocal(res.id);
          }
        } catch {}
      })();
      return () => { cancelled = true; };
    }
  }, [open, transfer?.extrinsicHash, transfer?.extrinsicId, (transfer as any)?.blockHeight, (transfer as any)?.extrinsicIndex, apollo]);

  // On-demand resolve indices (block/extrinsic/event) if any is missing
  useEffect(() => {
    if (!open || !transfer) { setBlockLocal(null); setExtrinsicLocal(null); setEventLocal(null); return; }
    const b = Number((transfer as any)?.blockHeight);
    const ex = Number((transfer as any)?.extrinsicIndex);
    const ev = Number((transfer as any)?.eventIndex);
    const hasAll = Number.isFinite(b) && Number.isFinite(ex) && Number.isFinite(ev);
    if (hasAll) { setBlockLocal(b); setExtrinsicLocal(ex); setEventLocal(ev); return; }
    const hasHashOrId = Boolean(transfer.extrinsicHash) || Boolean(transfer.extrinsicId) || (Number.isFinite(b) && Number.isFinite(ex));
    if (!hasHashOrId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchAnyTransferIndicesOnce(apollo, {
          hash: transfer.extrinsicHash || undefined,
          extrinsicId: transfer.extrinsicId || undefined,
          height: Number.isFinite(b) ? b : undefined,
          index: Number.isFinite(ex) ? ex : undefined,
        });
        if (!cancelled && res) {
          if (!Number.isFinite(b) && Number.isFinite(Number(res.blockHeight))) setBlockLocal(Number(res.blockHeight));
          if (!Number.isFinite(ex) && Number.isFinite(Number(res.extrinsicIndex))) setExtrinsicLocal(Number(res.extrinsicIndex));
          if (!Number.isFinite(ev) && Number.isFinite(Number(res.eventIndex))) setEventLocal(Number(res.eventIndex));
          if (!transfer.extrinsicHash && res.extrinsicHash) setExHashLocal(res.extrinsicHash);
          if (!transfer.extrinsicId && res.extrinsicId) setExIdLocal(res.extrinsicId);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [open, transfer?.extrinsicHash, transfer?.extrinsicId, (transfer as any)?.blockHeight, (transfer as any)?.extrinsicIndex, (transfer as any)?.eventIndex, apollo]);

  const handleDeepLookup = async () => {
    if (!transfer || isDeepLookupLoading) return;
    const hash = transfer?.extrinsicHash;
    const idFromField = transfer?.extrinsicId;
    const idFromIndices = (transfer as any)?.blockHeight != null && (transfer as any)?.extrinsicIndex != null
      ? `${Number((transfer as any).blockHeight)}-${Number((transfer as any).extrinsicIndex)}`
      : undefined;
    const extrinsicId = idFromField || idFromIndices;
    const height = Number((transfer as any)?.blockHeight);
    const index = Number((transfer as any)?.extrinsicIndex);
    setIsDeepLookupLoading(true);
    try {
      const fee = await fetchFeeDeepLookupOnce(apollo, {
        hash: hash || undefined,
        extrinsicId: extrinsicId || undefined,
        height: Number.isFinite(height) ? height : undefined,
        index: Number.isFinite(index) ? index : undefined,
      }, 120);
      setFeeRaw(fee || null);
    } catch {
      // ignore
    } finally {
      setIsDeepLookupLoading(false);
    }
  };

  if (!open || !transfer) return null;

  const isSwap = transfer.method === 'swap' && transfer.swapInfo;
  const ts = formatTimestampFull(transfer.timestamp, 'en-US');
  const feeFmt = feeRaw && feeRaw !== '0' ? formatFee(feeRaw, 'REEF') : '—';
  const exHashShow = transfer.extrinsicHash || exHashLocal || '';
  const exIdShow = transfer.extrinsicId || exIdLocal || '';
  const blockShow = Number.isFinite(Number((transfer as any)?.blockHeight)) ? Number((transfer as any).blockHeight) : (blockLocal ?? undefined);
  const extrinsicShow = Number.isFinite(Number((transfer as any)?.extrinsicIndex)) ? Number((transfer as any).extrinsicIndex) : (extrinsicLocal ?? undefined);
  const eventShow = Number.isFinite(Number((transfer as any)?.eventIndex)) ? Number((transfer as any).eventIndex) : (eventLocal ?? undefined);
  const patchedTransfer = (exHashShow || exIdShow || blockShow != null || extrinsicShow != null || eventShow != null)
    ? { ...transfer, extrinsicHash: exHashShow || transfer.extrinsicHash, extrinsicId: (exIdShow || undefined) as any, blockHeight: blockShow as any, extrinsicIndex: extrinsicShow as any, eventIndex: eventShow as any }
    : transfer;
  const reefscan = buildReefscanLink(patchedTransfer);

  // Compute block-time USD (via daily REEF history) and current USD for amounts
  const txMs = (() => { try { const n = Date.parse(String(transfer.timestamp)); return Number.isFinite(n) ? n : NaN; } catch { return NaN; } })();
  const dayKey = Number.isFinite(txMs) ? new Date(txMs).toISOString().slice(0, 10) : null;
  const reefUsdBlock = dayKey && reefHistory ? (typeof reefHistory[dayKey] === 'number' ? reefHistory[dayKey]! : null) : null;

  // Regular transfer (non-swap)
  const nowUsdTransfer = !isSwap ? usdNumberFor(transfer.token as any, transfer.amount, pricesById, reefUsd) : null;
  let blockUsdTransfer = (!isSwap && reefUsdBlock != null && (transfer.token?.name || '').toUpperCase() === 'REEF')
    ? (() => { const q = toNumericAmount(transfer.amount, transfer.token.decimals); return (q != null) ? (q * reefUsdBlock) : null; })()
    : null;
  if (!isSwap && blockUsdTransfer == null && usdThenPerUnitNormal != null) {
    const q = toNumericAmount(transfer.amount, transfer.token.decimals);
    blockUsdTransfer = (q != null) ? (q * usdThenPerUnitNormal) : null;
  }
  const deltaTransfer = (nowUsdTransfer != null && blockUsdTransfer != null && blockUsdTransfer > 0)
    ? ((nowUsdTransfer - blockUsdTransfer) / blockUsdTransfer * 100)
    : null;

  // Swap legs
  const boughtTok = isSwap ? transfer.swapInfo!.bought.token : null;
  const soldTok = isSwap ? transfer.swapInfo!.sold.token : null;
  const boughtQty = isSwap ? toNumericAmount(transfer.swapInfo!.bought.amount, boughtTok!.decimals) : null;
  const soldQty = isSwap ? toNumericAmount(transfer.swapInfo!.sold.amount, soldTok!.decimals) : null;
  const boughtIsReef = isSwap ? ((boughtTok!.name || '').toUpperCase() === 'REEF') : false;
  const soldIsReef = isSwap ? ((soldTok!.name || '').toUpperCase() === 'REEF') : false;
  const nowUsdBought = isSwap ? usdNumberFor(boughtTok as any, transfer.swapInfo!.bought.amount, pricesById, reefUsd) : null;
  const nowUsdSold = isSwap ? usdNumberFor(soldTok as any, transfer.swapInfo!.sold.amount, pricesById, reefUsd) : null;
  let blockUsdBought: number | null = null;
  let blockUsdSold: number | null = null;
  if (isSwap && reefUsdBlock != null && boughtQty != null && soldQty != null) {
    if (boughtIsReef && !soldIsReef) {
      // Bought REEF, sold TOKEN
      blockUsdBought = boughtQty * reefUsdBlock;
      const reefPerSold = boughtQty / soldQty; // REEF per 1 sold TOKEN
      const usdPerSold = reefUsdBlock * reefPerSold;
      blockUsdSold = soldQty * usdPerSold;
    } else if (!boughtIsReef && soldIsReef) {
      // Bought TOKEN, sold REEF
      blockUsdSold = soldQty * reefUsdBlock;
      const reefPerBought = soldQty / boughtQty; // REEF per 1 bought TOKEN
      const usdPerBought = reefUsdBlock * reefPerBought;
      blockUsdBought = boughtQty * usdPerBought;
    }
  }
  // Fallback via nearest swap for non-REEF legs when REEF history path not applicable
  if (isSwap) {
    if (blockUsdBought == null && boughtQty != null && usdThenPerUnitBought != null) {
      blockUsdBought = boughtQty * usdThenPerUnitBought;
    }
    if (blockUsdSold == null && soldQty != null && usdThenPerUnitSold != null) {
      blockUsdSold = soldQty * usdThenPerUnitSold;
    }
  }
  // Fixed USD units for chart
  const aThenVal = blockUsdBought ?? null;
  const aNowVal = nowUsdBought ?? null;
  const bThenVal = blockUsdSold ?? null;
  const bNowVal = nowUsdSold ?? null;
  const midUsdThenBought = (isSwap && boughtQty != null && usdThenPerUnitBought != null) ? (boughtQty * usdThenPerUnitBought) : null;
  const midUsdThenSold = (isSwap && soldQty != null && usdThenPerUnitSold != null) ? (soldQty * usdThenPerUnitSold) : null;
  const aMidThenVal = midUsdThenBought ?? null;
  const bMidThenVal = midUsdThenSold ?? null;

  const exeReefPerToken = (() => {
    if (!isSwap || boughtQty == null || soldQty == null) return null as number | null;
    if (boughtIsReef && !soldIsReef && soldQty > 0) return boughtQty / soldQty;
    if (!boughtIsReef && soldIsReef && boughtQty > 0) return soldQty / boughtQty;
    return null as number | null;
  })();
  const exeTokenName = (() => {
    if (!isSwap) return '';
    if (boughtIsReef && !soldIsReef) return soldTok!.name;
    if (!boughtIsReef && soldIsReef) return boughtTok!.name;
    return '';
  })();
  const nowReefPerToken = (() => {
    if (!isSwap || !reefUsd || !Number.isFinite(Number(reefUsd)) || Number(reefUsd) <= 0) return null as number | null;
    if (boughtIsReef && !soldIsReef) {
      const id = (soldTok?.id || '').toLowerCase();
      const usdPer = pricesById ? (pricesById[id] as number | undefined) : undefined;
      return (typeof usdPer === 'number' && Number.isFinite(usdPer) && usdPer > 0) ? (usdPer / (reefUsd as number)) : null;
    }
    if (!boughtIsReef && soldIsReef) {
      const id = (boughtTok?.id || '').toLowerCase();
      const usdPer = pricesById ? (pricesById[id] as number | undefined) : undefined;
      return (typeof usdPer === 'number' && Number.isFinite(usdPer) && usdPer > 0) ? (usdPer / (reefUsd as number)) : null;
    }
    return null as number | null;
  })();
  const spotReefPerToken = (() => {
    if (!isSwap || reefUsdBlock == null) return null as number | null;
    if (!boughtIsReef && usdThenPerUnitBought != null) return usdThenPerUnitBought / reefUsdBlock;
    if (!soldIsReef && usdThenPerUnitSold != null) return usdThenPerUnitSold / reefUsdBlock;
    return null as number | null;
  })();
  const impactPct = (exeReefPerToken != null && spotReefPerToken != null && spotReefPerToken > 0)
    ? ((exeReefPerToken - spotReefPerToken) / spotReefPerToken * 100)
    : null;
  const riskChips: Array<string> = [];
  if (impactPct != null && Math.abs(impactPct) > 10) riskChips.push('High price impact');
  if ((boughtTok && (!Number.isFinite(Number(boughtTok.decimals)) || !boughtTok.id)) || (soldTok && (!Number.isFinite(Number(soldTok.decimals)) || !soldTok.id))) riskChips.push('Unknown token metadata');
  if (aMidThenVal == null && bMidThenVal == null) riskChips.push('Illiquid route');
  const riskClass = (t: string) => {
    if (t === 'High price impact') return 'bg-red-100 text-red-800 border border-red-200';
    if (t === 'Unknown token metadata') return 'bg-gray-100 text-gray-800 border border-gray-200';
    if (t === 'Illiquid route') return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
    return 'bg-gray-100 text-gray-800 border border-gray-200';
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50 rounded-t-xl">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-gray-900">Transaction Details</h3>
              <Badge className={transfer.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                {transfer.success ? 'Success' : 'Failed'}
              </Badge>
              {isSwap ? (
                <Badge className="bg-indigo-100 text-indigo-800">SWAP</Badge>
              ) : (
                <Badge className="bg-blue-100 text-blue-800">TRANSFER</Badge>
              )}
            </div>
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </div>
          {/* Removed duplicate SWAP summary line to avoid redundancy */}
          {isSwap && riskChips.length > 0 ? (
            <div className="px-5 pt-1 flex flex-wrap gap-2 text-[11px]">
              {riskChips.map((t, i) => (
                <span key={i} className={`inline-flex items-center px-2 py-0.5 rounded-full ${riskClass(t)}`}>{t}</span>
              ))}
            </div>
          ) : null}
          {isSwap ? (
            <div className="px-5 pt-1 text-xs text-gray-600 flex items-center gap-2">
              <span className="text-gray-500">View:</span>
              <button className={`px-2 py-0.5 border rounded ${viewMode === 'basic' ? 'bg-gray-100' : 'bg-white'}`} onClick={() => setViewMode('basic')}>Basic</button>
              <button className={`px-2 py-0.5 border rounded ${viewMode === 'advanced' ? 'bg-gray-100' : 'bg-white'}`} onClick={() => setViewMode('advanced')}>Advanced</button>
            </div>
          ) : null}

          <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">General</h4>
              <table className="w-full text-[13px]">
                <tbody className="divide-y">
                  <tr>
                    <td className="py-1 text-gray-500">Timestamp</td>
                    <td className="py-1 text-gray-900">{ts}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-gray-500">Type</td>
                    <td className="py-1 text-gray-900">{transfer.type}</td>
                  </tr>
                  {transfer.method ? (
                    <tr>
                      <td className="py-1 text-gray-500">Method</td>
                      <td className="py-1 text-gray-900">{transfer.method}</td>
                    </tr>
                  ) : null}
                  <tr>
                    <td className="py-1 text-gray-500">Fee</td>
                    <td className="py-1 text-gray-900">
                      <div className="flex items-center gap-2">
                        <span>{feeFmt}</span>
                        {(feeRaw == null || feeRaw === '0') && (
                          <button
                            className="no-row-open inline-flex items-center gap-1 px-2 py-1 border rounded hover:bg-gray-50 text-sm text-gray-700 disabled:opacity-50"
                            onClick={handleDeepLookup}
                            disabled={isDeepLookupLoading}
                            title="Retry deep lookup"
                          >
                            {isDeepLookupLoading ? 'Looking…' : 'Retry deep lookup'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Participants</h4>
              <table className="w-full text-[13px]">
                <tbody className="divide-y">
                  <tr>
                    <td className="py-1.5 text-gray-500">From</td>
                    <td className="py-1.5 text-gray-900">
                      <div className="flex items-center justify-between gap-2">
                        <AddressDisplay address={transfer.from} />
                        <button
                          className="no-row-open p-1 rounded hover:bg-gray-100"
                          title="Copy from address"
                          onClick={() => copyToClipboard(transfer.from, 'from')}
                        >
                          {copied.from ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-gray-600" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-gray-500">To</td>
                    <td className="py-1.5 text-gray-900">
                      <div className="flex items-center justify-between gap-2">
                        <AddressDisplay address={transfer.to} />
                        <button
                          className="no-row-open p-1 rounded hover:bg-gray-100"
                          title="Copy to address"
                          onClick={() => copyToClipboard(transfer.to, 'to')}
                        >
                          {copied.to ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-gray-600" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Amounts</h4>
              <table className="w-full text-[13px]">
                <tbody className="divide-y">
                  {isSwap ? (
                    <>
                      <tr>
                        <td className="py-1.5 text-gray-500">PnL</td>
                        <td className="py-1.5 text-gray-900">
                          {/* Execution/Spot/Impact/Now only in Advanced */}
                          {viewMode === 'advanced' && (
                            <div className="no-row-open mb-2 text-[11px] text-gray-700 space-y-0.5">
                              {exeTokenName && exeReefPerToken != null ? (
                                <>
                                  <div className="flex items-center justify-end mb-1 gap-2">
                                    <label className="inline-flex items-center gap-1 text-[10px] text-gray-500" title="Show inverse rate (REEF per token and token per REEF)">
                                      <input type="checkbox" checked={showInverse} onChange={(e) => setShowInverse(e.target.checked)} />
                                      <span>Inverse rate</span>
                                    </label>
                                    <span className="inline-flex" title="Execution — actual trade rate; Now — current market rate (from USD prices); Spot — reference rate at trade time; Δ — execution vs spot difference">
                                      <Info className="h-3.5 w-3.5 text-gray-400" />
                                    </span>
                                  </div>
                                  <div className="font-mono" title={`Execution: 1 ${exeTokenName} = ${fmt4(exeReefPerToken)} REEF${nowReefPerToken != null ? ` • Now: 1 ${exeTokenName} = ${fmt4(nowReefPerToken)} REEF` : ''}${spotReefPerToken != null ? ` • Spot: ${fmt4(spotReefPerToken)} REEF per 1 ${exeTokenName}` : ''}`}>
                                    <span className="text-gray-500" title="Execution price from the actual trade volumes">{exeTokenName}/REEF:</span>
                                    <span className="ml-2">{fmt4(exeReefPerToken)}</span>
                                    {nowReefPerToken != null ? (
                                      <>
                                        <span className="mx-1">→</span>
                                        <span title="Current market rate derived from USD prices">{fmt4(nowReefPerToken)}</span>
                                      </>
                                    ) : null}
                                    {spotReefPerToken != null ? (
                                      <span className="ml-2 text-gray-500" title="Reference spot rate at the time of trade">(spot {fmt4(spotReefPerToken)})</span>
                                    ) : null}
                                    {impactPct != null ? (
                                      <>
                                        <span className="ml-2 text-gray-500" title="Difference between execution and spot">Δ</span>
                                        <span className={`ml-1 ${impactPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>{impactPct >= 0 ? '+' : ''}{impactPct.toFixed(2)}%</span>
                                      </>
                                    ) : null}
                                  </div>
                                  {showInverse && (
                                    <div className="font-mono text-gray-500" title={`Inverse rate • Execution: 1 REEF = ${fmt4(1 / exeReefPerToken)} ${exeTokenName}${nowReefPerToken != null ? ` • Now: 1 REEF = ${fmt4(1 / nowReefPerToken)} ${exeTokenName}` : ''}`}>
                                      <span title="Inverse rate">REEF/{exeTokenName}:</span>
                                      <span className="ml-2">{fmt4(1 / exeReefPerToken)}</span>
                                      {nowReefPerToken != null ? (
                                        <>
                                          <span className="mx-1">→</span>
                                          <span>{fmt4(1 / nowReefPerToken)}</span>
                                        </>
                                      ) : null}
                                    </div>
                                  )}
                                </>
                              ) : null}
                            </div>
                          )}
                          <PnLDualMiniChart
                            aLabel={transfer.swapInfo!.bought.token.name}
                            aQtyText={formatTokenAmount(transfer.swapInfo!.bought.amount, transfer.swapInfo!.bought.token.decimals, transfer.swapInfo!.bought.token.name)}
                            aThenUsd={aThenVal}
                            aNowUsd={aNowVal}
                            bLabel={transfer.swapInfo!.sold.token.name}
                            bQtyText={formatTokenAmount(transfer.swapInfo!.sold.amount, transfer.swapInfo!.sold.token.decimals, transfer.swapInfo!.sold.token.name)}
                            bThenUsd={bThenVal}
                            bNowUsd={bNowVal}
                            aMidThen={aMidThenVal}
                            bMidThen={bMidThenVal}
                            
                          />
                        </td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td className="py-1.5 text-gray-500">Amount</td>
                      <td className="py-1.5 text-gray-900">
                        {formatTokenAmount(transfer.amount, transfer.token.decimals, transfer.token.name)}
                        {(() => {
                          const currStr = formatUsd(nowUsdTransfer);
                          const blockStr = formatUsd(blockUsdTransfer);
                          const dStr = (deltaTransfer != null) ? `${deltaTransfer >= 0 ? '+' : ''}${deltaTransfer.toFixed(2)}%` : null;
                          return (currStr || blockStr) ? (
                            <span className="ml-2 text-gray-600">
                              {blockStr ? `≈ ${blockStr} then` : ''}{blockStr && currStr ? ' • ' : ''}{currStr ? `${blockStr ? '' : '≈ '}${currStr} now` : ''}{dStr ? ` • Δ ${dStr}` : ''}
                            </span>
                          ) : null;
                        })()}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Network</h4>
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  <tr>
                    <td className="py-2 text-gray-500">Block • Extrinsic • Event</td>
                    <td className="py-2 text-gray-900">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[13px]">
                          {(blockShow ?? '—')} • {(extrinsicShow ?? '—')} • {(eventShow ?? '—')}
                        </span>
                        <button
                          className="no-row-open p-1 rounded hover:bg-gray-100"
                          title="Copy block/extrinsic/event"
                          onClick={() => {
                            const b = (blockShow ?? '');
                            const ex = (extrinsicShow ?? '');
                            const ev = (eventShow ?? '');
                            const text = `${b}-${ex}-${ev}`;
                            copyToClipboard(text, 'idx');
                          }}
                        >
                          {copied.idx ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-gray-600" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                  <>
                    <tr>
                      <td className="py-2 text-gray-500">Technical details</td>
                      <td className="py-2 text-gray-900">
                        <button
                          className="no-row-open inline-flex items-center gap-1 px-2 py-1 border rounded hover:bg-gray-50 text-sm text-gray-700"
                          onClick={() => setExpandTech(v => !v)}
                          title={expandTech ? 'Hide technical details' : 'Show technical details'}
                        >
                          {expandTech ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <span>{expandTech ? 'Hide' : 'Show'}</span>
                        </button>
                      </td>
                    </tr>
                    {expandTech && (
                      <>
                        <tr>
                          <td className="py-2 text-gray-500">Extrinsic hash</td>
                          <td className="py-2 text-gray-900">
                            {exHashShow ? (
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate font-mono text-[13px]">
                                  {shortenHash(exHashShow, 8, 8)}
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    className="no-row-open p-1 rounded hover:bg-gray-100"
                                    title="Copy full hash"
                                    onClick={() => copyToClipboard(exHashShow!, 'hash')}
                                  >
                                    {copied.hash ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-gray-600" />}
                                  </button>
                                </div>
                              </div>
                            ) : '—'}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 text-gray-500">Extrinsic id</td>
                          <td className="py-2 text-gray-900">
                            {exIdShow ? (
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate font-mono text-[13px]">
                                  {shortenHash(exIdShow, 6, 6)}
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    className="no-row-open p-1 rounded hover:bg-gray-100"
                                    title="Copy extrinsic id"
                                    onClick={() => copyToClipboard(exIdShow!, 'exid')}
                                  >
                                    {copied.exid ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-gray-600" />}
                                  </button>
                                </div>
                              </div>
                            ) : '—'}
                          </td>
                        </tr>
                      </>
                    )}
                  </>
                </tbody>
              </table>
            </div>
          </div>

          <div className="px-5 pb-5 pt-3 border-t flex items-center justify-end bg-gray-50 rounded-b-xl">
            <div className="flex items-center gap-3">
              <ExternalLink href={reefscan.href} title={reefscan.title} />
              <Button onClick={onClose} variant="secondary">Close</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

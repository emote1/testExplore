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
import { fetchFeeUnifiedOnce } from '@/data/transfers';
import { Copy, Check, ChevronRight, ChevronDown } from 'lucide-react';

interface TransactionDetailsModalProps {
  open: boolean;
  transfer: UiTransfer | null;
  onClose: () => void;
  pricesById?: Record<string, number | null>;
  reefUsd?: number | null;
}

function usdFor(token: { id?: string; name?: string; decimals: number }, amount: string, pricesById?: Record<string, number | null>, reefUsd?: number | null): string | null {
  if (!/^[0-9]+$/.test(String(amount || ''))) return null;
  try {
    const bi = BigInt(amount);
    const d = Math.max(0, token.decimals || 0);
    const div = 10n ** BigInt(d);
    const ip = div === 0n ? 0n : bi / (div || 1n);
    const fp = div === 0n ? '0' : (bi % div).toString().padStart(d, '0');
    const n = d === 0 ? Number(ip) : parseFloat(`${ip}.${fp}`);
    if (!(Number.isFinite(n) && n > 0)) return null;
    let usdPerUnit: number | undefined;
    if ((token.name || '').toUpperCase() === 'REEF' && typeof reefUsd === 'number') usdPerUnit = reefUsd as number;
    else if (token.decimals > 0 && token.id && pricesById) usdPerUnit = pricesById[(token.id || '').toLowerCase()] ?? undefined;
    if (typeof usdPerUnit !== 'number' || !Number.isFinite(usdPerUnit)) return null;
    const usd = n * usdPerUnit;
    return usd.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  } catch {
    return null;
  }
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
  const apollo = useApolloClient() as ApolloClient<NormalizedCacheObject>;

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

  if (!open || !transfer) return null;

  const isSwap = transfer.method === 'swap' && transfer.swapInfo;
  const ts = formatTimestampFull(transfer.timestamp, 'en-US');
  const feeFmt = feeRaw && feeRaw !== '0' ? formatFee(feeRaw, 'REEF') : '—';
  const reefscan = buildReefscanLink(transfer);

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

          <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">General</h4>
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  <tr>
                    <td className="py-2 text-gray-500">Timestamp</td>
                    <td className="py-2 text-gray-900">{ts}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-500">Type</td>
                    <td className="py-2 text-gray-900">{transfer.type}</td>
                  </tr>
                  {transfer.method ? (
                    <tr>
                      <td className="py-2 text-gray-500">Method</td>
                      <td className="py-2 text-gray-900">{transfer.method}</td>
                    </tr>
                  ) : null}
                  <tr>
                    <td className="py-2 text-gray-500">Fee</td>
                    <td className="py-2 text-gray-900">{feeFmt}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Participants</h4>
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  <tr>
                    <td className="py-2 text-gray-500">From</td>
                    <td className="py-2 text-gray-900">
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
                    <td className="py-2 text-gray-500">To</td>
                    <td className="py-2 text-gray-900">
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
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  {isSwap ? (
                    <>
                      <tr>
                        <td className="py-2 text-gray-500">Bought</td>
                        <td className="py-2 text-gray-900">
                          {formatTokenAmount(transfer.swapInfo!.bought.amount, transfer.swapInfo!.bought.token.decimals, transfer.swapInfo!.bought.token.name)}
                          {(() => {
                            const v = usdFor(transfer.swapInfo!.bought.token, transfer.swapInfo!.bought.amount, pricesById, reefUsd);
                            return v ? <span className="ml-2 text-gray-600">(≈ {v})</span> : null;
                          })()}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 text-gray-500">Sold</td>
                        <td className="py-2 text-gray-900">
                          {formatTokenAmount(transfer.swapInfo!.sold.amount, transfer.swapInfo!.sold.token.decimals, transfer.swapInfo!.sold.token.name)}
                          {(() => {
                            const v = usdFor(transfer.swapInfo!.sold.token, transfer.swapInfo!.sold.amount, pricesById, reefUsd);
                            return v ? <span className="ml-2 text-gray-600">(≈ {v})</span> : null;
                          })()}
                        </td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td className="py-2 text-gray-500">Amount</td>
                      <td className="py-2 text-gray-900">
                        {formatTokenAmount(transfer.amount, transfer.token.decimals, transfer.token.name)}
                        {(() => {
                          const v = usdFor(transfer.token, transfer.amount, pricesById, reefUsd);
                          return v ? <span className="ml-2 text-gray-600">(≈ {v})</span> : null;
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
                          {(transfer as any).blockHeight ?? '—'} • {(transfer as any).extrinsicIndex ?? '—'} • {(transfer as any).eventIndex ?? '—'}
                        </span>
                        <button
                          className="no-row-open p-1 rounded hover:bg-gray-100"
                          title="Copy block/extrinsic/event"
                          onClick={() => {
                            const b = (transfer as any).blockHeight ?? '';
                            const ex = (transfer as any).extrinsicIndex ?? '';
                            const ev = (transfer as any).eventIndex ?? '';
                            const text = `${b}-${ex}-${ev}`;
                            copyToClipboard(text, 'idx');
                          }}
                        >
                          {copied.idx ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-gray-600" />}
                        </button>
                      </div>
                    </td>
                  </tr>
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
                          {transfer.extrinsicHash ? (
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate font-mono text-[13px]">
                                {shortenHash(transfer.extrinsicHash, 8, 8)}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  className="no-row-open p-1 rounded hover:bg-gray-100"
                                  title="Copy full hash"
                                  onClick={() => copyToClipboard(transfer.extrinsicHash!, 'hash')}
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
                          {transfer.extrinsicId ? (
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate font-mono text-[13px]">
                                {shortenHash(transfer.extrinsicId, 6, 6)}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  className="no-row-open p-1 rounded hover:bg-gray-100"
                                  title="Copy extrinsic id"
                                  onClick={() => copyToClipboard(transfer.extrinsicId!, 'exid')}
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
                </tbody>
              </table>
            </div>
          </div>

          <div className="px-5 pb-5 pt-3 border-t flex items-center justify-end bg-gray-50 rounded-b-xl">
            <div className="flex items-center gap-3">
              <ExternalLink href={buildReefscanLink(transfer).href} title={reefscan.title} />
              <Button onClick={onClose} variant="secondary">Close</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

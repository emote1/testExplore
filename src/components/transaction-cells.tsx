import React from 'react';
import type { CellContext, HeaderContext } from '@tanstack/react-table';
import type { UiTransfer } from '../data/transfer-mapper';
import { formatTokenAmount, formatTimestampFull, parseTimestampToDate, formatTimeOfDay } from '../utils/formatters';
import { ExternalLink } from './ui/external-link';
import { Clock, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, CheckCircle2, Clock as ClockIcon } from 'lucide-react';
import { AddressDisplay } from './AddressDisplay';
import { Tooltip, TooltipTrigger, TooltipProvider, TooltipContent } from './ui/tooltip';
import { REEFSCAN_ORIGIN } from '@/constants/reefscan';

export const TypeCell = React.memo(function TypeCell(ctx: CellContext<UiTransfer, unknown>) {
  const { row } = ctx;
  const type = row.getValue('type') as string;
  const t = row.original;
  
  if (t.method === 'swap' || type === 'SWAP') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border border-blue-400 text-blue-600 bg-white">
        <ArrowLeftRight className="w-3 h-3" />
        Swap
      </span>
    );
  }
  
  const isIncoming = type === 'INCOMING';
  const isErcToken = !t.isNft && (t.token?.name !== 'REEF') && ((t.token?.decimals ?? 18) > 0);
  const label = isErcToken ? (isIncoming ? 'Buy' : 'Sell') : (isIncoming ? 'Incoming' : 'Outgoing');
  
  if (isIncoming) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border border-green-400 text-green-600 bg-white">
        <ArrowDownLeft className="w-3 h-3" />
        {label}
      </span>
    );
  }
  
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border border-orange-400 text-orange-600 bg-white">
      <ArrowUpRight className="w-3 h-3" />
      {label}
    </span>
  );
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const TimestampHeader = React.memo(function TimestampHeader(_ctx: HeaderContext<UiTransfer, unknown>) {
  return <span>Time</span>;
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const AmountHeader = React.memo(function AmountHeader(_ctx: HeaderContext<UiTransfer, unknown>) {
  return <span>Amount</span>;
});

export const TimestampCell = React.memo(function TimestampCell(ctx: CellContext<UiTransfer, unknown>) {
  const t = ctx.row.original as UiTransfer;
  const ts = ctx.row.getValue('timestamp') as string;
  const d = parseTimestampToDate(ts);
  const invalid = !d || isNaN(d.getTime()) || d.getFullYear() < 2015;
  // Fallback for reef-swap rows without real timestamp: show block height
  if ((t.method === 'swap' || t.type === 'SWAP') && invalid) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const block = (t as any)?.blockHeight;
    const label = typeof block === 'number' ? `Block #${block}` : '—';
    return <span className="whitespace-nowrap">{label}</span>;
  }
  const full = formatTimestampFull(ts, 'en-US');
  const timePart = formatTimeOfDay(ts, 'en-US', false);
  const now = Date.now();
  const diffDays = d ? Math.floor(Math.max(0, now - d.getTime()) / (24 * 60 * 60 * 1000)) : 0;
  let topBase = '';
  let bottomBase = '';
  if (!d) {
    topBase = timePart;
    bottomBase = '';
  } else if (diffDays < 7) {
    // < 7 days: show weekday + time on top, and month + day below
    topBase = `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${timePart}`;
    bottomBase = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  } else {
    // >= 7 days: show compact '<N>d ago' on top and month + day below
    const n = diffDays;
    topBase = `${n}d ago`;
    bottomBase = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  }
  const top = (topBase || '').toLowerCase();
  const bottom = (bottomBase || '').toLowerCase();
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help inline-flex items-start gap-2">
            <Clock className="h-3.5 w-3.5 text-gray-400 mt-[2px]" />
            <div className="leading-tight">
              <div className="font-semibold text-gray-800">{top}</div>
              <div className="text-[11px] text-gray-500">{bottom}</div>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <span>{full}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

export const FromCell = React.memo(function FromCell(ctx: CellContext<UiTransfer, unknown>) {
  return (
    <AddressDisplay
      address={ctx.row.getValue('from') as string}
      className="inline-block text-sm font-mono text-slate-700 bg-slate-100/50 px-2 py-1 rounded"
    />
  );
});

export const ToCell = React.memo(function ToCell(ctx: CellContext<UiTransfer, unknown>) {
  return (
    <AddressDisplay
      address={ctx.row.getValue('to') as string}
      className="inline-block text-sm font-mono text-slate-700 bg-slate-100/50 px-2 py-1 rounded"
    />
  );
});

export interface AmountCellProps { ctx: CellContext<UiTransfer, unknown> }

export const AmountCellComponent = React.memo(function AmountCellComponent({ ctx }: AmountCellProps) {
  const transfer = ctx.row.original;
  if (transfer.method === 'swap' && transfer.swapInfo) {
    const sold = transfer.swapInfo.sold;
    const bought = transfer.swapInfo.bought;
    const soldRaw = String(sold.amount || '0');
    const boughtRaw = String(bought.amount || '0');
    const soldAbs = soldRaw.startsWith('-') ? soldRaw.slice(1) : soldRaw;
    const boughtAbs = boughtRaw.startsWith('-') ? boughtRaw.slice(1) : boughtRaw;
    const boughtFmt = formatTokenAmount(boughtAbs, bought.token.decimals, bought.token.name);

    function toNumeric(amount: string, decimals: number): number | null {
      if (!/^\d+$/.test(amount || '')) return null;
      try {
        const bi = BigInt(amount);
        const d = Math.max(0, decimals || 0);
        const div = 10n ** BigInt(d);
        const ip = div === 0n ? 0n : bi / (div || 1n);
        const fp = div === 0n ? '0' : (bi % div).toString().padStart(d, '0');
        const n = d === 0 ? Number(ip) : parseFloat(`${ip}.${fp}`);
        return Number.isFinite(n) ? n : null;
      } catch {
        return null;
      }
    }
    function rateStr(): string {
      const soldNum = toNumeric(sold.amount, sold.token.decimals);
      const boughtNum = toNumeric(bought.amount, bought.token.decimals);
      if (soldNum == null || soldNum <= 0 || boughtNum == null) return '—';
      const r = boughtNum / soldNum;
      if (!Number.isFinite(r)) return '—';
      return r.toLocaleString('en-US', { maximumFractionDigits: 6 });
    }
    // For the 'for …' line: if value is extremely small (< 1e-6), increase precision and prefix with ≈
    function formatForLabel(rawAmount: string, token: { decimals: number; name: string }): string {
      const raw = String(rawAmount || '0');
      const abs = raw.startsWith('-') ? raw.slice(1) : raw;
      const n = toNumeric(abs, token.decimals);
      if (n != null && n > 0 && n < 1e-6) {
        const precise = formatTokenAmount(abs, token.decimals, token.name, { maximumFractionDigits: Math.min(18, token.decimals) });
        return `≈ ${precise}`;
      }
      return formatTokenAmount(abs, token.decimals, token.name);
    }

    // Single-line BUY/SELL presentation for swaps (ERC-focused):
    // - If bought leg is ERC (non-REEF, decimals>0) → show "+<bought> TOKEN" in green
    // - Else if sold leg is ERC → show "−<sold> TOKEN" in yellow
    // - Else fallback to showing +bought
    const isErc = (tok?: { name?: string; decimals: number }) => !!tok && tok.decimals > 0 && (tok.name || '').toUpperCase() !== 'REEF';
    const boughtIsErc = isErc(bought.token);
    const soldIsErc = isErc(sold.token);
    let primaryEl: JSX.Element | null = null;
    if (boughtIsErc || !soldIsErc) {
      // Prefer bought side when ERC (or when neither is ERC)
      const cls = 'text-green-600';
      primaryEl = <span className={cls}>+{boughtFmt}</span>;
    } else {
      const soldLabel = formatForLabel(soldAbs, sold.token);
      const cls = 'text-yellow-700';
      primaryEl = <span className={cls}>−{soldLabel}</span>;
    }
    const content = (
      <div className="flex flex-col">
        {primaryEl ?? <span className="text-gray-500">—</span>}
      </div>
    );

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <div className="text-xs text-gray-700">Bought: {boughtFmt}</div>
              <div className="text-xs text-gray-700">Sold: {formatForLabel(soldAbs, sold.token)}</div>
              <div className="text-xs text-gray-700">Rate: 1 {sold.token.name} = {rateStr()} {bought.token.name}</div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  const formattedAmount = formatTokenAmount(
    transfer.amount,
    transfer.token.decimals,
    transfer.token.name
  );
  const isIncoming = transfer.type === 'INCOMING';
  const isErcToken = !transfer.isNft && (transfer.token?.name !== 'REEF') && ((transfer.token?.decimals ?? 18) > 0);
  const prefix = isErcToken ? (isIncoming ? '+' : '−') : '';
  const cls = isErcToken
    ? (isIncoming ? 'text-green-600' : 'text-yellow-700')
    : '';
  return <span className={cls}>{prefix}{formattedAmount}</span>;
});

export const AmountCell = React.memo(function AmountCell(ctx: CellContext<UiTransfer, unknown>) {
  return <AmountCellComponent ctx={ctx} />;
});

// Standalone USD value column
export const ValueCell = React.memo(function ValueCell(ctx: CellContext<UiTransfer, unknown>) {
  const t = ctx.row.original;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meta = (ctx.table.options as any)?.meta as { pricesById?: Record<string, number | null>; reefUsd?: number | null } | undefined;

  function toNumeric(amount: string, decimals: number): number | null {
    if (!/^\d+$/.test(amount || '')) return null;
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

  function usdFor(token: { id?: string; name?: string; decimals: number }, amount: string): string | null {
    const n = toNumeric(amount, token.decimals);
    if (n == null || n <= 0) return null;
    let usdPerUnit: number | undefined;
    if ((token.name || '').toUpperCase() === 'REEF' && typeof meta?.reefUsd === 'number') usdPerUnit = meta.reefUsd as number;
    else if (token.decimals > 0 && token.id && meta?.pricesById) usdPerUnit = meta.pricesById[(token.id || '').toLowerCase()] ?? undefined;
    if (typeof usdPerUnit !== 'number' || !Number.isFinite(usdPerUnit)) return null;
    const usd = n * usdPerUnit;
    return usd.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  }

  if (t.method === 'swap' && t.swapInfo) {
    const soldUsd = usdFor(t.swapInfo.sold.token, t.swapInfo.sold.amount);
    const boughtUsd = usdFor(t.swapInfo.bought.token, t.swapInfo.bought.amount);
    if (!soldUsd && !boughtUsd) return <span className="block w-full text-right truncate">—</span>;
    if (soldUsd && boughtUsd) {
      const label = `≈ ${soldUsd} → ${boughtUsd}`;
      return (
        <span className="block w-full text-right truncate text-gray-700" title={label}>{label}</span>
      );
    }
    // Fallbacks when price known only for one side: show single approx line
    const approx = soldUsd ?? boughtUsd;
    return <span className="block w-full text-right truncate text-gray-700" title={approx ?? undefined}>{approx ?? '—'}</span>;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usd = usdFor(t.token as any, t.amount);
  return <span className="block w-full text-right truncate" title={usd ?? undefined}>{usd ?? '—'}</span>;
});

export const ActionsCell = React.memo(function ActionsCell(ctx: CellContext<UiTransfer, unknown>) {
  const t = ctx.row.original;
  // Prefer direct transfer URL if we can parse block/extrinsic/event from id
  let href = '';
  let source = '';
  // Подготовим кандидата (id/ preferredTransferId) и анкорное совпадение
  const candidate = (t.method === 'swap' && t.swapInfo?.preferredTransferId)
    ? t.swapInfo.preferredTransferId!
    : (t.id || '');
  // Анкорный паттерн: строго три числовых сегмента через дефис (обрезаем лидирующие нули)
  const mAnchored = /^0*(\d+)-0*(\d+)-0*(\d+)(?:-|$)/.exec(candidate);
  // Извлечь event из 3-го сегмента candidate (если он есть), даже если сегмент содержит буквы (например, af032)
  let eventFromCandidate: string | undefined;
  {
    const parts = candidate.split('-');
    if (parts.length >= 3) {
      const evDigits = parts[2]?.match(/\d+/g)?.pop();
      if (evDigits) eventFromCandidate = String(Number(evDigits));
    }
  }

  // 1) extrinsicId (block-extrinsic) + eventIndex (или event из candidate)
  if (t.extrinsicId) {
    const mEx = /^0*(\d+)-0*(\d+)$/.exec(t.extrinsicId);
    if (mEx) {
      const [, block, extrinsic] = mEx;
      const evCandidate = (t.eventIndex ?? eventFromCandidate);
      if (evCandidate !== undefined && Number.isFinite(Number(evCandidate))) {
        const event = String(Number(evCandidate));
        href = `${REEFSCAN_ORIGIN}/transfer/${block}/${extrinsic}/${event}`;
        source = 'extrinsicId';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const title = (import.meta as any)?.env?.DEV ? `${href} (${source}) [exId=${t.extrinsicId}; ev=${String(evCandidate)}]` : href;
        return <ExternalLink href={href} title={title} />;
      }
    }
  }

  // 2) Числовые индексы из полей (blockHeight/extrinsicIndex/eventIndex)
  if (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Number.isFinite(Number((t as any).blockHeight)) &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Number.isFinite(Number((t as any).extrinsicIndex)) &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Number.isFinite(Number((t as any).eventIndex))
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const block = String(Number((t as any).blockHeight));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extrinsic = String(Number((t as any).extrinsicIndex));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const event = String(Number((t as any).eventIndex));
    href = `${REEFSCAN_ORIGIN}/transfer/${block}/${extrinsic}/${event}`;
    source = 'indices';
  } else if (mAnchored) {
    // 3) Если id/preferredTransferId содержит ТРИ ЧИСЛОВЫХ сегмента — используем их
    const [, block, extrinsic, event] = mAnchored;
    href = `${REEFSCAN_ORIGIN}/transfer/${block}/${extrinsic}/${event}`;
    source = 'anchored-id';
  } else if (t.extrinsicHash) {
    // 4) Фоллбэк — по хэшу экстраинзикса
    href = `${REEFSCAN_ORIGIN}/extrinsic/${t.extrinsicHash}`;
    source = 'hash';
  } else {
    href = `${REEFSCAN_ORIGIN}/`;
    source = 'home';
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const title = (import.meta as any)?.env?.DEV ? `${href} (${source}) [cand=${candidate}; exId=${t.extrinsicId}; ev=${String(t.eventIndex)}]` : href;
  return <ExternalLink href={href} title={title} />;
});

export const StatusCell = React.memo(function StatusCell(ctx: CellContext<UiTransfer, unknown>) {
  const success = ctx.row.getValue('success') as boolean;
  
  if (success) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-green-600">
        <CheckCircle2 className="w-4 h-4" />
        Confirmed
      </span>
    );
  }
  
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-orange-500">
      <ClockIcon className="w-4 h-4" />
        Pending
    </span>
  );
});

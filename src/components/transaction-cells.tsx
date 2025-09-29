import type { CellContext, HeaderContext } from '@tanstack/react-table';
import type { UiTransfer } from '../data/transfer-mapper';
import { formatTimestamp, formatTokenAmount, formatTimestampFull } from '../utils/formatters';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ExternalLink } from './ui/external-link';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { AddressDisplay } from './AddressDisplay';
import { Tooltip, TooltipTrigger, TooltipProvider, TooltipContent } from './ui/tooltip';
import { REEFSCAN_ORIGIN } from '@/constants/reefscan';
// Price data is provided via TanStack table meta to avoid hooks in cells

export function TypeCell(ctx: CellContext<UiTransfer, unknown>) {
  const { row } = ctx;
  const type = row.getValue('type') as string;
  const t = row.original;
  if (t.method === 'swap' || type === 'SWAP') {
    const classes = 'font-semibold bg-indigo-100 text-indigo-800 hover:bg-indigo-100/80';
    return <Badge className={classes}>SWAP</Badge>;
  }
  const isIncoming = type === 'INCOMING';
  const classes = `font-semibold ${isIncoming
    ? 'bg-green-100 text-green-800 hover:bg-green-100/80'
    : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100/80'
  }`;
  return <Badge className={classes}>{type.toUpperCase()}</Badge>;
}

export function TimestampHeader(ctx: HeaderContext<UiTransfer, unknown>) {
  const { column } = ctx;
  const meta = (ctx.table?.options as any)?.meta as { disableTimestampSorting?: boolean } | undefined;
  const disabled = !!meta?.disableTimestampSorting;
  const sorted = column.getIsSorted();
  const button = (
    <Button
      variant="ghost"
      onClick={() => { if (!disabled) column.toggleSorting(sorted === 'asc'); }}
      disabled={disabled}
    >
      TIMESTAMP
      {disabled ? (
        <ArrowUpDown className="ml-2 h-4 w-4 opacity-40" />
      ) : sorted === 'asc' ? (
        <ArrowUp className="ml-2 h-4 w-4" />
      ) : sorted === 'desc' ? (
        <ArrowDown className="ml-2 h-4 w-4" />
      ) : (
        <ArrowUpDown className="ml-2 h-4 w-4" />
      )}
    </Button>
  );
  if (!disabled) return button;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>
          <span>Sorting by time is disabled</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function AmountHeader(ctx: HeaderContext<UiTransfer, unknown>) {
  const { column } = ctx;
  const meta = (ctx.table?.options as any)?.meta as { disableAmountSorting?: boolean } | undefined;
  const disabled = !!meta?.disableAmountSorting;
  const sorted = column.getIsSorted();
  const button = (
    <Button
      variant="ghost"
      onClick={() => { if (!disabled) column.toggleSorting(sorted === 'asc'); }}
      disabled={disabled}
    >
      AMOUNT
      {disabled ? (
        <ArrowUpDown className="ml-2 h-4 w-4 opacity-40" />
      ) : sorted === 'asc' ? (
        <ArrowUp className="ml-2 h-4 w-4" />
      ) : sorted === 'desc' ? (
        <ArrowDown className="ml-2 h-4 w-4" />
      ) : (
        <ArrowUpDown className="ml-2 h-4 w-4" />
      )}
    </Button>
  );
  if (!disabled) return button;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>
          <span>Sorting by amount is disabled</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function TimestampCell(ctx: CellContext<UiTransfer, unknown>) {
  const ts = ctx.row.getValue('timestamp') as string;
  const display = formatTimestamp(ts);
  const full = formatTimestampFull(ts);
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">{display}</span>
        </TooltipTrigger>
        <TooltipContent>
          <span>{full}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function FromCell(ctx: CellContext<UiTransfer, unknown>) {
  return <AddressDisplay address={ctx.row.getValue('from') as string} />;
}

export function ToCell(ctx: CellContext<UiTransfer, unknown>) {
  return <AddressDisplay address={ctx.row.getValue('to') as string} />;
}

export interface AmountCellProps { ctx: CellContext<UiTransfer, unknown> }

export function AmountCellComponent({ ctx }: AmountCellProps) {
  const transfer = ctx.row.original;
  if (transfer.method === 'swap' && transfer.swapInfo) {
    const sold = transfer.swapInfo.sold;
    const bought = transfer.swapInfo.bought;
    const soldFmt = formatTokenAmount(sold.amount, sold.token.decimals, sold.token.name);
    const boughtFmt = formatTokenAmount(bought.amount, bought.token.decimals, bought.token.name);

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
    const feeFmt = formatTokenAmount(transfer.feeAmount || '0', 18, 'REEF');

    const content = (
      <div className="flex flex-col">
        <span className="text-red-600">Sold: -{soldFmt}</span>
        <span className="text-green-600">Bought: +{boughtFmt}</span>
      </div>
    );

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <div className="text-xs text-gray-700">Rate: 1 {sold.token.name} = {rateStr()} {bought.token.name}</div>
              <div className="text-xs text-gray-700">Fee: {feeFmt}</div>
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
  return <span>{formattedAmount}</span>;
}

export function AmountCell(ctx: CellContext<UiTransfer, unknown>) {
  return <AmountCellComponent ctx={ctx} />;
}

export function FeeCell(ctx: CellContext<UiTransfer, unknown>) {
  const transfer = ctx.row.original;
  const formattedFee = formatTokenAmount(
    transfer.feeAmount || '0',
    18, // REEF decimals
    'REEF'
  );
  return <span>{formattedFee}</span>;
}

// Standalone USD value column
export function ValueCell(ctx: CellContext<UiTransfer, unknown>) {
  const t = ctx.row.original;
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
    if (token.name === 'REEF' && token.decimals === 18 && typeof meta?.reefUsd === 'number') usdPerUnit = meta.reefUsd as number;
    else if (token.decimals > 0 && token.id && meta?.pricesById) usdPerUnit = meta.pricesById[(token.id || '').toLowerCase()] ?? undefined;
    if (typeof usdPerUnit !== 'number' || !Number.isFinite(usdPerUnit)) return null;
    const usd = n * usdPerUnit;
    return usd.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  }

  if (t.method === 'swap' && t.swapInfo) {
    const soldUsd = usdFor(t.swapInfo.sold.token, t.swapInfo.sold.amount);
    const boughtUsd = usdFor(t.swapInfo.bought.token, t.swapInfo.bought.amount);
    if (!soldUsd && !boughtUsd) return <span className="block text-right">—</span>;
    if (soldUsd && boughtUsd) {
      return (
        <div className="flex flex-col items-end">
          <span className="whitespace-nowrap text-gray-700">≈ {soldUsd} → {boughtUsd}</span>
          <span className="whitespace-nowrap font-medium text-gray-900">{boughtUsd}</span>
        </div>
      );
    }
    // Fallbacks when price known only for one side
    const approx = soldUsd ?? boughtUsd;
    const final = boughtUsd ?? approx;
    return (
      <div className="flex flex-col items-end">
        <span className="whitespace-nowrap text-gray-700">≈ {approx}</span>
        <span className="whitespace-nowrap font-medium text-gray-900">{final}</span>
      </div>
    );
  }

  const usd = usdFor(t.token as any, t.amount);
  return <span className="block text-right">{usd ?? '—'}</span>;
}

export function ActionsCell(ctx: CellContext<UiTransfer, unknown>) {
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
        const title = (import.meta as any)?.env?.DEV ? `${href} (${source}) [exId=${t.extrinsicId}; ev=${String(evCandidate)}]` : href;
        return <ExternalLink href={href} title={title} />;
      }
    }
  }

  // 2) Числовые индексы из полей (blockHeight/extrinsicIndex/eventIndex)
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
  const title = (import.meta as any)?.env?.DEV ? `${href} (${source}) [cand=${candidate}; exId=${t.extrinsicId}; ev=${String(t.eventIndex)}]` : href;
  return <ExternalLink href={href} title={title} />;
}

export function StatusCell(ctx: CellContext<UiTransfer, unknown>) {
  const success = ctx.row.getValue('success') as boolean;
  const statusText = success ? 'Success' : 'Failed';
  const classes = `inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
    success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
  }`;
  return <span className={classes}>{statusText}</span>;
}

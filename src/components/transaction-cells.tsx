import type { CellContext, HeaderContext } from '@tanstack/react-table';
import type { UiTransfer } from '../data/transfer-mapper';
import { formatTimestamp, formatTokenAmount, formatTimestampFull } from '../utils/formatters';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ExternalLink } from './ui/external-link';
import { ArrowUpDown } from 'lucide-react';
import { AddressDisplay } from './AddressDisplay';
import { Tooltip, TooltipTrigger, TooltipProvider, TooltipContent } from './ui/tooltip';
import { REEFSCAN_ORIGIN } from '@/constants/reefscan';

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
  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
    >
      TIMESTAMP
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
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

export function AmountCell(ctx: CellContext<UiTransfer, unknown>) {
  const transfer = ctx.row.original;
  if (transfer.method === 'swap' && transfer.swapInfo) {
    const sold = transfer.swapInfo.sold;
    const bought = transfer.swapInfo.bought;
    const soldFmt = formatTokenAmount(sold.amount, sold.token.decimals, sold.token.name);
    const boughtFmt = formatTokenAmount(bought.amount, bought.token.decimals, bought.token.name);
    return <span>{soldFmt} → {boughtFmt}</span>;
  }
  const formattedAmount = formatTokenAmount(
    transfer.amount,
    transfer.token.decimals,
    transfer.token.name
  );
  return <span>{formattedAmount}</span>;
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

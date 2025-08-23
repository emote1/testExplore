import type { CellContext, HeaderContext } from '@tanstack/react-table';
import type { UiTransfer } from '../data/transfer-mapper';
import { formatTimestamp, formatTokenAmount } from '../utils/formatters';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ExternalLink } from './ui/external-link';
import { ArrowUpDown } from 'lucide-react';
import { AddressDisplay } from './AddressDisplay';

export function TypeCell(ctx: CellContext<UiTransfer, unknown>) {
  const { row } = ctx;
  const type = row.getValue('type') as string;
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
  return <>{formatTimestamp(ctx.row.getValue('timestamp') as string)}</>;
}

export function FromCell(ctx: CellContext<UiTransfer, unknown>) {
  return <AddressDisplay address={ctx.row.getValue('from') as string} />;
}

export function ToCell(ctx: CellContext<UiTransfer, unknown>) {
  return <AddressDisplay address={ctx.row.getValue('to') as string} />;
}

export function AmountCell(ctx: CellContext<UiTransfer, unknown>) {
  const transfer = ctx.row.original;
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
  const href = `https://reefscan.com/extrinsic/${ctx.row.original.extrinsicHash}`;
  return <ExternalLink href={href} />;
}

export function StatusCell(ctx: CellContext<UiTransfer, unknown>) {
  const success = ctx.row.getValue('success') as boolean;
  const statusText = success ? 'Success' : 'Failed';
  const classes = `inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
    success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
  }`;
  return <span className={classes}>{statusText}</span>;
}

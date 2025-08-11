import { ColumnDef } from '@tanstack/react-table';
import { UiTransfer } from '../data/transfer-mapper';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { ArrowUpDown } from 'lucide-react';
import { formatTimestamp, shortenHash, formatTokenAmount } from '../utils/formatters';
import { Button } from './ui/button';
import { ExternalLink } from './ui/external-link';
import { Badge } from './ui/badge';

const AddressDisplay = ({ address }: { address: string }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-pointer">{shortenHash(address, 6, 6)}</span>
      </TooltipTrigger>
      <TooltipContent>
        <p>{address}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export const transactionColumns: ColumnDef<UiTransfer>[] = [
  {
    accessorKey: 'type',
    header: 'TYPE',
    cell: ({ row }) => {
      const type = row.getValue('type') as string;
      const isIncoming = type === 'INCOMING';

      return (
        <Badge
          className={`font-semibold ${isIncoming
              ? 'bg-green-100 text-green-800 hover:bg-green-100/80'
              : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100/80'
            }`}
        >
          {type.toUpperCase()}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'timestamp',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        TIMESTAMP
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => formatTimestamp(row.getValue('timestamp')),
  },
  {
    accessorKey: 'from',
    header: 'FROM',
    cell: ({ row }) => <AddressDisplay address={row.getValue('from')} />,
  },
  {
    accessorKey: 'to',
    header: 'TO',
    cell: ({ row }) => <AddressDisplay address={row.getValue('to')} />,
  },
  {
    accessorKey: 'amount',
    header: 'AMOUNT',
    cell: ({ row }) => {
      const transfer = row.original;
      const formattedAmount = formatTokenAmount(
        transfer.amount,
        transfer.token.decimals,
        transfer.token.name
      );
      return <span>{formattedAmount}</span>;
    },
  },
  {
    accessorKey: 'feeAmount',
    header: 'FEE',
    cell: ({ row }) => {
      const transfer = row.original;
      const formattedFee = formatTokenAmount(
        transfer.feeAmount || '0',
        18, // REEF decimals
        'REEF'
      );
      return <span>{formattedFee}</span>;
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => (
      <ExternalLink href={`https://reefscan.com/extrinsic/${row.original.extrinsicHash}`} />
    ),
  },
  {
    accessorKey: 'success',
    header: 'Status',
    cell: ({ row }) => {
      const success = row.getValue('success') as boolean;
      const statusText = success ? 'Success' : 'Failed';
      
      return (
        <span
          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            success
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {statusText}
        </span>
      );
    },
  },
];

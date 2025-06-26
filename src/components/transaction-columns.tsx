import { ColumnDef } from '@tanstack/react-table';
import { UiTransfer } from '../data/transfer-mapper';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { ArrowUpRight, ArrowDownLeft, ExternalLink } from 'lucide-react';
import { generateReefscanUrl } from '../utils/reefscan-helpers';
import {
  formatTokenAmount,
  formatTimestamp,
  shortenHash,
} from '../utils/formatters';

const AddressDisplay = ({ address }: { address: string }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <span>{shortenHash(address)}</span>
      </TooltipTrigger>
      <TooltipContent>
        <p>{address}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export const transactionColumns: ColumnDef<UiTransfer>[] = [
  {
    accessorKey: 'timestamp',
    header: 'Date',
    cell: ({ row }) => {
      const timestamp = row.getValue('timestamp') as string;
      return (
        <div className="text-sm text-gray-900">
          {formatTimestamp(timestamp)}
        </div>
      );
    },
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => {
      const { type } = row.original;
      const isIncoming = type === 'INCOMING';

      const textColor = isIncoming ? 'text-green-700' : 'text-red-700';
      const Icon = isIncoming ? ArrowDownLeft : ArrowUpRight;
      const iconColor = isIncoming ? 'text-green-500' : 'text-red-500';

      return (
        <div className="flex items-center space-x-2">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <span className={`text-sm font-medium ${textColor}`}>{type}</span>
        </div>
      );
    },
  },
  {
    accessorKey: 'hash',
    header: 'Hash',
    cell: ({ row }) => {
      const transaction = row.original;
      const hash = transaction.extrinsicHash || '';
      const reefscanUrl = generateReefscanUrl(transaction);
      
      return (
        <a
          href={reefscanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 hover:underline"
        >
          {shortenHash(hash)}
          <ExternalLink className="h-3 w-3" />
        </a>
      );
    },
  },
  {
    accessorKey: 'from',
    header: 'From',
    cell: ({ row }) => <AddressDisplay address={row.getValue('from') as string} />,
  },
  {
    accessorKey: 'to',
    header: 'To',
    cell: ({ row }) => <AddressDisplay address={row.getValue('to') as string} />,
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ row }) => {
      const { amount, token } = row.original;
      return (
        <div className="text-sm font-medium text-gray-900">
          {formatTokenAmount(amount, token.decimals, token.name)}
        </div>
      );
    },
  },
  {
    accessorKey: 'fee',
    header: 'Fee',
    cell: ({ row }) => {
      const { fee } = row.original;
      return (
        <div className="text-sm text-gray-600">
          {formatTokenAmount(fee.amount, fee.token.decimals, fee.token.name)}
        </div>
      );
    },
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

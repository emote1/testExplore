import { ColumnDef } from '@tanstack/react-table';
import { UiTransfer } from '../data/transfer-mapper';
import {
  TypeCell,
  TimestampHeader,
  TimestampCell,
  FromCell,
  ToCell,
  AmountCell,
  FeeCell,
  ActionsCell,
  StatusCell,
} from './transaction-cells';

export const transactionColumns: ColumnDef<UiTransfer>[] = [
  {
    accessorKey: 'type',
    header: 'TYPE',
    cell: TypeCell,
  },
  {
    accessorKey: 'timestamp',
    header: TimestampHeader,
    cell: TimestampCell,
  },
  {
    accessorKey: 'from',
    header: 'FROM',
    cell: FromCell,
  },
  {
    accessorKey: 'to',
    header: 'TO',
    cell: ToCell,
  },
  {
    accessorKey: 'amount',
    header: 'AMOUNT',
    cell: AmountCell,
  },
  {
    accessorKey: 'feeAmount',
    header: 'FEE',
    cell: FeeCell,
  },
  {
    id: 'actions',
    cell: ActionsCell,
  },
  {
    accessorKey: 'success',
    header: 'Status',
    cell: StatusCell,
  },
];

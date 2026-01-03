import { ColumnDef } from '@tanstack/react-table';
import { UiTransfer } from '../data/transfer-mapper';
import {
  TypeCell,
  TimestampHeader,
  TimestampCell,
  FromCell,
  ToCell,
  AmountHeader,
  AmountCellComponent,
  ValueCell,
  ActionsCell,
  StatusCell,
} from './transaction-cells';

export const transactionColumns: ColumnDef<UiTransfer>[] = [
  {
    accessorKey: 'type',
    header: 'Type',
    cell: TypeCell,
  },
  {
    accessorKey: 'timestamp',
    header: TimestampHeader,
    cell: TimestampCell,
    enableSorting: false,
  },
  {
    accessorKey: 'from',
    header: 'From',
    cell: FromCell,
  },
  {
    accessorKey: 'to',
    header: 'To',
    cell: ToCell,
  },
  {
    accessorKey: 'amount',
    header: AmountHeader,
    cell: (ctx) => <AmountCellComponent ctx={ctx} />,
    enableSorting: false,
  },
  {
    id: 'value',
    header: 'Value',
    cell: ValueCell,
    enableSorting: false,
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

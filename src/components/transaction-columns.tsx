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
    header: AmountHeader,
    cell: (ctx) => <AmountCellComponent ctx={ctx} />,
    sortingFn: (rowA, rowB, columnId) => {
      const a = (rowA.getValue(columnId) as string) ?? '0';
      const b = (rowB.getValue(columnId) as string) ?? '0';
      try {
        const ai = BigInt(a);
        const bi = BigInt(b);
        return ai === bi ? 0 : ai < bi ? -1 : 1;
      } catch {
        const na = Number(a);
        const nb = Number(b);
        if (!Number.isFinite(na) || !Number.isFinite(nb)) return String(a).localeCompare(String(b));
        return na === nb ? 0 : na < nb ? -1 : 1;
      }
    },
  },
  {
    id: 'value',
    header: 'VALUE',
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

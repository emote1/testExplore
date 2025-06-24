import { TableMeta } from '@tanstack/react-table';
import { UiTransfer } from '../data/transfer-mapper';

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    addTransaction: (newTransaction: UiTransfer) => void;
  }
}

import { UiTransfer } from '../data/transfer-mapper';

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    // Phantom property to mark usage of TData for ESLint, no runtime impact
    _?: TData | undefined;
    addTransaction: (newTransaction: UiTransfer) => void;
  }
}

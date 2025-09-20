import type { RowData } from '@tanstack/table-core';

declare module '@tanstack/table-core' {
  // Extend TanStack Table meta to carry token price data for cells
  interface TableMeta<TData extends RowData> {
    pricesById?: Record<string, number | null>;
    reefUsd?: number | null;
  }
}

import type { RowData } from '@tanstack/table-core';

declare module '@tanstack/table-core' {
  // Extend TanStack Table meta to carry token price data for cells
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    pricesById?: Record<string, number | null>;
    reefUsd?: number | null;
    /** When true, TIMESTAMP header sorting is disabled (e.g., when Min REEF filter is active) */
    disableTimestampSorting?: boolean;
    /** When true, AMOUNT header sorting is disabled (e.g., when Min REEF filter is inactive) */
    disableAmountSorting?: boolean;
  }
}

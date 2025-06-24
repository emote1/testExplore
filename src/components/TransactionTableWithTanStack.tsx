import {
  flexRender,
  Table,
} from '@tanstack/react-table';
import { transactionColumns } from './transaction-columns';
import type { UiTransfer } from '../data/transfer-mapper';

interface TransactionTableWithTanStackProps {
  newTransfers?: string[];
  table: Table<UiTransfer>;
  isLoading: boolean;
  isFetching?: boolean;
}

export function TransactionTableWithTanStack({ table, isLoading, isFetching, newTransfers = [] }: TransactionTableWithTanStackProps) {
  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={transactionColumns.length} className="text-center py-4">Loading...</td>
              </tr>
            ) : table.getRowModel().rows.length === 0 && !isFetching ? (
              <tr>
                <td colSpan={transactionColumns.length} className="text-center py-4">No transactions found for this address.</td>
              </tr>
            ) : (
              <>
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} className={newTransfers.includes(row.original.id) ? 'bg-blue-100' : ''}>
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
                {isFetching && (
                  <tr>
                    <td colSpan={transactionColumns.length} className="text-center py-4 text-gray-500">
                      Loading more...
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-4">
        <button 
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage() || isFetching}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Previous
        </button>
        <span>
          Page{' '}
          <strong>
            {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </strong>
        </span>
        <button 
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage() || isFetching}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
};

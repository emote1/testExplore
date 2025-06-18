import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransactionHistoryWithBlocks } from './TransactionHistoryWithBlocks';
import type { Transaction } from '../types/transaction-types';

// Mock the hook
const mockUseTransactionDataWithBlocks = vi.fn();

vi.mock('../hooks/use-transaction-data-with-blocks', () => ({
  useTransactionDataWithBlocks: () => mockUseTransactionDataWithBlocks(),
}));

// Mock framer-motion to avoid errors in test environment if not testing animations
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: ({ children, ...props }: { children: React.ReactNode; [key: string]: any }) => <div {...props}>{children}</div>,
      tr: ({ children, layout, ...props }: { children: React.ReactNode; layout?: any; [key: string]: any }) => <tr {...props}>{children}</tr>,
      td: ({ children, ...props }: { children: React.ReactNode; [key: string]: any }) => <td {...props}>{children}</td>,
    },
  };
});

// Define a base mock transaction object
const mockTransactionBase: Omit<Transaction, 'id' | 'timestamp' | 'type' | 'from' | 'to' | 'amount' | 'tokenSymbol' | 'feeAmount'> = {
  hash: '0x' + Math.random().toString(16).slice(2, 12),
  success: true,
  status: 'Success',
  extrinsicHash: '0x' + Math.random().toString(16).slice(2, 12),
  extrinsicId: Math.random().toString(),
  tokenDecimals: 18, // Default to 18 for REEF
  feeTokenSymbol: 'REEF',
};

describe('TransactionHistoryWithBlocks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock return value for the hook
    mockUseTransactionDataWithBlocks.mockReturnValue({
      transactions: [],
      currentPage: 1,
      hasNextPage: false,
      totalTransactions: 0,
      error: null,
      isFetchingTransactions: false,
      isNavigatingToLastPage: false,
      userInputAddress: 'test-address',
      nativeAddressForCurrentSearch: 'test-address-native',
      handleFirstPage: vi.fn(),
      handlePreviousPage: vi.fn(),
      handleNextPage: vi.fn(),
      handleLastPage: vi.fn(),
      handleAddressSubmit: vi.fn(),
      setUserInputAddress: vi.fn(),
      cacheStats: { size: 0, maxSize: 50, accessOrderLength: 0 },
      blockStats: { hasCurrentBlock: false, currentBlockStartPage: 1, transactionsInBlock: 0, pagesInBlock: 0 },
      // Add any other properties returned by the hook that the component might use
      pageInfoForCurrentPage: null, 
      sortConfig: { key: null, direction: 'desc' },
      handleSort: vi.fn(),
    });
  });

  it('should render correctly with no transactions', () => {
    mockUseTransactionDataWithBlocks.mockReturnValue({
      transactions: [],
      currentPage: 1,
      hasNextPage: false,
      totalTransactions: 0,
      error: null,
      isFetchingTransactions: false,
      isNavigatingToLastPage: false,
      userInputAddress: 'test-address',
      nativeAddressForCurrentSearch: 'test-address-native', // Ensure this is set to trigger the relevant UI path
      handleFirstPage: vi.fn(),
      handlePreviousPage: vi.fn(),
      handleNextPage: vi.fn(),
      handleLastPage: vi.fn(),
      handleAddressSubmit: vi.fn(),
      setUserInputAddress: vi.fn(),
      cacheStats: { size: 0, maxSize: 50, accessOrderLength: 0 },
      blockStats: { hasCurrentBlock: false, currentBlockStartPage: 0, transactionsInBlock: 0, pagesInBlock: 0 },
    });

    render(<TransactionHistoryWithBlocks initialAddress="test-address" />); 

    expect(screen.getByText(/Transaction History \(Block Pagination\)/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter wallet address.../i)).toBeInTheDocument();
    // Ensure the message for nativeAddressForCurrentSearch is shown
    expect(screen.getByText(/Showing transactions for:/i)).toBeInTheDocument();
    expect(screen.getByText(/test-address-native/i)).toBeInTheDocument();
    expect(screen.getByText(/No transactions found for this address./i)).toBeInTheDocument();

    // Check that table headers are NOT present when there are no transactions
    expect(screen.queryByRole('columnheader', { name: /Date/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Тип/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Hash/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /От кого/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Кому/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Amount/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Fee/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Status/i })).not.toBeInTheDocument(); 
  });

  // Test Case 1: Incoming REEF Transaction
  it('displays incoming REEF transaction correctly with type, amount, and fee', () => {
    const mockTransactions: Transaction[] = [
      {
        ...mockTransactionBase,
        id: 'tx1',
        timestamp: new Date().toISOString(),
        type: 'INCOMING',
        from: 'senderAddress1',
        to: 'test-address-native',
        amount: '1234560000000000000000', // 1,234.56 REEF
        tokenSymbol: 'REEF',
        tokenDecimals: 18,
        feeAmount: '12340000000000000', // 0.01234 REEF
      },
    ];

    mockUseTransactionDataWithBlocks.mockReturnValueOnce({
      ...mockUseTransactionDataWithBlocks(), // Get defaults
      transactions: mockTransactions,
      totalTransactions: 1,
    });

    render(<TransactionHistoryWithBlocks initialAddress="test-address" />); 

    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    // Rows[0] is the header row, rows[1] is the first data row
    expect(rows).toHaveLength(2); // Header + 1 data row

    const firstDataRow = rows[1];
    const cells = within(firstDataRow).getAllByRole('cell');

    // New column order: Date (0), Тип (1), Hash (2), От кого (3), Кому (4), Amount (5), Fee (6), Status (7)
    expect(within(cells[1]).getByText(/Входящая/i)).toBeInTheDocument(); // Type
    expect(within(cells[5]).getByText(/1,234.56 REEF/i)).toBeInTheDocument(); // Amount
    expect(within(cells[6]).getByText(/0.0123 REEF/i)).toBeInTheDocument(); // Fee
    expect(within(cells[7]).getByText(/Success/i)).toBeInTheDocument(); // Status
  });

  // Test Case 2: Outgoing MRD Transaction
  it('displays outgoing MRD transaction correctly with type, amount, and fee', () => {
    const mockTransactions: Transaction[] = [
      {
        ...mockTransactionBase,
        id: 'tx2',
        timestamp: new Date().toISOString(),
        type: 'OUTGOING',
        from: 'test-address-native', // The current address
        to: 'recipientAddress2',
        amount: '50512340000000000000', // 50.51234 MRD
        tokenSymbol: 'MRD',
        tokenDecimals: 18, // Assuming MRD also has 18 decimals for this test
        feeAmount: '5670000000000000', // 0.00567 REEF
      },
    ];

    mockUseTransactionDataWithBlocks.mockReturnValueOnce({
      ...mockUseTransactionDataWithBlocks(), // Get defaults
      transactions: mockTransactions,
      totalTransactions: 1,
    });

    render(<TransactionHistoryWithBlocks initialAddress="test-address" />); 

    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(2); // Header + 1 data row

    const firstDataRow = rows[1];
    const cells = within(firstDataRow).getAllByRole('cell');

    // New column order: Date (0), Тип (1), Hash (2), От кого (3), Кому (4), Amount (5), Fee (6), Status (7)
    expect(within(cells[1]).getByText(/Исходящая/i)).toBeInTheDocument(); // Type
    expect(within(cells[5]).getByText(/50.5123 MRD/i)).toBeInTheDocument(); // Amount
    expect(within(cells[6]).getByText(/0.0057 REEF/i)).toBeInTheDocument(); // Fee (rounded)
    expect(within(cells[7]).getByText(/Success/i)).toBeInTheDocument(); // Status
  });

  // Test Case 3: Transaction with missing token symbol (defaults to REEF)
  it('displays transaction with missing token symbol correctly (defaults to REEF)', () => {
    const mockTransactions: Transaction[] = [
      {
        ...mockTransactionBase,
        id: 'tx3',
        timestamp: new Date().toISOString(),
        type: 'INCOMING',
        from: 'senderAddress3',
        to: 'test-address-native',
        amount: '123000000000000000000', // 123 REEF
        tokenSymbol: '', // Missing symbol
        tokenDecimals: 18,
        feeAmount: '1000000000000000', // 0.001 REEF
      },
    ];

    mockUseTransactionDataWithBlocks.mockReturnValueOnce({
      ...mockUseTransactionDataWithBlocks(),
      transactions: mockTransactions,
      totalTransactions: 1,
      nativeAddressForCurrentSearch: 'test-address-native',
    });

    render(<TransactionHistoryWithBlocks initialAddress="test-address" />);
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    const firstDataRow = rows[1];
    const cells = within(firstDataRow).getAllByRole('cell');

    // Check amount and fee (indices 5 and 6)
    expect(within(cells[5]).getByText(/123.00 REEF/i)).toBeInTheDocument();
    expect(within(cells[6]).getByText(/0.001 REEF/i)).toBeInTheDocument();
    // Check type column (index 1)
    expect(within(cells[1]).getByText(/Входящая/i)).toBeInTheDocument();
  });

  // Test Case 4: Transaction with zero amount
  it('displays transaction with zero amount correctly', () => {
    const mockTransactions: Transaction[] = [
      {
        ...mockTransactionBase,
        id: 'tx4',
        timestamp: new Date().toISOString(),
        type: 'INCOMING', // Type doesn't matter as much as amount formatting here
        from: 'senderAddress4',
        to: 'test-address-native',
        amount: '0',
        tokenSymbol: 'XYZ',
        tokenDecimals: 0,
        feeAmount: '1000000000000000', // 0.001 REEF
      },
    ];

    mockUseTransactionDataWithBlocks.mockReturnValueOnce({
      ...mockUseTransactionDataWithBlocks(),
      transactions: mockTransactions,
      totalTransactions: 1,
      nativeAddressForCurrentSearch: 'test-address-native',
    });

    render(<TransactionHistoryWithBlocks initialAddress="test-address" />);
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    const firstDataRow = rows[1];
    const cells = within(firstDataRow).getAllByRole('cell');

    // New column order: Date (0), Тип (1), Hash (2), От кого (3), Кому (4), Amount (5), Fee (6), Status (7)
    expect(within(cells[5]).getByText(/0 XYZ/i)).toBeInTheDocument(); // Amount should be '0 XYZ'
  });

  // Test Case 5: Self-transaction
  it('displays self-transaction correctly', () => {
    const mockTransactions: Transaction[] = [
      {
        ...mockTransactionBase,
        id: 'tx4',
        timestamp: new Date().toISOString(),
        type: 'SELF',
        from: 'test-address-native',
        to: 'test-address-native',
        amount: '2500000000000000000000', // 2,500 REEF
        tokenSymbol: 'REEF',
        tokenDecimals: 18,
        feeAmount: '2000000000000000', // 0.002 REEF
      },
    ];

    mockUseTransactionDataWithBlocks.mockReturnValueOnce({
      ...mockUseTransactionDataWithBlocks(),
      transactions: mockTransactions,
      totalTransactions: 1,
      nativeAddressForCurrentSearch: 'test-address-native',
    });

    render(<TransactionHistoryWithBlocks initialAddress="test-address" />);
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    const firstDataRow = rows[1];
    const cells = within(firstDataRow).getAllByRole('cell');

    // New column order: Date (0), Тип (1), Hash (2), От кого (3), Кому (4), Amount (5), Fee (6), Status (7)
    expect(within(cells[5]).getByText(/2,500.00 REEF/i)).toBeInTheDocument();
    expect(within(cells[1]).getByText(/Исходящая/i)).toBeInTheDocument(); // Type should be Outgoing for self-transfer
  });

  // Test Case 6: MRD Transaction Amount Rendering (0 decimals from map/default)
  it('displays MRD transaction amount correctly using 0 decimals', () => {
    const mockMrdTransaction: Transaction[] = [
      {
        ...mockTransactionBase,
        id: 'tx_mrd_01',
        timestamp: new Date().toISOString(),
        type: 'OUTGOING',
        from: 'test-address-native',
        to: 'recipientAddress_mrd',
        amount: '50.5', // For 0-decimal tokens, amount is the final value
        tokenSymbol: 'MRD',
        tokenDecimals: 0,
        feeAmount: '5000000000000000', // 0.005 REEF
      }
    ];

    mockUseTransactionDataWithBlocks.mockReturnValueOnce({
      ...mockUseTransactionDataWithBlocks(),
      transactions: mockMrdTransaction,
      totalTransactions: 1,
      nativeAddressForCurrentSearch: 'test-address-native', // Important for displayType
    });

    render(<TransactionHistoryWithBlocks initialAddress="test-address" />); 

    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(2); // Header + 1 data row

    const firstDataRow = rows[1];
    const cells = within(firstDataRow).getAllByRole('cell');

    // New column order: Date (0), Тип (1), Hash (2), От кого (3), Кому (4), Amount (5), Fee (6), Status (7)
    expect(within(cells[1]).getByText(/Исходящая/i)).toBeInTheDocument(); // Type
    expect(within(cells[5]).getByText(/50.5 MRD/i)).toBeInTheDocument(); // Amount
    expect(within(cells[6]).getByText(/0.005 REEF/i)).toBeInTheDocument(); // Fee
  });

  it('renders table headers correctly when transactions are present', () => {
    const mockTransactions: Transaction[] = [
      {
        ...mockTransactionBase,
        id: 'txTableHeaderTest',
        timestamp: new Date().toISOString(),
        type: 'INCOMING',
        from: 'senderAddressHeader',
        to: 'test-address-native',
        amount: '100000000000000000000', // 100 REEF
        tokenSymbol: 'REEF',
        tokenDecimals: 18,
        feeAmount: '1000000000000000', // 0.001 REEF
      },
    ];

    mockUseTransactionDataWithBlocks.mockReturnValueOnce({
      ...mockUseTransactionDataWithBlocks(),
      transactions: mockTransactions,
      totalTransactions: 1,
      nativeAddressForCurrentSearch: 'test-address-native',
    });

    render(<TransactionHistoryWithBlocks initialAddress="test-address" />);
    expect(screen.getByRole('columnheader', { name: /Date/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Тип/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Hash/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /От кого/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Кому/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Amount/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Fee/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Status/i })).toBeInTheDocument();
  });

  describe('Pagination Controls Tooltip', () => {
    it('disables the "Last Page" button and shows a tooltip when not navigable', async () => {
      const user = userEvent.setup();
      mockUseTransactionDataWithBlocks.mockReturnValue({
        ...mockUseTransactionDataWithBlocks(),
        isLastPageNavigable: false,
        totalTransactions: 20000, // Large number to make it not navigable
        hasNextPage: true,
        nativeAddressForCurrentSearch: 'test-address-native',
      });

      render(<TransactionHistoryWithBlocks initialAddress="test-address" />);

      const lastPageButton = screen.getByRole('button', { name: /Последняя/i });
      expect(lastPageButton).toBeDisabled();

      // Hover to trigger tooltip
      await user.hover(lastPageButton);

      // Check for tooltip content by its role to avoid multiple matches
      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip).toHaveTextContent(
        /Переход на последнюю страницу отключен для кошельков с очень большим количеством транзакций/i
      );
    });

    it('enables the "Last Page" button when it is navigable', () => {
      mockUseTransactionDataWithBlocks.mockReturnValue({
        ...mockUseTransactionDataWithBlocks(),
        isLastPageNavigable: true,
        totalTransactions: 500, // Small number
        hasNextPage: true,
        nativeAddressForCurrentSearch: 'test-address-native',
      });

      render(<TransactionHistoryWithBlocks initialAddress="test-address" />);

      const lastPageButton = screen.getByRole('button', { name: /Последняя/i });
      expect(lastPageButton).not.toBeDisabled();
    });
  });
});

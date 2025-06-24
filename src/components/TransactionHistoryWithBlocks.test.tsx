/// <reference types="vitest/globals" />

import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { TransactionHistoryWithBlocks } from './TransactionHistoryWithBlocks';
import { useTanstackTransactionAdapter, TanstackTransactionAdapterReturn } from '../hooks/useTanstackTransactionAdapter';
import { useTransferSubscription } from '../hooks/useTransferSubscription';
import type { UiTransfer } from '../data/transfer-mapper';
import { transactionColumns } from './transaction-columns';
import { useReactTable, getCoreRowModel, Table, getPaginationRowModel, getSortedRowModel, getFilteredRowModel } from '@tanstack/react-table';

// Mock hooks to isolate the component.
vi.mock('../hooks/useTanstackTransactionAdapter');
vi.mock('../hooks/useTransferSubscription');
const mockedUseTanstackTransactionAdapter = useTanstackTransactionAdapter as Mock<[string], TanstackTransactionAdapterReturn>;
const mockedUseTransferSubscription = useTransferSubscription as Mock;

// This helper will correctly run the useReactTable hook in a component context
const getMockTable = (data: UiTransfer[]): Table<UiTransfer> => {
  let table: Table<UiTransfer> | null = null;
  const TestComponent = () => {
    table = useReactTable({
      data,
      columns: transactionColumns,
      getCoreRowModel: getCoreRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      // The error mentions columnOrder, so let's ensure state is initialized
      state: {},
    });
    return null;
  };
  render(<TestComponent />);
  return table!;
};


describe('TransactionHistoryWithBlocks', () => {
  const testAddress = 'test-address-native';

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseTransferSubscription.mockReturnValue({});
  });

  it('should render correctly with no transactions', () => {
    // Arrange: Mock the adapter to return an empty table
    mockedUseTanstackTransactionAdapter.mockReturnValue({
      table: getMockTable([]),
      isLoading: false,
      isFetching: false,
      error: undefined,
      addTransaction: vi.fn(),
    } as unknown as TanstackTransactionAdapterReturn);

    // Act
    render(<TransactionHistoryWithBlocks initialAddress={testAddress} />);

    // Assert
    expect(screen.getByText(/No transactions found for this address./i)).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Date/i })).toBeInTheDocument();
  });

  it('displays incoming REEF transaction correctly', async () => {
    // Arrange
    const incomingTransaction: UiTransfer = {
      id: 'tx1',
      hash: '0xhash1',
      timestamp: '2023-10-27T10:00:00.000Z',
      from: 'address_other',
      to: testAddress,
      amount: '1234000000000000000000',
      feeAmount: '100000000000000000',
      tokenSymbol: 'REEF',
      feeTokenSymbol: 'REEF',
      tokenDecimals: 18,
      success: true,
      type: 'INCOMING',
      status: 'Success',
    };

    mockedUseTanstackTransactionAdapter.mockReturnValue({
      table: getMockTable([incomingTransaction]),
      isLoading: false,
      isFetching: false,
      addTransaction: vi.fn(),
    } as unknown as TanstackTransactionAdapterReturn);

    // Act
    render(<TransactionHistoryWithBlocks initialAddress={testAddress} />);

    // Assert
    // Using findByRole to wait for async rendering
    const row = await screen.findByRole('row', { name: /incoming/i });
    expect(within(row).getByText(/incoming/i)).toBeInTheDocument();
    expect(within(row).getByText(/1.23K REEF/i)).toBeInTheDocument();
  });

  it('displays outgoing MRD transaction correctly', async () => {
    // Arrange
    const outgoingTransaction: UiTransfer = {
      id: 'tx2',
      hash: '0xhash2',
      timestamp: '2023-10-27T11:00:00.000Z',
      from: testAddress,
      to: 'recipient_address',
      amount: '50500000000000000000000',
      feeAmount: '100000000000000000',
      tokenSymbol: 'MRD',
      feeTokenSymbol: 'REEF',
      tokenDecimals: 18,
      success: true,
      type: 'OUTGOING',
      status: 'Success',
    };

    mockedUseTanstackTransactionAdapter.mockReturnValue({
      table: getMockTable([outgoingTransaction]),
      isLoading: false,
      isFetching: false,
      addTransaction: vi.fn(),
    } as unknown as TanstackTransactionAdapterReturn);

    // Act
    render(<TransactionHistoryWithBlocks initialAddress={testAddress} />);

    // Assert
    const row = await screen.findByRole('row', { name: /outgoing/i });
    expect(within(row).getByText(/outgoing/i)).toBeInTheDocument();
    expect(within(row).getByText(/50.50K MRD/i)).toBeInTheDocument();
  });

  it('should display token symbol for NFT transfers', async () => {
    // Arrange
    const nftTransaction: UiTransfer = {
      id: 'tx_nft_01',
      hash: '0xhash_nft',
      timestamp: '2023-10-27T12:00:00.000Z',
      from: 'nft_sender',
      to: testAddress,
      amount: '1',
      tokenSymbol: 'MyNFT',
      tokenDecimals: 0,
      success: true,
      type: 'INCOMING',
      status: 'Success',
      feeAmount: '100000000000000000',
      feeTokenSymbol: 'REEF',
    };

    mockedUseTanstackTransactionAdapter.mockReturnValue({
      table: getMockTable([nftTransaction]),
      isLoading: false,
      isFetching: false,
      addTransaction: vi.fn(),
    } as unknown as TanstackTransactionAdapterReturn);

    // Act
    render(<TransactionHistoryWithBlocks initialAddress={testAddress} />);

    // Assert
    const row = await screen.findByRole('row', { name: /incoming/i });
    // The amount column for an NFT should display the token symbol
    expect(within(row).getByText(/MyNFT/i)).toBeInTheDocument();
  });
});

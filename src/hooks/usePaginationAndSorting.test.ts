import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePaginationAndSorting } from './usePaginationAndSorting';
import { PAGINATION_CONFIG } from '../constants/pagination';

describe('usePaginationAndSorting', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => usePaginationAndSorting());

    expect(result.current.pagination).toEqual({
      pageIndex: 0,
      pageSize: PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE,
    });
    expect(result.current.sorting).toEqual([]);
  });

  it('should initialize with provided initial values', () => {
    const initialPagination = { pageIndex: 2, pageSize: 50 };
    const initialSorting = [{ id: 'test', desc: true }];
    const { result } = renderHook(() =>
      usePaginationAndSorting(initialPagination, initialSorting)
    );

    expect(result.current.pagination).toEqual(initialPagination);
    expect(result.current.sorting).toEqual(initialSorting);
  });

  it('should update pagination state', () => {
    const { result } = renderHook(() => usePaginationAndSorting());
    const newPagination = { pageIndex: 1, pageSize: 30 };

    act(() => {
      result.current.setPagination(newPagination);
    });

    expect(result.current.pagination).toEqual(newPagination);
  });

  it('should update sorting state', () => {
    const { result } = renderHook(() => usePaginationAndSorting());
    const newSorting = [{ id: 'amount', desc: false }];

    act(() => {
      result.current.setSorting(newSorting);
    });

    expect(result.current.sorting).toEqual(newSorting);
  });

  it('should reset to default values', () => {
    const { result } = renderHook(() => usePaginationAndSorting());

    act(() => {
      result.current.setPagination({ pageIndex: 5, pageSize: 100 });
      result.current.setSorting([{ id: 'fee', desc: true }]);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.pagination).toEqual({
      pageIndex: 0,
      pageSize: PAGINATION_CONFIG.UI_TRANSACTIONS_PER_PAGE,
    });
    expect(result.current.sorting).toEqual([]);
  });

  it('should reset to provided initial values', () => {
    const initialPagination = { pageIndex: 2, pageSize: 50 };
    const initialSorting = [{ id: 'test', desc: true }];
    const { result } = renderHook(() =>
      usePaginationAndSorting(initialPagination, initialSorting)
    );

    act(() => {
      result.current.setPagination({ pageIndex: 10, pageSize: 20 });
      result.current.setSorting([]);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.pagination).toEqual(initialPagination);
    expect(result.current.sorting).toEqual(initialSorting);
  });
});

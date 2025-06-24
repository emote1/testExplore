# Reef Web3 Transaction History

This project is a web application for viewing the transaction history of a Reef address, built with React, TypeScript, and Vite. It leverages TanStack Table for efficient data display and provides features like pagination, sorting, and real-time data fetching from a GraphQL endpoint.

## Key Features

- **Transaction History**: View a paginated list of transactions for any Reef address.
- **Real-time Data**: Fetches the latest transaction data.
- **Client-side Caching**: Implements a cache to reduce redundant network requests.
- **Dynamic UI**: Responsive and interactive table powered by TanStack Table.
- **Custom Hooks**: Modular and reusable hooks for data fetching and state management.

## Tech Stack

- **Framework**: [React](https://reactjs.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Data Fetching**: [Apollo Client](https://www.apollographql.com/docs/react/) for GraphQL
- **UI Components**: [Shadcn UI](https://ui.shadcn.com/), [Radix UI](https://www.radix-ui.com/), [Tailwind CSS](https://tailwindcss.com/)
- **Table**: [TanStack Table v8](https://tanstack.com/table/v8)
- **Testing**: [Vitest](https://vitest.dev/), [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

## Project Structure

```
src
├── api/          # GraphQL queries and Apollo Client setup
├── components/   # React components
├── constants/    # Application constants
├── hooks/        # Custom React hooks
├── types/        # TypeScript type definitions
├── utils/        # Utility functions
└── main.tsx      # Application entry point
```

## Available Scripts

In the project directory, you can run:

- `npm install`: Installs the dependencies.
- `npm run dev`: Runs the app in development mode.
- `npm run build`: Builds the app for production.
- `npm test`: Runs the test suite.

## Custom Hooks Documentation

### `usePaginationAndSorting`

A reusable, library-agnostic hook for managing pagination and sorting state.

**Types:**
```typescript
// Represents the state of pagination.
export interface AppPaginationState {
  pageIndex: number;
  pageSize: number;
}

// Represents the state of sorting.
export type AppSortingState = { id: string; desc: boolean }[];

// Describes the return shape of the hook.
export interface PaginationAndSorting {
  pagination: AppPaginationState;
  setPagination: React.Dispatch<React.SetStateAction<AppPaginationState>>;
  sorting: AppSortingState;
  setSorting: React.Dispatch<React.SetStateAction<AppSortingState>>;
  reset: () => void;
}
```

**Usage:**
This hook can be initialized with optional `initialPagination` and `initialSorting` values. It returns the current state and setters, along with a `reset` function to revert the state to its initial values.

```typescript
const { pagination, sorting, setPagination, setSorting, reset } = usePaginationAndSorting(
  { pageIndex: 0, pageSize: 20 }, // initialPagination
  [{ id: 'timestamp', desc: true }] // initialSorting
);
```

### `useTanstackTransactionAdapter`

An adapter hook that fetches transaction data using `useTransactionDataWithBlocks` and prepares it for the `TanStack Table` component. It integrates `usePaginationAndSorting` to manage table state.

**Returns:**
An object containing:
- `transactions`: The formatted data for the table.
- `isLoading`: A boolean indicating if data is being fetched.
- `pageCount`: The total number of pages.
- `pagination`, `setPagination`, `sorting`, `setSorting`, `reset`: State and handlers from `usePaginationAndSorting`.

**Usage in Components:**
The component `TransactionHistoryWithBlocks` uses this hook to get all the data and handlers needed to render the transaction table and its controls. The `reset` function is called whenever a new address is submitted to ensure the table state is cleared.

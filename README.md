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

## GraphQL Codegen for Type Safety

This project uses [GraphQL Code Generator](https://www.the-guild.dev/graphql/codegen) to automatically generate TypeScript types and Apollo Client hooks directly from the Subsquid GraphQL schema. This ensures end-to-end type safety between the frontend and the GraphQL API.

### Key Benefits
- **Automatic Type Generation**: No more manual creation of TypeScript interfaces for API responses.
- **Type Safety**: Prevents errors by ensuring that you cannot access a field that doesn't exist in the schema.
- **Developer Experience**: Provides autocompletion and type checking in your IDE.

### How it Works
- The configuration is located in `codegen.ts`.
- The generated types and hooks are located in `src/types/graphql-generated.ts`. This file is **not** committed to version control and is listed in `.gitignore`.

### Usage
To manually regenerate types, run:
```bash
npm run codegen
```
This command is also automatically executed as part of the `npm run build` script, ensuring that the types are always up-to-date before creating a production build.

## Project Structure

```
src
├── components/   # React components for the UI
├── data/         # GraphQL queries, fragments, and data mapping logic
├── hooks/        # Custom React hooks for business logic and data fetching
├── types/        # Contains auto-generated GraphQL types (`graphql-generated.ts`)
├── utils/        # Utility functions
└── main.tsx      # Application entry point
```

## Available Scripts

In the project directory, you can run:

- `npm install`: Installs the dependencies.
- `npm run dev`: Runs the app in development mode.
- `npm run build`: Builds the app for production.
- `npm test`: Runs the test suite.

## Performance Tuning: NFT Metadata Fetch Concurrency

- VITE_PREFETCH_MAX_WORKERS (default 16) — limits concurrent prefetch batches across contracts (tokenURI/uri discovery).
- VITE_FETCH_CONCURRENCY (default 12) — limits concurrent metadata JSON fetch workers.

Notes:
- Restart the dev server after changing env variables.
- Values must be positive integers; invalid values fall back to defaults.

Examples (PowerShell):
```powershell
npx cross-env VITE_PREFETCH_MAX_WORKERS=16 VITE_FETCH_CONCURRENCY=12 npm run dev
```
Or for current session only:
```powershell
$env:VITE_PREFETCH_MAX_WORKERS='8'; $env:VITE_FETCH_CONCURRENCY='8'; npm run dev
```

Recommendations:
- Fast RPC/REST: 16/12
- Cautious or limited providers: 8/8

## Data Sources Defaults

- NFT metadata: auto (RPC → marketplace → Graph ERC1155 URI)
- Price source: Graph (Reefswap Subsquid)
- Notes: RPC используется только для `tokenURI/uri` (ERC721/1155). Цены считаются по пулам DEX через Subsquid Graph, чтобы не нагружать RPC. Эндпоинты и поведение можно настраивать через переменные окружения — см. `.env.example`.

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

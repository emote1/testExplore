# Reef Web3 History - Architecture Overview

This document provides a high-level overview of the project's structure, architecture, and data flow. It is intended to be a guide for developers working on this codebase.

## 📂 Project Structure

The project follows a standard feature-based structure for React applications. Here are the key directories and their responsibilities:

```
reef-web3-history-vite/
├── 📌 src/
│   ├── 📄 main.tsx           # Application entry point, Apollo Client setup
│   ├── 📄 App.tsx              # Main application component, layout
│   │
│   ├── 📂 components/         # React components
│   │   ├── TransactionHistoryWithBlocks.tsx  # Main view, orchestrates data fetching and display
│   │   ├── TransactionTableWithTanStack.tsx  # Reusable TanStack Table component
│   │   ├── transaction-columns.tsx         # Column definitions for the table
│   │   └── ui/                           # Shadcn UI components
│   │
│   ├── 📂 data/               # GraphQL queries, mappers, and cache logic
│   │   ├── transfers.ts                  # All GraphQL queries/fragments for transfers
│   │   ├── transfer-mapper.ts            # Maps raw GraphQL data to the `UiTransfer` model
│   │   └── cache-manager.ts              # Apollo Client cache management logic
│   │
│   ├── 📂 hooks/              # Custom React hooks for business logic
│   │   ├── use-transaction-data-with-blocks.ts # Fetches paginated transaction data
│   │   ├── usePaginationAndSorting.ts        # Manages pagination & sorting state
│   │   ├── useTanstackTransactionAdapter.ts  # Adapts data for TanStack Table
│   │   └── useTransferSubscription.ts        # Handles real-time updates via subscriptions
│   │
│   ├── 📂 types/              # TypeScript type definitions
│   │   ├── graphql-generated.ts          # Auto-generated types from GraphQL schema (DO NOT EDIT)
│   │   └── tanstack-table.d.ts           # TanStack Table type extensions
│   │
│   └── 📂 utils/              # General helper functions
│       ├── address-helpers.ts            # Address validation and formatting
│       ├── error-handler.ts              # Centralized error handling
│       ├── formatters.ts                 # Display formatting for dates, amounts, etc.
│       └── ui.ts                         # UI utility functions (e.g., `cn`)
│
└── 📄 CODE_REVIEW.md         # This file!
```

---

## 🌊 Data Flow

The application's data flow is designed to be unidirectional and reactive, centered around Apollo Client and custom hooks.

1.  **Initiation**: The process starts in `TransactionHistoryWithBlocks.tsx`, which is the primary component responsible for displaying transaction history.

2.  **Data Fetching**: It calls the `use-transaction-data-with-blocks.ts` hook. This hook uses Apollo Client's `useQuery` to execute the `PAGINATED_TRANSFERS_QUERY` against the Subsquid GraphQL API. It also integrates the `usePaginationAndSorting` hook to manage the table's state (current page, page size, sorting order).

3.  **Real-time Updates**: In parallel, the `useTransferSubscription.ts` hook establishes a GraphQL subscription. When a new transaction occurs, the subscription pushes the new data to the client, which is then used to update the Apollo Client cache via `cache-manager.ts`.

4.  **Data Transformation**: The raw data from both the initial query and the subscription is processed by the `mapTransfersToUiTransfers` function in `transfer-mapper.ts`. This crucial step transforms the complex, nested GraphQL data into a flattened, UI-friendly `UiTransfer` object. This is also where the transaction **fee** is extracted by parsing the `TransactionFeePaid` event from the extrinsic's event list.

5.  **Table Adaptation**: The resulting array of `UiTransfer` objects is passed to the `useTanstackTransactionAdapter.ts` hook. This hook prepares the final `table` object required by TanStack Table, bundling the data, columns, and state management logic together.

6.  **Rendering**: The `table` object is passed to the `TransactionTableWithTanStack.tsx` component, which handles the rendering of the table rows and cells.

7.  **Column Definition**: The appearance and behavior of each column are defined in `transaction-columns.tsx`. This file specifies how to render data for each cell, leveraging helper functions from `formatters.ts` to display addresses, amounts, and dates in a readable format.

This document provides an overview of the key files and directories in the `reef-web3-history-vite` project.

├── 📌 main.tsx (Application entry point, renders the root App component)
├── 📌 App.tsx (Main application component, handles routing and layout)
├── 📂 components
│   ├── TransactionHistoryWithBlocks.tsx (Main component, orchestrates data fetching and display)
│   ├── TransactionTableWithTanStack.tsx (Reusable table component powered by TanStack Table)
│   ├── transaction-columns.tsx (Column definitions for the transaction table)
│   └── ui/ (Directory for Shadcn UI components)
├── 📂 hooks (Custom React hooks for business logic and data fetching)
│   ├── use-transaction-data-with-blocks.ts (Fetches paginated transactions and associated data)
│   ├── usePaginationAndSorting.ts (Manages state for pagination and sorting for TanStack Table)
│   ├── useTanstackTransactionAdapter.ts (Adapts data from hooks for use with the TanStack Table component)
│   └── useTransferSubscription.ts (Handles real-time updates via GraphQL subscriptions)
├── 📂 data
│   ├── transfers.ts (Contains all GraphQL queries and fragments for transfers)
│   ├── transfer-mapper.ts (Maps data from the GraphQL API to the UI model `UiTransfer`)
│   └── cache-manager.ts (Logic for managing the Apollo Client cache)
├── 📂 types
│   ├── graphql-generated.ts (Auto-generated types and hooks from GraphQL Codegen - **DO NOT EDIT MANUALLY**)
│   └── tanstack-table.d.ts (Type declarations to extend TanStack Table functionality)
├── 📂 utils (General helper functions)
│   ├── address-helpers.ts (Utilities for handling addresses)
│   ├── error-handler.ts (Centralized error handling logic)
│   ├── formatters.ts (Functions for formatting dates, amounts, and hashes for display)
│   ├── reefscan-helpers.ts (Utilities specific to the Reefscan API data structure)
│   └── ui.ts (UI utility functions, e.g., `cn` for merging classnames)
└── 📂 mocks (Testing setup)
    ├── handlers.ts (Mock handlers for MSW)
    ├── mock-data.ts (Mock data for testing)
    └── server.ts (Mock server setup for tests)

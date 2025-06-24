# Project Structure Overview

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
│   ├── block-pagination.ts (Logic for paginating through blocks)
│   ├── error-handler.ts (Centralized error handling logic)
│   ├── formatters.ts (Functions for formatting dates, amounts, and hashes for display)
│   ├── pagination-helpers.ts (Helper functions for pagination logic)
│   ├── reefscan-helpers.ts (Utilities specific to the Reefscan API data structure)
│   └── ui.ts (UI utility functions, e.g., `cn` for merging classnames)
└── 📂 mocks (Testing setup)
    ├── handlers.ts (Mock handlers for MSW)
    ├── mock-data.ts (Mock data for testing)
    └── server.ts (Mock server setup for tests)

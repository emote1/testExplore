├── 📌 main.tsx (entry point of the application, React DOM)

├── 📌 App.tsx (main application component, routing, layout)

├── 📂 components
│   ├── TransactionHistoryWithBlocks.tsx (main component for displaying transaction history)
│   ├── TransactionTable.tsx (core TanStack Table rendering component)
│   ├── transaction-columns.tsx (TanStack Table column definitions)
│   └── ui/ (directory for Shadcn UI components)

├── 📂 hooks (custom hooks for business logic and data integration)
│   ├── usePaginationAndSorting.ts (reusable hook for TanStack Table pagination and sorting state)
│   ├── use-transaction-data-with-blocks.ts (fetching and processing transaction + block data)
│   ├── useTanstackTransactionAdapter.ts (adapter connecting data hooks to TanStack Table, uses `usePaginationAndSorting`)
│   └── useTransferSubscription.ts (subscriptions for real-time updates)

├── 📂 data
│   ├── apollo-client.ts (Apollo Client configuration, cache, endpoint)
│   ├── transfers.ts (GraphQL queries and fragments)
│   ├── transfer-mapper.ts (mapping API data to table model)
│   └── cache-manager.ts (cache management logic)

├── 📂 mocks
│   ├── handlers.ts (mock handlers for MSW)
│   ├── mock-data.ts (mock data for testing)
│   └── server.ts (mock server setup for tests)

├── 📂 types
│   ├── reefscan-api.ts (type definitions for the Reef Chain API)
│   └── transaction-types.ts (common transaction types)

└── 📂 utils (general helper functions)
    ├── address-helpers.ts (address utilities)
    ├── block-pagination.ts (pagination logic)
    ├── error-handler.ts (centralized error handling)
    ├── formatters.ts (formatting dates, amounts, hashes)
    ├── pagination-helpers.ts (pagination utilities)
    ├── reefscan-helpers.ts (helpers for working with Reef Chain API data)
    └── ui.ts (UI utility functions like `cn` for classnames)

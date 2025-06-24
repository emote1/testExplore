# TanStack Table Integration Guide for React Explorer

This document defines the conventions and best practices for using **TanStack Table** with **Apollo GraphQL** in the React Explorer project.

---

## 🛠 Purpose

We use **TanStack Table (React Table v8+)** as the main data grid engine to: ✅ Manage server-side pagination and sorting.\
✅ Ensure unified table behavior across components.\
✅ Cleanly separate data logic from UI rendering.

---

## ⚙ Project Structure

| Layer                                          | Responsibility                                           |
| ---------------------------------------------- | -------------------------------------------------------- |
| `/data/transfers.ts`                           | GraphQL queries and fragments for fetching transfer data |
| `/components/transaction-columns.tsx`          | Column configuration for TanStack Table                  |
| `/components/TransactionTableWithTanStack.tsx` | Table component using TanStack Table + Apollo            |
| `/hooks/`                                      | Business logic hooks (fetching, subscriptions)           |
| `/utils/`                                      | Helper functions (e.g. formatters, pagination helpers)   |

---

## 🚀 How to build a new table

When adding or modifying tables:

1️⃣ **Columns**

- Define all columns in `transaction-columns.tsx` or a dedicated column config file.
- Use TanStack’s column type for proper type inference.
- Always define `accessorKey` or `accessorFn` for data binding.

2️⃣ **Data**

- Fetch data via Apollo `useQuery` with variables for `limit`, `offset`, `orderBy`, `orderDirection`.
- Server-side pagination and sorting are *mandatory* (no client-side sorting of full dataset).

3️⃣ **Table**

- Use `useReactTable` with `manualPagination: true` and `manualSorting: true`.
- Always wire pagination and sorting changes to refetching data.
- Page size should come from a shared constant (e.g. `/constants/pagination.ts`).

4️⃣ **UI**

- Render tables using Tailwind CSS or Radix primitives (no hardcoded styles).
- Use buttons/links for pagination controls, not custom handlers unless required.

---

## ⚡ AI Assistant Rules

💡 When AI tools generate or assist code:

- They **must use TanStack Table as the data grid library**.
- All table data **must come from Apollo GraphQL queries**, no mock data in production code.
- Pagination and sorting **must be server-driven**, wired to GraphQL variables.
- Column definitions **must live in a config file**, not inline inside components.
- Table components **must be functional components with React hooks**.

---

## ✅ Example Data Flow

```
GraphQL API (Transfers)
      ↓
Apollo Client (with variables for sorting + pagination)
      ↓
Custom Hook (optional)
      ↓
TanStack Table (data + column model)
      ↓
Table UI (Tailwind styled table)
```

---

## 📝 Notes

- No direct mutation of table data inside components — always update via GraphQL.
- Tables should be easy to extend with filters, export, or virtual scroll in the future.
- All table-related tests must use MSW (Mock Service Worker).

---

## 📌 Further reading

- [TanStack Table Docs](https://tanstack.com/table/latest)
- [Apollo Client Docs](https://www.apollographql.com/docs/react/)


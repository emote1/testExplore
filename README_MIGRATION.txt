# MIGRATION INSTRUCTIONS

Этот проект создан на Vite + React + TypeScript.

## Что сделано:
- Создан чистый шаблон Vite (react-ts)
- Установлены все базовые зависимости
- Следующим шагом будет перенос компонентов и логики из старого проекта

## Как запускать

1. `npm install`
2. `npm run dev`

---

## TODO (автоматически переносить):
- src/components/TransactionItem.tsx
- src/components/TransactionHistory.tsx
- src/components/useFee.ts
- src/App.tsx
- src/index.tsx

## После переноса
- Проверить работу приложения
- Исправить ошибки типов и несовместимости
- Обновить импорты и стили

---

Если потребуется подключить web3, reef-chain, Chart.js и другие библиотеки — добавьте их через `npm install <package>`.

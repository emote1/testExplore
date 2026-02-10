# Changelog

## 2026-02-10

### ✨ UX: skeleton загрузка, error handling, сортировка
**Файлы:** `src/components/NetworkStatistics.tsx`, `src/hooks/use-total-staked.ts`

- **Skeleton shimmer** при загрузке Total Staked — amber-тонированные плашки с `animate-pulse`
- **Error state** — красное сообщение + текст ошибки + кнопка "Обновить"
- **squid-outage event** при ошибке — интеграция с `WsStatusToast` для toast уведомлений
- **Сортировка**: валидаторы с именами вверху, безымянные внизу
- **Кнопка validators** — визуальная подсказка (border + bg + hover)
- **Заголовок**: "Total Staked" + "5.88B REEF" оранжевым акцентом

---

### 🏷️ Имена и комиссии валидаторов + точный APY
**Файлы:** `src/hooks/validator-meta.ts` (новый), `src/hooks/use-total-staked.ts`, `src/components/NetworkStatistics.tsx`

**Что показывает:**
- Имя валидатора (on-chain identity) вместо обрезанного адреса
- Комиссия каждого валидатора (%)
- Индивидуальный APY с учётом комиссии: `APY = (reward / stake) × 365 × 100 × (1 - commission)`

**Архитектура (оптимизация запросов):**
- **1 HTTP POST** — batch JSON-RPC: 23 запроса `identity.identityOf` + 23 запроса `staking.validators` = 46 вызовов в одном запросе
- **Кеш 30 минут** — module-level, не повторяем при каждом рендере
- **Ленивая загрузка** — запрашиваем только после получения списка валидаторов из Subsquid
- **Без новых зависимостей** — используем `@polkadot/util-crypto` (уже в проекте) для `xxhashAsHex` и `decodeAddress`

**Как формируются storage keys:**
- `twox128("Identity") + twox128("IdentityOf") + twox64(pubkey) + pubkey` → identity
- `twox128("Staking") + twox128("Validators") + twox64(pubkey) + pubkey` → commission (Perbill LE)

**Декодирование SCALE:**
- Identity: `Registration { judgements: Vec<(u32,Judgement)>, deposit: u128, info: IdentityInfo { additional: BoundedVec, display: Data, ... } }` → парсим offset до `display` поля, `Data::Raw(N)` = tag `N+1` + N байт ASCII
- Judgement::FeePaid (variant 1) содержит u128 Balance — пропускаем 16 байт
- Commission: `Compact<Perbill>` — SCALE compact decoding (mode 0/1/2), затем ÷ 1_000_000_000 × 100 = %
- 20 из 23 валидаторов имеют on-chain identity, остальные показывают обрезанный адрес

---

## 2026-02-09

### 🔒 Total Staked REEF — новый виджет
**Заменил:** Transactions (24h)
**Файлы:** `src/hooks/use-total-staked.ts`, `src/components/NetworkStatistics.tsx`

**Что показывает:**
- Total staked REEF (сумма по всем валидаторам последней эры)
- % от total supply (progress bar)
- APY (~годовая доходность стейкинга) — кеш rewards 30 мин
- Раскрывающийся список валидаторов с именами, комиссиями и индивидуальным APY
- Количество валидаторов, USD эквивалент, номер эры

**Как реализовано:**
- Staked data: GraphQL `eraValidatorInfos` из Subsquid (последняя эра, суммируем `total`)
- Total supply: RPC `state_getStorage` → `system.totalIssuance` с `rpc.reefscan.info`
- APY: пагинация rewards из Subsquid (limit 200, maxPages 20) → `(dailyReward / totalStaked) × 365 × 100`
- USD: через существующий `useReefPrice` (CoinGecko)
- Кеш totalIssuance: 5 мин, кеш dailyReward: 30 мин (module-level)
- Обновление: каждые 5 минут

---

### 👛 Active Wallets вместо New Wallets
**Изменил:** "New Wallets (24h, ICP)" → "Active Wallets (24h, ICP)"
**Файлы:** `src/hooks/use-active-wallets-24h-icp.ts`, `src/components/NetworkStatistics.tsx`

**Что изменилось:**
- Раньше показывал `p.new` (новые адреса за 24ч) — теперь `p.active` (все уникальные адреса за 24ч)
- Обновлены заголовок, tooltip, title на столбиках

---

### 📊 Столбики с датами и пропусками (date-gap filling)
**Файлы:** `src/hooks/use-active-wallets-24h-icp.ts`, `src/components/NetworkStatistics.tsx`

**Что изменилось:**
- Столбики привязаны к реальным датам (раньше — просто массив чисел)
- Если за какой-то день нет данных — показывается маленький пунктирный блок "no data"
- При наведении — дата и значение

**Как реализовано:**
- `fillDateGaps()` — утилита: берёт массив `{value, ts}`, создаёт непрерывный ряд дат, заполняет пропуски `null`
- `sparkDated: SparkDatedPoint[]` — новое поле в хуках, используется для рендера

---

### 🗑️ Удалён Transactions (24h)
**Удалённые файлы:** `src/hooks/use-network-growth-aggregator.ts`
**Изменённые файлы:** `src/data/icp-client.ts`, `aggregator/src/cron-icp.ts`, `src/components/NetworkStatistics.tsx`

**Что убрано:**
- Хук `useNetworkGrowthAggregator`
- `getExtrinsicsSparklineDailyIcp()` из icp-client
- `EXTRINSICS_COUNT` query и `fetchExtrinsicsCount()` из cron-icp
- Cron передаёт `extrinsics: 0` в snapshot (канистра требует поле)
- `VITE_ICP_EXTRINSICS_DAILY_URL` больше не используется

**TODO:** Убрать `extrinsics` из Rust канистры (`lib.rs` + `.did`) и переделоить

---

### 🌐 ICP Canister Setup
**Файл:** `icp-onchain/ICP-SETUP.md`

- Документация по канистрам, identity, командам dfx
- Перенос identity `mainnet` на новый ПК
- II principal добавлен как контроллер
- GitHub Actions `cron-icp` настроен и работает

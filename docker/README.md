# Reef Explorer — Local GraphQL Stack

PostgreSQL + Hasura GraphQL Console + pgAdmin — всё в Docker.

## Локальная разработка

### Запуск

```bash
cd docker
docker-compose up -d
```

### Интерфейсы

| Сервис | URL | Логин |
|--------|-----|-------|
| **Hasura Console** | http://localhost:8080 | Admin Secret: `local_dev_secret` |
| **pgAdmin** | http://localhost:5050 | Email: `admin@example.com` / Password: `admin` |
| **PostgreSQL** | `localhost:5432` | User: `reef` / Password: `reef_local` / DB: `reef_explorer` |

### Hasura Console

1. Откройте http://localhost:8080/console
2. Введите Admin Secret: `local_dev_secret`
3. Вкладка **Data** — создание таблиц визуально
4. Вкладка **API** — GraphQL Playground для тестирования запросов

### pgAdmin

1. Откройте http://localhost:5050
2. Сервер "Reef Explorer Local" уже добавлен
3. При первом подключении введите пароль: `reef_local`

### Остановка

```bash
docker-compose down
```

### Полная очистка (удалить данные)

```bash
docker-compose down -v
```

---

## Production Deployment

### Требования к серверу

**Минимальная конфигурация:**
- **CPU:** 2 vCPU
- **RAM:** 4 GB
- **Disk:** 50 GB SSD
- **Network:** Стабильное соединение для RPC-запросов

**Рекомендуемая конфигурация:**
- **CPU:** 3 vCPU
- **RAM:** 8 GB
- **Disk:** 80 GB SSD
- **Network:** 100 Mbps+

**Прогноз использования диска:**
- Текущая БД (~185 transfers): 9 MB
- Полный backfill (10-15 млн transfers): 40-50 GB
- Запас для логов и системы: 30 GB
- **Итого: 80 GB достаточно с запасом**

**Рекомендуемые хостинг-провайдеры:**
1. **Hetzner Cloud CX31** — 3 vCPU, 8GB RAM, 80GB SSD — €8.21/мес (лучшее соотношение цена/качество)
2. **DigitalOcean Basic** — 2 vCPU, 4GB RAM, 80GB SSD — $24/мес (простая настройка)
3. **Contabo Cloud VPS M** — 4 vCPU, 8GB RAM, 200GB SSD — €6.99/мес (бюджетный вариант)

### 1. Подготовка окружения

```bash
cd docker
cp .env.example .env
```

Отредактируйте `.env` и установите **сильные пароли** для:
- `POSTGRES_PASSWORD`
- `HASURA_GRAPHQL_ADMIN_SECRET`
- `PG_PASS` (должен совпадать с `POSTGRES_PASSWORD`)

### 2. Настройка Hasura

Для production рекомендуется:
- `HASURA_GRAPHQL_ENABLE_CONSOLE=false` (отключить веб-консоль)
- `HASURA_GRAPHQL_DEV_MODE=false` (отключить dev-режим)
- `HASURA_GRAPHQL_UNAUTHORIZED_ROLE=` (пустое значение = требовать аутентификацию)

Если нужен публичный read-only доступ, настройте Hasura permissions через CLI/metadata.

### 3. Запуск production стека

```bash
docker compose -f docker-compose.prod.yml up -d
```

Стек включает:
- **postgres** — PostgreSQL 16 с persistent volume
- **hasura** — GraphQL Engine без dev-консоли
- **indexer** — автоматическая индексация блоков Reef Chain

### 4. Мониторинг индексера

```bash
# Логи индексера
docker compose -f docker-compose.prod.yml logs -f indexer

# Проверка прогресса
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U reef -d reef_explorer -c "SELECT * FROM indexer_cursor WHERE id = 'main';"
```

### 5. Настройка START_BLOCK

Для быстрого старта установите `START_BLOCK` близко к текущему head:

```bash
# В .env
START_BLOCK=14900000
```

Для полного backfill оставьте `START_BLOCK=0` (индексер продолжит с cursor).

### 6. Backup и восстановление

```bash
# Backup
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U reef reef_explorer > backup.sql

# Restore
cat backup.sql | docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U reef -d reef_explorer
```

### 7. Обновление

```bash
# Pull новых образов
docker compose -f docker-compose.prod.yml pull

# Пересборка indexer (если изменился код)
docker compose -f docker-compose.prod.yml build indexer

# Restart с новыми версиями
docker compose -f docker-compose.prod.yml up -d
```

### 8. Оптимизация и улучшение запросов

После запуска стека примените оптимизации из `hasura-metadata.sql`:

```bash
# Применить computed fields, views и дополнительные индексы
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U reef -d reef_explorer -f /docker-entrypoint-initdb.d/hasura-metadata.sql
```

**Что включено:**
- ✅ **Computed fields** — `account_reef_balance`, `account_transfer_count`, `account_last_activity`
- ✅ **Materialized views** — `top_reef_holders` (обновлять раз в час)
- ✅ **Аналитические views** — `daily_transfer_stats`, `top_tokens_by_activity`
- ✅ **Оптимизированные индексы** — для EVM lookup, recent transfers, NFT queries, swap analytics

**Редактирование GraphQL запросов:**

1. **Через Hasura Console** (временно включить для dev):
   ```env
   # В .env
   HASURA_GRAPHQL_ENABLE_CONSOLE=true
   ```
   Перезапустить: `docker compose -f docker-compose.prod.yml restart hasura`
   Открыть: `http://your-server:8080/console`

2. **Через Hasura CLI** (рекомендуется):
   ```bash
   # Локально
   hasura console --endpoint http://your-server:8080 --admin-secret YOUR_SECRET
   ```

3. **Через GraphQL клиент** (Altair/Insomnia/Postman):
   - URL: `http://your-server:8080/v1/graphql`
   - Header: `x-hasura-admin-secret: YOUR_SECRET`

### Безопасность

- ✅ Все секреты в `.env` (не коммитить в git!)
- ✅ Hasura console отключена в production
- ✅ PostgreSQL доступен только внутри Docker network
- ⚠️ Для публичного доступа используйте reverse proxy (nginx/traefik) с HTTPS
- ⚠️ Настройте firewall для ограничения доступа к портам

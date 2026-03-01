#!/bin/sh
# Wait for postgres to be ready
until pg_isready -h postgres -U reef; do
  echo "Waiting for postgres..."
  sleep 2
done

# Ensure block schema is compatible with metadata backfill/indexer inserts.
# This keeps existing databases migration-safe without manual ALTER TABLE.
echo "Applying block schema compatibility migration..."
PGPASSWORD=$PG_PASS psql -h $PG_HOST -U $PG_USER -d $PG_DB -v ON_ERROR_STOP=1 -c "
  ALTER TABLE IF EXISTS block
    ALTER COLUMN parent_hash DROP NOT NULL,
    ALTER COLUMN state_root DROP NOT NULL,
    ALTER COLUMN extrinsics_root DROP NOT NULL,
    ALTER COLUMN extrinsic_count DROP NOT NULL,
    ALTER COLUMN event_count DROP NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_block_processor_timestamp ON block (processor_timestamp DESC);
"

# Update cursor to START_BLOCK if set
if [ -n "$START_BLOCK" ] && [ "$START_BLOCK" -gt 0 ]; then
  echo "Setting indexer cursor to START_BLOCK=$START_BLOCK"
  PGPASSWORD=$PG_PASS psql -h $PG_HOST -U $PG_USER -d $PG_DB -c "UPDATE indexer_cursor SET last_block = $START_BLOCK WHERE id = 'main' AND last_block = 0;"
fi

# Start indexer
exec node dist/index.js

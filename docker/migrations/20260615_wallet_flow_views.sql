-- Wallet "pool" (SovraWaterfall) data layer.
--
-- Two read-only views power the per-wallet flow UI with tiny, index-backed
-- queries (always filtered by a single account_id):
--   * wallet_flow_totals  — channel cards / USD totals / netFlow
--   * wallet_flow_daily   — calendar activity heatmap
--
-- Channel classification for an account A (success only):
--   from_id = A, reefswap_action IS NULL      -> 'outflow'
--   to_id   = A, reefswap_action IS NULL      -> 'inflow'
--   from_id = A, reefswap_action IS NOT NULL  -> 'swap'   (legs you put into a swap)
--   staking.signer_id = A, type = 'Reward'    -> 'stakeIn'
-- A swap marks ALL legs of the extrinsic with reefswap_action='Swap' (see
-- 20260503_mark_existing_swaps.sql), so requiring reefswap_action IS NULL for
-- in/out keeps swap legs out of inflow/outflow (no double counting).
--
-- account_id is a GROUP BY key in every branch, so `WHERE account_id = $1`
-- pushes down to the existing indexes (verified via EXPLAIN ANALYZE):
--   transfer_from_id_timestamp_idx, transfer_to_id_timestamp_idx.
-- staking had no signer_id index (seq scan) — added below.

-- Missing index: per-wallet staking lookups (totals + daily + reward list).
-- CONCURRENTLY (outside any transaction) so it does not block the indexer's
-- writes to `staking` while building. Safe to re-run (IF NOT EXISTS).
CREATE INDEX CONCURRENTLY IF NOT EXISTS staking_signer_id_timestamp_idx
  ON staking (signer_id, "timestamp" DESC);

-- REEF native pseudo-token id (native transfers + staking rewards are REEF).
-- = 0x0000000000000000000000000000000001000000

BEGIN;

CREATE OR REPLACE VIEW wallet_flow_totals AS
    SELECT from_id   AS account_id, 'outflow' AS channel, token_id,
           count(*)  AS tx_count,   sum(amount) AS sum_amount
    FROM transfer
    WHERE success AND reefswap_action IS NULL AND from_id IS NOT NULL
    GROUP BY from_id, token_id
  UNION ALL
    SELECT to_id, 'inflow', token_id, count(*), sum(amount)
    FROM transfer
    WHERE success AND reefswap_action IS NULL AND to_id IS NOT NULL
    GROUP BY to_id, token_id
  UNION ALL
    SELECT from_id, 'swap', token_id, count(*), sum(amount)
    FROM transfer
    WHERE success AND reefswap_action IS NOT NULL AND from_id IS NOT NULL
    GROUP BY from_id, token_id
  UNION ALL
    SELECT signer_id, 'stakeIn',
           '0x0000000000000000000000000000000001000000'::text,
           count(*), sum(amount)
    FROM staking
    WHERE type = 'Reward' AND signer_id IS NOT NULL
    GROUP BY signer_id;

CREATE OR REPLACE VIEW wallet_flow_daily AS
    SELECT from_id AS account_id, 'outflow' AS channel,
           date_trunc('day', "timestamp") AS day,
           count(*) AS tx_count, sum(amount) AS sum_amount
    FROM transfer
    WHERE success AND reefswap_action IS NULL AND from_id IS NOT NULL
    GROUP BY from_id, day
  UNION ALL
    SELECT to_id, 'inflow', date_trunc('day', "timestamp"),
           count(*), sum(amount)
    FROM transfer
    WHERE success AND reefswap_action IS NULL AND to_id IS NOT NULL
    GROUP BY to_id, date_trunc('day', "timestamp")
  UNION ALL
    SELECT from_id, 'swap', date_trunc('day', "timestamp"),
           count(*), sum(amount)
    FROM transfer
    WHERE success AND reefswap_action IS NOT NULL AND from_id IS NOT NULL
    GROUP BY from_id, date_trunc('day', "timestamp")
  UNION ALL
    SELECT signer_id, 'stakeIn', date_trunc('day', "timestamp"),
           count(*), sum(amount)
    FROM staking
    WHERE type = 'Reward' AND signer_id IS NOT NULL
    GROUP BY signer_id, date_trunc('day', "timestamp");

COMMIT;

-- After applying, track both views in Hasura so they are queryable via GraphQL:
--   curl -s http://localhost:8080/v1/metadata \
--     -H "x-hasura-admin-secret: $HASURA_GRAPHQL_ADMIN_SECRET" \
--     -H 'Content-Type: application/json' \
--     -d '{"type":"pg_track_table","args":{"source":"default","schema":"public","name":"wallet_flow_totals"}}'
--   (repeat for wallet_flow_daily)

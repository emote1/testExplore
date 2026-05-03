-- Backfill `transfer.reefswap_action` for rows already in the DB.
-- The indexer's swap detector grouped by extrinsic_hash, which is always NULL
-- in this build, so reefswap_action stayed empty for the entire history.
-- Once the parser is fixed (group by extrinsic_id, plus the stricter
-- heuristic in this script), only NEW blocks would be marked — this script
-- handles the legs already indexed.
--
-- Real swap heuristic (matches detectAndMarkSwaps):
--   For some EVM address (the user), among the ERC20 legs of the extrinsic,
--   ignoring mint/burn legs from/to the zero address:
--     * exactly 1 unique outgoing token
--     * exactly 1 unique incoming token
--     * outgoing token != incoming token
-- Add liquidity   => 2+ outgoing tokens, 1 incoming (LP)  -> excluded.
-- Remove liquidity => 1 outgoing (LP), 2+ incoming        -> excluded.

BEGIN;

UPDATE transfer SET reefswap_action = NULL WHERE reefswap_action = 'Swap';

WITH user_legs AS (
  SELECT
    extrinsic_id,
    lower(from_evm_address) AS user_evm,
    'out' AS dir,
    token_id
  FROM transfer
  WHERE type='ERC20'
    AND extrinsic_id IS NOT NULL
    AND from_evm_address IS NOT NULL AND from_evm_address <> ''
    AND lower(from_evm_address) <> '0x0000000000000000000000000000000000000000'
  UNION ALL
  SELECT
    extrinsic_id,
    lower(to_evm_address) AS user_evm,
    'in'  AS dir,
    token_id
  FROM transfer
  WHERE type='ERC20'
    AND extrinsic_id IS NOT NULL
    AND to_evm_address IS NOT NULL AND to_evm_address <> ''
    AND lower(to_evm_address) <> '0x0000000000000000000000000000000000000000'
),
swap_users AS (
  SELECT extrinsic_id, user_evm
  FROM user_legs
  GROUP BY extrinsic_id, user_evm
  HAVING COUNT(DISTINCT token_id) FILTER (WHERE dir='out') = 1
     AND COUNT(DISTINCT token_id) FILTER (WHERE dir='in')  = 1
     AND MAX(token_id) FILTER (WHERE dir='out')
       <> MAX(token_id) FILTER (WHERE dir='in')
),
swap_extrinsics AS (
  SELECT DISTINCT extrinsic_id FROM swap_users
)
UPDATE transfer t
SET reefswap_action = 'Swap'
WHERE t.extrinsic_id IN (SELECT extrinsic_id FROM swap_extrinsics);

COMMIT;

-- Backfill `transfer.reefswap_action` for rows already in the DB.
-- The indexer's swap detector grouped by extrinsic_hash, which is always NULL
-- in this build, so reefswap_action stayed empty for the entire history.
-- Once the parser is fixed (group by extrinsic_id), only NEW blocks would be
-- marked — this script handles the legs already indexed.
--
-- Heuristic: an extrinsic_id is a swap when, within its ERC20 legs, some EVM
-- address appears as both source and sink and the legs touch >= 2 different
-- tokens. All legs of such extrinsic_id are stamped 'Swap'.

BEGIN;

WITH swap_extrinsics AS (
  SELECT t.extrinsic_id
  FROM transfer t
  WHERE t.type='ERC20' AND t.extrinsic_id IS NOT NULL
  GROUP BY t.extrinsic_id
  HAVING COUNT(DISTINCT t.token_id) >= 2
     AND EXISTS (
       SELECT 1
       FROM transfer s
       WHERE s.extrinsic_id = t.extrinsic_id
         AND s.type='ERC20'
         AND s.from_evm_address IS NOT NULL AND s.from_evm_address <> ''
         AND EXISTS (
           SELECT 1 FROM transfer r
           WHERE r.extrinsic_id = s.extrinsic_id
             AND r.type='ERC20'
             AND lower(r.to_evm_address) = lower(s.from_evm_address)
             AND r.token_id <> s.token_id
         )
     )
)
UPDATE transfer t
SET reefswap_action = 'Swap'
WHERE t.extrinsic_id IN (SELECT extrinsic_id FROM swap_extrinsics)
  AND (t.reefswap_action IS NULL OR t.reefswap_action = '');

COMMIT;

-- ============================================
-- PHASE 2: Adding Indexes
-- Goal: Speed up collaborative filtering queries
-- ============================================
\c steam_collab

-- ============================================
-- STEP 1: Check current indexes
-- ============================================
\echo '=== Current Indexes ==='
\di

-- ============================================
-- STEP 2: EXPLAIN before adding indexes
-- ============================================
\echo '=== Query Plan BEFORE Indexes ==='
EXPLAIN ANALYZE
SELECT u.username, COUNT(*) AS shared_games
FROM user_games ug1
JOIN user_games ug2 ON ug1.app_id = ug2.app_id
JOIN users u ON ug2.user_id = u.user_id
WHERE ug1.user_id = 1 AND ug2.user_id != 1
GROUP BY u.username
ORDER BY shared_games DESC;

-- ============================================
-- STEP 3: Create indexes for our queries
-- ============================================
\echo '=== Creating Indexes ==='

-- Index for filtering by user_id (WHERE ug1.user_id = 1)
CREATE INDEX IF NOT EXISTS idx_ug_user ON user_games (user_id);

-- Index for joining on app_id (ON ug1.app_id = ug2.app_id)
CREATE INDEX IF NOT EXISTS idx_ug_app ON user_games (app_id);

-- Verify indexes were created
\echo '=== Indexes After Creation ==='
\di

-- ============================================
-- STEP 4: EXPLAIN after adding indexes
-- ============================================
\echo '=== Query Plan AFTER Indexes ==='
EXPLAIN ANALYZE
SELECT u.username, COUNT(*) AS shared_games
FROM user_games ug1
JOIN user_games ug2 ON ug1.app_id = ug2.app_id
JOIN users u ON ug2.user_id = u.user_id
WHERE ug1.user_id = 1 AND ug2.user_id != 1
GROUP BY u.username
ORDER BY shared_games DESC;

-- ============================================
-- STEP 5: Compare!
-- Look for:
--   BEFORE: "Seq Scan" (slow - scans all rows)
--   AFTER:  "Index Scan" or "Bitmap Index Scan" (fast!)
-- ============================================
\echo '=== Done! Compare the execution times above ==='

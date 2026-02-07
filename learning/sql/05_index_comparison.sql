-- ============================================
-- Index vs No Index Performance Test
-- Tests on: 10K games, 1K users, 21K interactions
-- ============================================

\c steam_learning
\timing on

-- ============================================
-- 1. Check current state
-- ============================================
\echo '=== Current Indexes ==='
\di sample_*

\echo '=== Data Summary ==='
SELECT 'Games' AS table_name, COUNT(*) FROM sample_games
UNION ALL SELECT 'Users', COUNT(*) FROM sample_users
UNION ALL SELECT 'User-Games', COUNT(*) FROM sample_user_games;

-- ============================================
-- 2. TEST WITHOUT INDEXES
-- ============================================
\echo ''
\echo '=========================================='
\echo '=== TEST 1: WITHOUT INDEXES ==='
\echo '=========================================='

-- Drop any extra indexes (keep primary keys)
DROP INDEX IF EXISTS idx_sug_user;
DROP INDEX IF EXISTS idx_sug_game;

\echo '--- Collaborative Filtering Query (find similar users to user 1) ---'
EXPLAIN ANALYZE
SELECT ug2.user_id, COUNT(*) AS shared_games
FROM sample_user_games ug1
JOIN sample_user_games ug2 ON ug1.app_id = ug2.app_id
WHERE ug1.user_id = 1 AND ug2.user_id != 1
GROUP BY ug2.user_id
ORDER BY shared_games DESC
LIMIT 10;

-- ============================================
-- 3. CREATE INDEXES
-- ============================================
\echo ''
\echo '=== Creating Indexes ==='
CREATE INDEX idx_sug_user ON sample_user_games (user_id);
CREATE INDEX idx_sug_game ON sample_user_games (app_id);

-- Update statistics
ANALYZE sample_user_games;

-- ============================================
-- 4. TEST WITH INDEXES
-- ============================================
\echo ''
\echo '=========================================='
\echo '=== TEST 2: WITH INDEXES ==='
\echo '=========================================='

\echo '--- Same Query With Indexes ---'
EXPLAIN ANALYZE
SELECT ug2.user_id, COUNT(*) AS shared_games
FROM sample_user_games ug1
JOIN sample_user_games ug2 ON ug1.app_id = ug2.app_id
WHERE ug1.user_id = 1 AND ug2.user_id != 1
GROUP BY ug2.user_id
ORDER BY shared_games DESC
LIMIT 10;

-- ============================================
-- 5. SUMMARY
-- ============================================
\echo ''
\echo '=== Compare the Execution Time between TEST 1 and TEST 2! ==='
\echo '=== Look for: "Execution Time: X.XXX ms" ==='

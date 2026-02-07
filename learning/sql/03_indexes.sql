-- ============================================
-- LESSON 3: PostgreSQL Indexes (Chapter 11)
-- Docs: https://www.postgresql.org/docs/current/indexes.html
-- ============================================
-- Run in: steam_learning database
-- \c steam_learning

-- ============================================
-- 11.1 INTRODUCTION - Why Indexes?
-- ============================================

-- First, let's create a bigger test table
DROP TABLE IF EXISTS test_data;
CREATE TABLE test_data (
    id SERIAL PRIMARY KEY,
    value INTEGER,
    category VARCHAR(50)
);

-- Insert 10,000 rows for testing
INSERT INTO test_data (value, category)
SELECT 
    (random() * 1000)::INTEGER,
    CASE (random() * 3)::INTEGER 
        WHEN 0 THEN 'Action'
        WHEN 1 THEN 'RPG'
        WHEN 2 THEN 'Strategy'
        ELSE 'Puzzle'
    END
FROM generate_series(1, 10000);

-- Verify data loaded
SELECT COUNT(*) AS total_rows FROM test_data;
SELECT * FROM test_data LIMIT 5;

-- ============================================
-- EXERCISE 1: See Query Plans (EXPLAIN)
-- ============================================

-- Without index - "Seq Scan" = reads every row
EXPLAIN SELECT * FROM test_data WHERE value = 500;

-- Check: Do you see "Seq Scan on test_data"?

-- ============================================
-- EXERCISE 2: Create Your First Index
-- ============================================

-- Create an index on the 'value' column
CREATE INDEX idx_test_value ON test_data (value);

-- Now check the query plan again
EXPLAIN SELECT * FROM test_data WHERE value = 500;

-- Check: Do you see "Index Scan" or "Bitmap Index Scan"?

-- ============================================
-- EXERCISE 3: EXPLAIN ANALYZE (Real Timing)
-- ============================================

-- ANALYZE actually runs the query and shows real timing
EXPLAIN ANALYZE SELECT * FROM test_data WHERE value = 500;

-- Look for:
--   "Execution Time: X.XXX ms"
--   "actual time=..."

-- ============================================
-- 11.2 INDEX TYPES
-- ============================================

-- PostgreSQL supports multiple index types:
-- 1. B-tree (DEFAULT) - equality and range queries
-- 2. Hash - equality only (rarely used)
-- 3. GiST - geometric data, full-text search
-- 4. GIN - arrays, full-text search
-- 5. BRIN - very large tables with natural ordering

-- B-tree (default, you've been using this!)
CREATE INDEX idx_test_btree ON test_data USING btree (value);

-- See all indexes on our test table
\di test_data*

-- ============================================
-- 11.3 MULTICOLUMN INDEXES
-- ============================================

-- Index on MULTIPLE columns
CREATE INDEX idx_test_multi ON test_data (category, value);

-- This index helps these queries:
EXPLAIN SELECT * FROM test_data WHERE category = 'Action';
EXPLAIN SELECT * FROM test_data WHERE category = 'Action' AND value > 500;

-- This index does NOT help this query (wrong column order!):
EXPLAIN SELECT * FROM test_data WHERE value > 500;

-- KEY INSIGHT: Column order matters in multicolumn indexes!
-- Index on (A, B) helps: WHERE A = ?, WHERE A = ? AND B = ?
-- Index on (A, B) does NOT help: WHERE B = ?

-- ============================================
-- 11.4 INDEXES AND ORDER BY
-- ============================================

-- Indexes can speed up sorting!
EXPLAIN SELECT * FROM test_data ORDER BY value LIMIT 10;

-- ============================================
-- 11.5 COMBINING INDEXES
-- ============================================

-- PostgreSQL can use multiple indexes together
CREATE INDEX idx_test_category ON test_data (category);

-- Query using both indexes
EXPLAIN SELECT * FROM test_data WHERE value = 500 OR category = 'Action';

-- ============================================
-- 11.6 UNIQUE INDEXES
-- ============================================

-- Unique index = enforces uniqueness
CREATE UNIQUE INDEX idx_test_unique ON test_data (id);
-- (Note: PRIMARY KEY already creates a unique index!)

-- ============================================
-- 11.8 PARTIAL INDEXES
-- ============================================

-- Index only certain rows!
CREATE INDEX idx_high_value ON test_data (value) WHERE value > 800;

-- This helps queries filtered to high values
EXPLAIN SELECT * FROM test_data WHERE value > 900;

-- ============================================
-- 11.9 INDEX-ONLY SCANS
-- ============================================

-- If ALL columns you need are in the index, 
-- PostgreSQL doesn't need to read the table!

-- Create an index that includes both columns we need
CREATE INDEX idx_covering ON test_data (category, value);

-- This query can be answered from the index alone!
EXPLAIN SELECT category, value FROM test_data WHERE category = 'Action';

-- Look for "Index Only Scan"

-- ============================================
-- EXERCISE 4: Apply to Steam Games!
-- ============================================

-- List current indexes on user_games
\di user_games*

-- Create indexes for collaborative filtering queries
CREATE INDEX IF NOT EXISTS idx_ug_user ON user_games (user_id);
CREATE INDEX IF NOT EXISTS idx_ug_game ON user_games (app_id);

-- See the query plan for our collaborative filtering query
EXPLAIN ANALYZE
SELECT ug2.user_id, COUNT(*) AS shared_games
FROM user_games ug1
JOIN user_games ug2 ON ug1.app_id = ug2.app_id
WHERE ug1.user_id = 1 AND ug2.user_id != 1
GROUP BY ug2.user_id;

-- ============================================
-- CLEANUP (Optional)
-- ============================================

-- Drop test table when done
-- DROP TABLE test_data;

-- Drop specific indexes
-- DROP INDEX idx_test_value;

-- ============================================
-- SUMMARY
-- ============================================

-- Key Commands:
--   \di               - List all indexes
--   \di table*        - List indexes for specific table
--   EXPLAIN query     - Show query plan
--   EXPLAIN ANALYZE   - Show plan with real timing
--   CREATE INDEX      - Create an index
--   DROP INDEX        - Remove an index

-- ============================================
-- PHASE 4: Load Real Data
-- Goal: Load 97K Steam games from CSV
-- Learning: COPY, data cleaning, performance
-- ============================================

-- ============================================
-- PART 1: Explore the Raw CSV First
-- ============================================
-- Before loading, understand the data!
-- Run these in your terminal (not psql):

-- $ head -1 $GAMES_CSV | tr ',' '\n' | nl
-- $ wc -l $GAMES_CSV
-- $ cut -d',' -f1,2,7 $GAMES_CSV | head -5

-- ============================================
-- PART 2: Create a Fresh Database
-- ============================================
-- We'll create a new database for real data
-- Run from terminal: createdb steam_production

\c steam_production

-- ============================================
-- PART 3: Create Tables to Match CSV
-- ============================================
\echo '=== Creating Tables ==='

DROP TABLE IF EXISTS game_tags CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS user_games CASCADE;
DROP TABLE IF EXISTS games CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Games table with columns matching CSV
-- Columns: AppID, Name, Release date, Price, etc.
CREATE TABLE games (
    app_id          INTEGER PRIMARY KEY,
    game_name       VARCHAR(500) NOT NULL,
    release_date    VARCHAR(50) NOT NULL,
    estimated_owners VARCHAR(50),
    peak_ccu        INTEGER DEFAULT 0,
    required_age    INTEGER DEFAULT 0,
    price           DECIMAL(10,2) DEFAULT 0.00,
    dlc_count       INTEGER DEFAULT 0,
    long_description TEXT, 
    short_description TEXT,
    support_languages TEXT,
    full_audio_languages TEXT,
    reviews TEXT,
    header_image VARCHAR(500),
    website VARCHAR(500),
    -- support_url VARCHAR(500),
    -- support_email VARCHAR(500),
    -- windows_os_support      BOOLEAN DEFAULT TRUE,
    -- mac_os_support          BOOLEAN DEFAULT FALSE,
    -- linux_os_support        BOOLEAN DEFAULT FALSE,
    metacritic_score INTEGER DEFAULT 0,
    metacritic_url VARCHAR(500),
    user_score INTEGER DEFAULT 0,
    positive_votes        INTEGER DEFAULT 0,
    negative_votes        INTEGER DEFAULT 0,
    score_rank INTEGER DEFAULT 0,
    achievements    INTEGER DEFAULT 0,
    recommendations INTEGER DEFAULT 0,
    average_playtime INTEGER DEFAULT 0,
    -- average_playtime_2weeks INTEGER DEFAULT 0,
    median_playtime INTEGER DEFAULT 0,
    -- median_playtime_2weeks INTEGER DEFAULT 0,
    developers      VARCHAR(500),
    publishers      VARCHAR(500),
    categories      TEXT,
    genres          TEXT,
    tags            TEXT
);

\d games

-- ============================================
-- PART 4: Try COPY (Will Likely Fail!)
-- ============================================
-- This teaches you about data cleaning challenges

\echo '=== Attempting Direct COPY (expect errors!) ==='

-- COPY games FROM '/Users/jensonphan/cs125/backend/data/raw/games.csv'
-- WITH (FORMAT csv, HEADER true);

-- ^ This will fail! CSV has:
--   - Commas inside quoted fields
--   - Special characters
--   - Missing values
--   - Columns we didn't include

-- ============================================
-- PART 5: Load Data with Python (Recommended)
-- ============================================
-- For complex CSVs, Python's csv module handles edge cases better

\echo '=== Create a Python loader script ==='
\echo 'See: learning/scripts/load_games.py'

-- ============================================
-- PART 6: Start Simple - Load Essential Columns Only
-- ============================================
\echo '=== Simplified Games Table ==='

DROP TABLE IF EXISTS games CASCADE;

CREATE TABLE games (
    app_id INTEGER PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    price DECIMAL(10,2) DEFAULT 0.00,
    positive INTEGER DEFAULT 0,
    negative INTEGER DEFAULT 0,
    genres TEXT,
    tags TEXT
);

-- ============================================
-- PART 7: Verify After Loading
-- ============================================
-- After running load_games.py, check:

\echo '=== Verification Queries ==='

-- How many games loaded?
SELECT COUNT(*) AS total_games FROM games;

-- Sample of data
SELECT app_id, name, price FROM games LIMIT 5;

-- Price distribution
SELECT 
    CASE 
        WHEN price = 0 THEN 'Free'
        WHEN price < 10 THEN 'Under $10'
        WHEN price < 30 THEN '$10-30'
        WHEN price < 60 THEN '$30-60'
        ELSE '$60+'
    END AS price_range,
    COUNT(*) AS count
FROM games
GROUP BY 1
ORDER BY count DESC;

-- Top rated games (by positive reviews)
SELECT name, positive, negative, 
       ROUND(positive::numeric / NULLIF(positive + negative, 0) * 100, 1) AS approval
FROM games
WHERE positive + negative > 1000
ORDER BY approval DESC
LIMIT 10;

-- ============================================
-- PART 8: Add Indexes After Loading
-- ============================================
\echo '=== Creating Indexes ==='

CREATE INDEX idx_games_price ON games (price);
CREATE INDEX idx_games_positive ON games (positive);

\di

-- ============================================
-- PART 9: Test Performance at Scale
-- ============================================
\echo '=== Performance Test ==='

EXPLAIN ANALYZE
SELECT name, price FROM games WHERE price = 0 LIMIT 100;

EXPLAIN ANALYZE
SELECT name, positive FROM games ORDER BY positive DESC LIMIT 10;

\echo '=== Phase 4 Complete! ==='
\echo 'Next: Run learning/scripts/load_games.py to load real data'

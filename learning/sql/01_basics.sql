-- ============================================
-- LESSON 1: PostgreSQL Basics
-- ============================================
-- Run each section one at a time to learn!
-- Use: psql -f 01_basics.sql OR copy-paste into psql

-- ============================================
-- 1. CREATE DATABASE (run this first in psql)
-- ============================================
-- CREATE DATABASE steam_learning;
-- \c steam_learning

-- ============================================
-- 2. CREATE TABLES
-- ============================================

-- Games table (simplified from your Steam data)
CREATE TABLE IF NOT EXISTS games (
    app_id      INTEGER PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    price       DECIMAL(10,2),
    positive    INTEGER DEFAULT 0,
    negative    INTEGER DEFAULT 0
);

-- Users table (for collaborative filtering later)
CREATE TABLE IF NOT EXISTS users (
    user_id     SERIAL PRIMARY KEY,
    username    VARCHAR(100) UNIQUE NOT NULL
);

-- User-Game interactions (the heart of collaborative filtering!)
CREATE TABLE IF NOT EXISTS user_games (
    user_id     INTEGER REFERENCES users(user_id),
    app_id      INTEGER REFERENCES games(app_id),
    playtime    INTEGER DEFAULT 0,  -- hours played (implicit rating)
    owned_at    TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, app_id)
);

-- ============================================
-- 3. INSERT SAMPLE DATA
-- ============================================

INSERT INTO games (app_id, name, price, positive, negative) VALUES
    (730,    'Counter-Strike 2',      0.00,   7000000, 500000),
    (570,    'Dota 2',                0.00,   2000000, 300000),
    (440,    'Team Fortress 2',       0.00,   900000,  50000),
    (1091500, 'Cyberpunk 2077',       59.99,  600000,  100000),
    (292030, 'The Witcher 3',         39.99,  700000,  20000)
ON CONFLICT (app_id) DO NOTHING;

INSERT INTO users (username) VALUES
    ('alice'),
    ('bob'),
    ('charlie'),
    ('diana')
ON CONFLICT (username) DO NOTHING;

-- Simulate user game ownership and playtime
INSERT INTO user_games (user_id, app_id, playtime) VALUES
    (1, 730, 500),    -- alice plays CS2 a lot
    (1, 570, 200),    -- alice plays Dota 2
    (1, 292030, 100), -- alice plays Witcher 3
    (2, 730, 1000),   -- bob LOVES CS2
    (2, 440, 300),    -- bob plays TF2
    (3, 570, 800),    -- charlie loves Dota 2
    (3, 1091500, 50), -- charlie played some Cyberpunk
    (3, 292030, 150), -- charlie plays Witcher 3
    (4, 1091500, 200),-- diana plays Cyberpunk
    (4, 292030, 300)  -- diana plays Witcher 3
ON CONFLICT DO NOTHING;

-- ============================================
-- 4. BASIC QUERIES - Try these!
-- ============================================

-- Select all games
SELECT * FROM games;

-- Select specific columns
SELECT name, price FROM games;

-- Filter with WHERE
SELECT name, price FROM games WHERE price = 0;

-- Sort with ORDER BY
SELECT name, positive FROM games ORDER BY positive DESC;

-- Count rows
SELECT COUNT(*) FROM games;

-- ============================================
-- 5. EXERCISES - Try these yourself!
-- ============================================

-- Q1: Find all games with more than 1 million positive reviews
-- SELECT ... FROM games WHERE positive > ...;

-- Q2: Find the average price of all games
-- SELECT AVG(...) FROM games;

-- Q3: Find users who have played more than 100 hours of any game
-- SELECT DISTINCT ... FROM user_games WHERE playtime > ...;

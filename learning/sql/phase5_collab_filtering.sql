-- ============================================
-- PHASE 5: Collaborative Filtering (Part 1)
-- Goal: Build the recommendation engine
-- Approach: Hands-on, incremental, test as you go
-- ============================================
\c steam_collab

-- ============================================
-- STEP 1: Recreate Users + User_Games Tables
-- ============================================
\echo '=== Step 1: Setting Up User Tables ==='

DROP TABLE IF EXISTS user_games CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE user_games (
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    app_id INTEGER REFERENCES games(app_id) ON DELETE CASCADE,
    playtime INTEGER DEFAULT 0,
    owned_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, app_id)
);

-- Create indexes for performance
CREATE INDEX idx_ug_user ON user_games (user_id);
CREATE INDEX idx_ug_app ON user_games (app_id);

\d users
\d user_games

-- ============================================
-- STEP 2: Generate Synthetic Users
-- ============================================
\echo '=== Step 2: Creating 10 Test Users ==='

INSERT INTO users (username) VALUES
    ('alice'),
    ('bob'),
    ('charlie'),
    ('diana'),
    ('eve'),
    ('frank'),
    ('grace'),
    ('henry'),
    ('ivy'),
    ('jack');

SELECT * FROM users;

-- ============================================
-- STEP 3: Get Popular Games for Testing
-- ============================================
\echo '=== Step 3: Finding Popular Games ==='

-- Store top 20 games by positive votes for easy reference
SELECT app_id, game_name, positive_votes
FROM games
ORDER BY positive_votes DESC
LIMIT 20;

-- ============================================
-- STEP 4: Assign Games to Users (Manually First)
-- ============================================
\echo '=== Step 4: Assigning Games to Users ==='

-- Counter-Strike 2 (730) - Most popular
-- Dota 2 (570)
-- Grand Theft Auto V (271590)
-- PUBG (578080)
-- Terraria (105600)
-- Stardew Valley (413150)
-- Rust (252490)
-- Garry's Mod (4000)
-- Wallpaper Engine (431960)
-- ARK (346110)

-- Alice: FPS + Multiplayer gamer
INSERT INTO user_games (user_id, app_id, playtime) VALUES
    (1, 730, 1000),    -- CS2
    (1, 578080, 500),  -- PUBG
    (1, 252490, 800);  -- Rust

-- Bob: Similar to Alice (FPS focus)
INSERT INTO user_games (user_id, app_id, playtime) VALUES
    (2, 730, 1200),    -- CS2
    (2, 578080, 600),  -- PUBG
    (2, 4000, 300);    -- Garry's Mod

-- Charlie: MOBA + Strategy
INSERT INTO user_games (user_id, app_id, playtime) VALUES
    (3, 570, 2000),    -- Dota 2
    (3, 730, 200);     -- CS2 (casual)

-- Diana: Indie + Relaxed
INSERT INTO user_games (user_id, app_id, playtime) VALUES
    (4, 105600, 500),  -- Terraria
    (4, 413150, 800),  -- Stardew Valley
    (4, 431960, 100);  -- Wallpaper Engine

-- Eve: Mix of everything
INSERT INTO user_games (user_id, app_id, playtime) VALUES
    (5, 730, 300),     -- CS2
    (5, 570, 400),     -- Dota 2
    (5, 105600, 200),  -- Terraria
    (5, 413150, 300);  -- Stardew Valley

-- Verify
\echo '=== Games per User ==='
SELECT u.username, COUNT(*) AS games_owned
FROM users u
JOIN user_games ug ON u.user_id = ug.user_id
GROUP BY u.username
ORDER BY games_owned DESC;

-- ============================================
-- STEP 5: COLLABORATIVE FILTERING - The Core Query!
-- ============================================
\echo '=== Step 5: Finding Similar Users ==='

-- THE KEY INSIGHT:
-- "Similar users" = users who own many of the SAME games as you

-- Find users similar to Alice (user_id = 1)
SELECT 
    u.username,
    COUNT(*) AS shared_games
FROM user_games ug1
JOIN user_games ug2 ON ug1.app_id = ug2.app_id  -- Same game
JOIN users u ON ug2.user_id = u.user_id
WHERE ug1.user_id = 1           -- Alice's games
  AND ug2.user_id != 1          -- Exclude Alice herself
GROUP BY u.username
ORDER BY shared_games DESC;

-- EXPECTED: Bob should be most similar (shares CS2 + PUBG)

-- ============================================
-- STEP 6: Recommendation Query
-- ============================================
\echo '=== Step 6: Recommending Games for Alice ==='

-- THE LOGIC:
-- 1. Find similar users (those with shared games)
-- 2. Find games THEY own that Alice DOESN'T
-- 3. Rank by how many similar users own it

SELECT 
    g.game_name,
    COUNT(DISTINCT ug2.user_id) AS recommended_by_users,
    SUM(ug2.playtime) AS total_playtime
FROM user_games ug1
-- Find Alice's games
JOIN user_games ug_shared ON ug1.app_id = ug_shared.app_id
                          AND ug_shared.user_id != 1
-- Find other games those users own
JOIN user_games ug2 ON ug_shared.user_id = ug2.user_id
                    AND ug2.app_id != ALL(SELECT app_id FROM user_games WHERE user_id = 1)
-- Get game names
JOIN games g ON ug2.app_id = g.app_id
WHERE ug1.user_id = 1
GROUP BY g.app_id, g.game_name
ORDER BY recommended_by_users DESC, total_playtime DESC
LIMIT 10;

-- ============================================
-- STEP 7: Simplify the Query (Cleaner Version)
-- ============================================
\echo '=== Step 7: Simplified Recommendation Query ==='

-- Cleaner version using WITH (CTE)
WITH similar_users AS (
    -- Step 1: Find users with shared games
    SELECT ug2.user_id, COUNT(*) AS shared_count
    FROM user_games ug1
    JOIN user_games ug2 ON ug1.app_id = ug2.app_id
    WHERE ug1.user_id = 1 AND ug2.user_id != 1
    GROUP BY ug2.user_id
),
alice_games AS (
    -- Step 2: Alice's current library
    SELECT app_id FROM user_games WHERE user_id = 1
)
-- Step 3: Recommend games from similar users
SELECT 
    g.game_name,
    COUNT(*) AS times_recommended,
    SUM(su.shared_count) AS similarity_score
FROM similar_users su
JOIN user_games ug ON su.user_id = ug.user_id
JOIN games g ON ug.app_id = g.app_id
WHERE ug.app_id NOT IN (SELECT app_id FROM alice_games)
GROUP BY g.app_id, g.game_name
ORDER BY times_recommended DESC, similarity_score DESC
LIMIT 10;

\echo '=== Phase 5 Part 1 Complete! ==='
\echo 'Try changing user_id = 1 to other users and see different recommendations!'

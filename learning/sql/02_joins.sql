-- ============================================
-- LESSON 2: JOINs for Collaborative Filtering
-- ============================================
-- Prerequisites: Run 01_basics.sql first to create tables and data

-- ============================================
-- 1. INNER JOIN - Only matching rows
-- ============================================

-- Get all user-game pairs with game names
SELECT u.username, g.name, ug.playtime
FROM user_games ug
INNER JOIN users u ON ug.user_id = u.user_id
INNER JOIN games g ON ug.app_id = g.app_id;

-- ============================================
-- 2. LEFT JOIN - All from left table
-- ============================================

-- Find ALL users, even those who haven't played any games
SELECT u.username, COUNT(ug.app_id) AS games_owned
FROM users u
LEFT JOIN user_games ug ON u.user_id = ug.user_id
GROUP BY u.username;

-- ============================================
-- 3. SELF JOIN - Key for Collaborative Filtering!
-- ============================================

-- Find users who share games with Alice (user_id = 1)
-- This is the CORE of collaborative filtering!
SELECT 
    u2.username AS similar_user,
    COUNT(*) AS shared_games
FROM user_games ug1
JOIN user_games ug2 ON ug1.app_id = ug2.app_id  -- Same game
JOIN users u2 ON ug2.user_id = u2.user_id
WHERE ug1.user_id = 1           -- Alice's games
  AND ug2.user_id != 1          -- Exclude Alice herself
GROUP BY u2.username
ORDER BY shared_games DESC;

-- ============================================
-- 4. COLLABORATIVE FILTERING QUERY!
-- ============================================

-- Recommend games for Alice based on similar users
WITH similar_users AS (
    SELECT ug2.user_id, COUNT(*) AS shared_games
    FROM user_games ug1
    JOIN user_games ug2 ON ug1.app_id = ug2.app_id
    WHERE ug1.user_id = 1 AND ug2.user_id != 1
    GROUP BY ug2.user_id
    ORDER BY shared_games DESC
    LIMIT 3  -- Top 3 similar users
)
SELECT DISTINCT g.name AS recommended_game
FROM similar_users su
JOIN user_games ug ON su.user_id = ug.user_id
JOIN games g ON ug.app_id = g.app_id
WHERE ug.app_id NOT IN (
    SELECT app_id FROM user_games WHERE user_id = 1
);

-- ============================================
-- 5. EXERCISES
-- ============================================

-- Q1: Find all games that bob plays (user_id = 2)
-- SELECT g.name FROM ...

-- Q2: Find users who play Dota 2 (app_id = 570)
-- SELECT u.username FROM ...

-- Q3: Count how many games each user owns
-- SELECT u.username, COUNT(*) FROM ...

-- Connect to the database
\c steam_learning

-- 1. First, check current indexes
\di user_games*

-- 2. See plan WITH indexes (current state)
EXPLAIN ANALYZE
SELECT ug2.user_id, COUNT(*) AS shared_games
FROM user_games ug1
JOIN user_games ug2 ON ug1.app_id = ug2.app_id
WHERE ug1.user_id = 1 AND ug2.user_id != 1
GROUP BY ug2.user_id;

-- 3. Drop the indexes
DROP INDEX IF EXISTS idx_ug_user;
DROP INDEX IF EXISTS idx_ug_game;

-- 4. See plan WITHOUT indexes
EXPLAIN ANALYZE
SELECT ug2.user_id, COUNT(*) AS shared_games
FROM user_games ug1
JOIN user_games ug2 ON ug1.app_id = ug2.app_id
WHERE ug1.user_id = 1 AND ug2.user_id != 1
GROUP BY ug2.user_id;

-- 5. Recreate the indexes
CREATE INDEX idx_ug_user ON user_games (user_id);
CREATE INDEX idx_ug_game ON user_games (app_id);
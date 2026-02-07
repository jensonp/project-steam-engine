\c steam_collab
-- \d user_games
-- \d games
-- \d users

-- EXTENDED DISPLAY TEST 
-- SELECT * FROM games LIMIT 3; 
-- \x

-- SELECT * FROM games LIMIT 3; 
-- \x

SELECT column_name 
FROM information_schema.columns
WHERE table_name = 'user_games';

SELECT column_name 
FROM information_schema.columns
WHERE table_name = 'games';

SELECT column_name 
FROM information_schema.columns
WHERE table_name = 'users';



SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('user_games', 'games', 'users')
ORDER BY table_name, ordinal_position;


-- Q1: What games does Alice own?
SELECT g.name, ug.playtime
FROM user_games ug
JOIN games g ON ug.app_id = g.app_id
WHERE ug.user_id = 1;

-- Q2: Who owns Counter-Strike 2?
SELECT u.username, ug.playtime
FROM user_games ug
JOIN users u ON ug.user_id = u.user_id
WHERE ug.app_id = 730;

-- Q3: How many games does each user own?
SELECT u.username, COUNT(*) AS games_owned
FROM users u
JOIN user_games ug ON u.user_id = ug.user_id
GROUP BY u.username
ORDER BY games_owned DESC;

-- Find users similar to Alice (user_id = 1)
SELECT u.username, COUNT(*) AS shared_games
FROM user_games ug1
JOIN user_games ug2 ON ug1.app_id = ug2.app_id
JOIN users u ON ug2.user_id = u.user_id
WHERE ug1.user_id = 1 AND ug2.user_id != 1
GROUP BY u.username
ORDER BY shared_games DESC;
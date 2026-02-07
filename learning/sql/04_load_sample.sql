-- ============================================
-- Load Sample Games + Simulate Users (Fixed)
-- ============================================

\c steam_learning

-- Drop and recreate tables
DROP TABLE IF EXISTS sample_user_games CASCADE;
DROP TABLE IF EXISTS sample_games CASCADE;
DROP TABLE IF EXISTS sample_users CASCADE;

CREATE TABLE sample_games (
    app_id INTEGER PRIMARY KEY,
    name VARCHAR(500),
    price DECIMAL(10,2),
    positive INTEGER DEFAULT 0,
    negative INTEGER DEFAULT 0
);

CREATE TABLE sample_users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(100)
);

CREATE TABLE sample_user_games (
    user_id INTEGER REFERENCES sample_users(user_id),
    app_id INTEGER REFERENCES sample_games(app_id),
    playtime INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, app_id)
);

-- Load games from cleaned CSV
\copy sample_games FROM '/tmp/sample_games.csv' WITH (FORMAT csv, HEADER true);

SELECT COUNT(*) AS games_loaded FROM sample_games;

-- Create 1000 simulated users
INSERT INTO sample_users (username)
SELECT 'user_' || generate_series(1, 1000);

-- Simulate interactions: each user owns 10-50 random games
INSERT INTO sample_user_games (user_id, app_id, playtime)
SELECT 
    u.user_id,
    g.app_id,
    (random() * 500)::INTEGER
FROM sample_users u
CROSS JOIN LATERAL (
    SELECT app_id 
    FROM sample_games 
    ORDER BY random() 
    LIMIT 10 + (random() * 40)::INTEGER
) g
ON CONFLICT DO NOTHING;

-- Summary
SELECT 'Games:' AS table_name, COUNT(*) AS count FROM sample_games
UNION ALL
SELECT 'Users:', COUNT(*) FROM sample_users
UNION ALL
SELECT 'User-Games:', COUNT(*) FROM sample_user_games;

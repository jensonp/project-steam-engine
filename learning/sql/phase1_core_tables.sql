-- ============================================
-- PHASE 1: Core Tables
-- Goal: Minimum viable schema for collaborative filtering
-- ============================================
\c steam_collab
DROP TABLE IF EXISTS user_games CASCADE;
DROP TABLE IF EXISTS games CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE games (
    app_id      INTEGER PRIMARY KEY,
    name        VARCHAR(500) NOT NULL,
    price       DECIMAL(10,2) DEFAULT 0.00
);
\d games

CREATE TABLE users (
    user_id     SERIAL PRIMARY KEY,
    username    VARCHAR(100) UNIQUE NOT NULL
);
\d users

CREATE TABLE user_games (
    user_id     INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    app_id      INTEGER REFERENCES games(app_id) ON DELETE CASCADE,
    playtime    INTEGER DEFAULT 0,
    owned_at    TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, app_id)
);
\d user_games

INSERT INTO games (app_id, name, price) VALUES
    (730,     'Counter-Strike 2',    0.00),
    (570,     'Dota 2',              0.00),
    (440,     'Team Fortress 2',     0.00),
    (1091500, 'Cyberpunk 2077',      59.99),
    (292030,  'The Witcher 3',       39.99),
    (578080,  'PUBG',                0.00),
    (1245620, 'Elden Ring',          59.99),
    (1174180, 'Red Dead 2',          59.99),
    (271590,  'GTA V',               29.99),
    (252490,  'Rust',                39.99);

SELECT * FROM games;

-- Insert some users
INSERT INTO users (username) VALUES
    ('alice'),
    ('bob'),
    ('charlie'),
    ('diana'),
    ('eve');

SELECT * FROM users;

-- Insert user-game interactions (who owns what)
INSERT INTO user_games (user_id, app_id, playtime) VALUES
    -- Alice plays shooters and RPGs
    (1, 730, 500),      -- CS2
    (1, 570, 200),      -- Dota
    (1, 292030, 150),   -- Witcher
    (1, 1245620, 100),  -- Elden Ring
    
    -- Bob loves free games
    (2, 730, 1000),     -- CS2
    (2, 570, 800),      -- Dota
    (2, 440, 500),      -- TF2
    (2, 578080, 300),   -- PUBG
    
    -- Charlie plays RPGs
    (3, 292030, 200),   -- Witcher
    (3, 1245620, 300),  -- Elden Ring
    (3, 1091500, 100),  -- Cyberpunk
    (3, 1174180, 150),  -- RDR2
    
    -- Diana plays some of everything
    (4, 730, 50),       -- CS2
    (4, 1091500, 200),  -- Cyberpunk
    (4, 271590, 400),   -- GTA V
    (4, 252490, 100),   -- Rust
    
    -- Eve plays open world games
    (5, 1091500, 300),  -- Cyberpunk
    (5, 1174180, 200),  -- RDR2
    (5, 271590, 500),   -- GTA V
    (5, 1245620, 150);  -- Elden Ring

-- ============================================
-- Step 5: Test Basic Queries
-- ============================================

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

-- ============================================
-- NEXT: Try the collaborative filtering query!
-- ============================================

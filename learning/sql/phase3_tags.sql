-- ============================================
-- PHASE 3: Expand Schema with Tags
-- Goal: Add normalized tags for richer queries
-- Docs: Normalization, Junction Tables
-- ============================================
\c steam_collab

-- ============================================
-- STEP 1: Create Tags Table
-- ============================================
\echo '=== Creating Tags Table ==='

DROP TABLE IF EXISTS game_tags CASCADE;
DROP TABLE IF EXISTS tags CASCADE;

CREATE TABLE tags (
    tag_id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

\d tags

-- ============================================
-- STEP 2: Create Game-Tags Junction Table
-- ============================================
\echo '=== Creating Game-Tags Junction Table ==='

CREATE TABLE game_tags (
    app_id INTEGER REFERENCES games(app_id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(tag_id) ON DELETE CASCADE,
    PRIMARY KEY (app_id, tag_id)
);

\d game_tags

-- ============================================
-- STEP 3: Insert Sample Tags
-- ============================================
\echo '=== Inserting Sample Tags ==='

INSERT INTO tags (name) VALUES
    ('FPS'),
    ('MOBA'),
    ('RPG'),
    ('Action'),
    ('Adventure'),
    ('Puzzle'),
    ('Strategy'),
    ('Indie'),
    ('Free to Play'),
    ('Multiplayer'),
    ('Singleplayer'),
    ('Open World'),
    ('Survival'),
    ('Simulation');

SELECT * FROM tags;

-- ============================================
-- STEP 4: Tag Our Sample Games
-- ============================================
\echo '=== Tagging Sample Games ==='

-- Counter-Strike 2 (app_id 730): FPS, Multiplayer, Free to Play, Action
INSERT INTO game_tags (app_id, tag_id)
SELECT 730, tag_id FROM tags WHERE name IN ('FPS', 'Multiplayer', 'Free to Play', 'Action');

-- Dota 2 (app_id 570): MOBA, Multiplayer, Free to Play, Strategy
INSERT INTO game_tags (app_id, tag_id)
SELECT 570, tag_id FROM tags WHERE name IN ('MOBA', 'Multiplayer', 'Free to Play', 'Strategy');

-- Elden Ring (app_id 1245620): RPG, Action, Open World, Singleplayer
INSERT INTO game_tags (app_id, tag_id)
SELECT 1245620, tag_id FROM tags WHERE name IN ('RPG', 'Action', 'Open World', 'Singleplayer');

-- Stardew Valley (app_id 413150): Indie, RPG, Simulation, Singleplayer
INSERT INTO game_tags (app_id, tag_id)
SELECT 413150, tag_id FROM tags WHERE name IN ('Indie', 'RPG', 'Simulation', 'Singleplayer');

-- Terraria (app_id 105600): Adventure, Indie, Survival, Multiplayer
INSERT INTO game_tags (app_id, tag_id)
SELECT 105600, tag_id FROM tags WHERE name IN ('Adventure', 'Indie', 'Survival', 'Multiplayer');

-- Verify
SELECT g.name, t.name AS tag
FROM games g
JOIN game_tags gt ON g.app_id = gt.app_id
JOIN tags t ON gt.tag_id = t.tag_id
ORDER BY g.name, t.name;

-- ============================================
-- STEP 5: Useful Tag Queries
-- ============================================

-- Q1: Find all games with a specific tag
\echo '=== Games tagged "RPG" ==='
SELECT g.name
FROM games g
JOIN game_tags gt ON g.app_id = gt.app_id
JOIN tags t ON gt.tag_id = t.tag_id
WHERE t.name = 'RPG';

-- Q2: Find all tags for a specific game
\echo '=== Tags for Elden Ring ==='
SELECT t.name
FROM tags t
JOIN game_tags gt ON t.tag_id = gt.tag_id
WHERE gt.app_id = 1245620;

-- Q3: Count games per tag
\echo '=== Games per Tag ==='
SELECT t.name, COUNT(*) AS game_count
FROM tags t
JOIN game_tags gt ON t.tag_id = gt.tag_id
GROUP BY t.name
ORDER BY game_count DESC;

-- Q4: Find games with multiple specific tags (AND logic)
\echo '=== Games with both "Action" AND "Multiplayer" ==='
SELECT g.name
FROM games g
JOIN game_tags gt ON g.app_id = gt.app_id
JOIN tags t ON gt.tag_id = t.tag_id
WHERE t.name IN ('Action', 'Multiplayer')
GROUP BY g.name
HAVING COUNT(DISTINCT t.name) = 2;

-- ============================================
-- STEP 6: Add Indexes for Tag Queries
-- ============================================
\echo '=== Creating Indexes on game_tags ==='

CREATE INDEX idx_gt_app ON game_tags (app_id);
CREATE INDEX idx_gt_tag ON game_tags (tag_id);

\di

-- ============================================
-- DONE! You now have:
-- - Normalized tags table
-- - Junction table linking games to tags
-- - Indexes for fast lookups
-- ============================================
\echo '=== Phase 3 Complete! ==='

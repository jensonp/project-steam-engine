-- ============================================
-- PHASE 5: Content-Based Search (Part 2)
-- Goal: Search games by text query
-- Learning: Tokenization, ILIKE, Full-Text Search
-- ============================================
\c steam_collab

-- ============================================
-- STEP 1: Basic Text Search with ILIKE
-- ============================================
\echo '=== Step 1: Basic ILIKE Search ==='

-- Simple: Find games with "survival" in name
SELECT game_name, genres, positive_votes
FROM games
WHERE game_name ILIKE '%survival%'
ORDER BY positive_votes DESC
LIMIT 10;

-- ============================================
-- STEP 2: Search Genres (Tag-Based)
-- ============================================
\echo '=== Step 2: Genre-Based Search ==='

-- Find games with "RPG" genre
SELECT game_name, genres, positive_votes
FROM games
WHERE genres ILIKE '%RPG%'
ORDER BY positive_votes DESC
LIMIT 10;

-- ============================================
-- STEP 3: Multi-Term Search (AND logic)
-- ============================================
\echo '=== Step 3: Multi-Term Search ==='

-- Find games that are both "Indie" AND "Puzzle"
SELECT game_name, genres, positive_votes
FROM games
WHERE genres ILIKE '%Indie%'
  AND genres ILIKE '%Puzzle%'
ORDER BY positive_votes DESC
LIMIT 10;

-- ============================================
-- STEP 4: Price-Filtered Search
-- ============================================
\echo '=== Step 4: Price + Genre Search ==='

-- Find free RPG games
SELECT game_name, price, genres, positive_votes
FROM games
WHERE genres ILIKE '%RPG%'
  AND price = 0
ORDER BY positive_votes DESC
LIMIT 10;

-- Find games under $10
SELECT game_name, price, positive_votes
FROM games
WHERE price > 0 AND price < 10
ORDER BY positive_votes DESC
LIMIT 10;

-- ============================================
-- STEP 5: Full-Text Search with tsvector
-- ============================================
\echo '=== Step 5: Full-Text Search (Advanced) ==='

-- PostgreSQL has built-in full-text search!
-- tsvector = tokenized, normalized text
-- tsquery = the search query

-- Example: Search game names
SELECT game_name, positive_votes
FROM games
WHERE to_tsvector('english', game_name) @@ to_tsquery('english', 'dragon')
ORDER BY positive_votes DESC
LIMIT 10;

-- Multiple terms with AND
SELECT game_name, positive_votes
FROM games
WHERE to_tsvector('english', game_name) @@ to_tsquery('english', 'dark & souls')
ORDER BY positive_votes DESC
LIMIT 10;

-- ============================================
-- STEP 6: Create a Search Index for Speed
-- ============================================
\echo '=== Step 6: Creating Full-Text Index ==='

-- Add a generated column for searching
-- (This makes full-text search much faster)

-- First, let's see if we can create a GIN index
CREATE INDEX idx_games_name_fts ON games 
USING GIN (to_tsvector('english', game_name));

\di

-- ============================================
-- STEP 7: Ranked Search Results
-- ============================================
\echo '=== Step 7: Ranked Search ==='

-- ts_rank scores how well each document matches
SELECT 
    game_name,
    positive_votes,
    ts_rank(to_tsvector('english', game_name), to_tsquery('english', 'survival')) AS relevance
FROM games
WHERE to_tsvector('english', game_name) @@ to_tsquery('english', 'survival')
ORDER BY relevance DESC, positive_votes DESC
LIMIT 10;

-- ============================================
-- STEP 8: Combined Ranking (Relevance + Popularity)
-- ============================================
\echo '=== Step 8: Combined Ranking ==='

-- Combine text relevance with popularity
SELECT 
    game_name,
    positive_votes,
    ts_rank(to_tsvector('english', game_name), to_tsquery('english', 'survival')) AS text_score,
    LOG(positive_votes + 1) AS popularity_score,
    ts_rank(to_tsvector('english', game_name), to_tsquery('english', 'survival')) 
        + LOG(positive_votes + 1) * 0.5 AS combined_score
FROM games
WHERE to_tsvector('english', game_name) @@ to_tsquery('english', 'survival')
ORDER BY combined_score DESC
LIMIT 10;

\echo '=== Phase 5 Part 2 Complete! ==='
\echo 'You now have both collaborative filtering AND content-based search!'


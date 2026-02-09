/**
 * Lesson 3: Search API Endpoint
 * Run: node 03_search_api.js
 * Test: http://localhost:3000/api/search?q=survival
 * 
 * === HANDS-ON TESTS (Run in a new terminal) ===
 * 
 * 1. Basic Search (ILIKE):
 *    $ curl "http://localhost:3000/api/search/basic?q=dragon"
 * 
 * 2. Full-Text Search (ts_rank):
 *    $ curl "http://localhost:3000/api/search?q=survival%20horror"
 *    $ curl "http://localhost:3000/api/search?q=co-op"
 * 
 * 3. Filtered Search:
 *    $ curl "http://localhost:3000/api/search/filtered?q=&maxPrice=0&genre=RPG"
 * 
 * === MINI CHALLENGES ===
 * 1. Modify the /api/search route to return ONLY games with positive_votes > 1000.
 * 2. Add a new filter for 'minPrice' to the filtered search route.
 * 3. Try searching for strict phrases like "'Dark Souls'" (what happens?).
 */

const express = require('express');
const { Pool } = require('pg');

const app = express();
const PORT = 3000;

// ============================================
// Database Connection
// ============================================
const pool = new Pool({
    host: '/var/run/postgresql',
    // port: 8080,           // Your PostgreSQL port
    database: 'steam_collab',
    user: 'cherryquartzio'
});

// ============================================
// STEP 1: Basic Search (ILIKE)
// ============================================
app.get('/api/search/basic', async (req, res) => {
    const query = req.query.q || '';
    
    if (!query) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
    }
    
    try {
        const result = await pool.query(`
            SELECT app_id, game_name, price, positive_votes
            FROM games
            WHERE game_name ILIKE $1
            ORDER BY positive_votes DESC
            LIMIT 20
        `, [`%${query}%`]);
        
        res.json({
            query: query,
            count: result.rows.length,
            results: result.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// STEP 2: Full-Text Search (ts_rank)
// ============================================
app.get('/api/search', async (req, res) => {
    const query = req.query.q || '';
    
    if (!query) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
    }
    
    // Convert "survival horror" → "survival & horror" for tsquery
    const tsQuery = query.split(/\s+/).join(' & ');
    
    try {
        const result = await pool.query(`
            SELECT 
                app_id, 
                game_name, 
                price, 
                positive_votes,
                ts_rank(to_tsvector('english', game_name), to_tsquery('english', $1)) AS relevance
            FROM games
            WHERE to_tsvector('english', game_name) @@ to_tsquery('english', $1)
            ORDER BY relevance DESC, positive_votes DESC
            LIMIT 20
        `, [tsQuery]);
        
        res.json({
            query: query,
            tsQuery: tsQuery,
            count: result.rows.length,
            results: result.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// STEP 3: Search with Filters
// ============================================
app.get('/api/search/filtered', async (req, res) => {
    const query = req.query.q || '';
    const maxPrice = parseFloat(req.query.maxPrice) || 60;
    const genre = req.query.genre || '';
    
    try {
        let sql = `
            SELECT app_id, game_name, price, genres, positive_votes
            FROM games
            WHERE game_name ILIKE $1
              AND price <= $2
        `;
        const params = [`%${query}%`, maxPrice];
        
        if (genre) {
            sql += ` AND genres ILIKE $3`;
            params.push(`%${genre}%`);
        }
        
        sql += ` ORDER BY positive_votes DESC LIMIT 20`;
        
        const result = await pool.query(sql, params);
        
        res.json({
            query: query,
            filters: { maxPrice, genre },
            count: result.rows.length,
            results: result.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// Start Server
// ============================================
app.listen(PORT, () => {
    console.log(`🚀 Search API running at http://localhost:${PORT}`);
    console.log('');
    console.log('Try these URLs:');
    console.log(`  http://localhost:${PORT}/api/search?q=survival`);
    console.log(`  http://localhost:${PORT}/api/search/basic?q=dragon`);
    console.log(`  http://localhost:${PORT}/api/search/filtered?q=&maxPrice=0&genre=RPG`);
});

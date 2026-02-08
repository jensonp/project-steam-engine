/**
 * Lesson 1: Basic Express Server
 * Run: node 01_hello_express.js
 * Visit: http://localhost:3000
 * 
 * === HANDS-ON TESTS (Run in a new terminal) ===
 * 
 * 1. Basic Route:
 *    $ curl http://localhost:3000/
 * 
 * 2. Route Parameters (ID):
 *    $ curl http://localhost:3000/api/games/123
 *    $ curl http://localhost:3000/api/games/cs2
 * 
 * 3. Query Parameters (?q=...):
 *    $ curl "http://localhost:3000/api/search?q=puzzle"
 *    $ curl "http://localhost:3000/api/search"  (What happens if q is empty?)
 * 
 * === MINI CHALLENGES ===
 * 1. Try visiting a route that doesn't exist (e.g., /api/users). What does Express send back?
 * 2. Modify the /api/search route to look for a second parameter (e.g., &limit=10).
 * 3. Add a console.log(req.method) inside one of the routes and see it print in the server terminal.
 */

const express = require('express');
const app = express();
const PORT = 3000;

// ============================================
// STEP 0: Global Middleware (Runs FIRST)
// ============================================
app.use((req, res, next) => {
    console.log(`\n[1] New Request: ${req.method} ${req.url}`);
    next(); // Pass control to the next handler/route
});

// ============================================
// STEP 1: Basic Route
// ============================================
app.get('/', (req, res) => {
    console.log('[2] Matched Route: GET /');
    res.json({ message: 'Hello from Node.js!' });
    console.log('[3] Response Sent');
});

// ============================================
// STEP 2: Route with Parameters
// ============================================
app.get('/api/games/:id', (req, res) => {
    console.log(`[2] Matched Route: GET /api/games/:id`);
    console.log(`    - ID Parameter: ${req.params.id}`);
    
    const gameId = req.params.id;
    res.json({ 
        message: `You requested game ID: ${gameId}`,
        // In real app: fetch from database
    });
    console.log('[3] Response Sent');
});

// ============================================
// STEP 3: Route with Query Parameters
// ============================================
app.get('/api/search', (req, res) => {
    console.log(`[2] Matched Route: GET /api/search`);
    console.log(`    - Query Params:`, req.query);

    const query = req.query.q || '';
    res.json({ 
        message: `You searched for: ${query}`,
        // In real app: query database
    });
    console.log('[3] Response Sent');
});

// ============================================
// Start Server
// ============================================
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log('');
    console.log('Try these URLs:');
    console.log(`  http://localhost:${PORT}/`);
    console.log(`  http://localhost:${PORT}/api/games/730`);
    console.log(`  http://localhost:${PORT}/api/search?q=survival`);
});

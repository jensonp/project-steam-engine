/**
 * Lesson 1: Basic Express Server
 * Run: node 01_hello_express.js
 * Visit: http://localhost:3000
 */

const express = require('express');
const app = express();
const PORT = 3000;

// ============================================
// STEP 1: Basic Route
// ============================================
app.get('/', (req, res) => {
    res.json({ message: 'Hello from Node.js!' });
});

// ============================================
// STEP 2: Route with Parameters
// ============================================
app.get('/api/games/:id', (req, res) => {
    const gameId = req.params.id;
    res.json({ 
        message: `You requested game ID: ${gameId}`,
        // In real app: fetch from database
    });
});

// ============================================
// STEP 3: Route with Query Parameters
// ============================================
app.get('/api/search', (req, res) => {
    const query = req.query.q || '';
    res.json({ 
        message: `You searched for: ${query}`,
        // In real app: query database
    });
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

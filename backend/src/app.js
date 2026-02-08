const os = require('os'); // OS specifications
const { Pool } = require('pg'); // PSQL communication
const { loadEnvFile } = require('node:process');
loadEnvFile('../../.envrc');

const PORT = 3000;

let createError = require('http-errors');
let path = require('path');
//var cookieParser = require('cookie-parser');
// var logger = require('morgan');
let cors = require('cors');
let app = require('express');

let userRoutes = require('./routes/user.routes');
let gameRoutes = require('./routes/game.routes');
let recommendRoutes = require('./routes/recommend.routes');
const { SocketAddress } = require('net');

// middleware
app.use(cors(['http://localhost:4200', 'http://localhost:5432'])); // allowed port for communication [angular, psql]
app.use(logger('dev'));
app.use(app.json());
app.use(app.urlencoded({ extended: false }));
app.use(cookieParser());

// API Routes
app.use('/api/user', userRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/recommend', recommendRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    apiKeyConfigured: Boolean(API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
    Backend server is running at: http://localhost:${PORT}
    API Key configured: ${Boolean(API_KEY) ? 'Yes' : 'No'}
  `);
  
});

/* Routines */

let api_key = '';

// Handling user query's for games recommendation
app.post("/query", (req, res) => {
  // Extract query from URL
  let genres = req.query['genres']; // list of specified genres
  let keywords = req.query['keywords']; // string of user's keyword query that needs to be parse
  let os_compat = Boolean(req.query['os_compat']); // only include games compatible with user's system

  // STEP 1: Setup PSQL connection via the UNIX socket
  const pool = new Pool({
    host: provess.env.PGHOST,
    database: provess.env.PGDATABASE,
    user: provess.env.PGUSER
  });

  // STEP 2: Query the database synchronously with the user's query
  const db_result = null;
  if (os_compat) {
    const platform = os.platform();
    console.log(`Filtering compatibility for the following platform: ${platform}`);
  }
  else {
    const platform = 'none';
  }

  try {
    if (platform === 'win32') {
      db_result = pool.query(`
        SELECT game_name, positive_votes 
        FROM steam_collab G
        WHERE G.
        ORDER BY positive_votes DESC 
        LIMIT 5
    `);
    }
    else if (platform === 'darwin') {
      db_result = pool.query(`
        SELECT game_name, positive_votes 
        FROM games 
        ORDER BY positive_votes DESC 
        LIMIT 5
    `);
    }
    else if (platform === 'linux') {
      db_result = pool.query(`
        SELECT game_name, positive_votes 
        FROM games 
        ORDER BY positive_votes DESC 
        LIMIT 5
    `);
    }
    else { // Do not query for game OS compatibility
      db_result = pool.query(`
        SELECT game_name, positive_votes 
        FROM games 
        ORDER BY positive_votes DESC 
        LIMIT 5
    `);
    }

  } catch (err) {
    console.error('Error: Query failed:', err.message);
  }

  // STEP 3: Further processing of the result
  console.log('\n🎮 Top 5 Games:');
  result.rows.forEach((row, i) => {
      console.log(`  ${i+1}. ${row.game_name} (${row.positive_votes.toLocaleString()} votes)`);
  });

  // STEP 4: ...
})

// Logging in with user's Steam API Key
app.post("/login", (req, res) => {
  let 
})
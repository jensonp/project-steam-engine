const os = require('os'); // OS specifications
const { Pool } = require('pg'); // PSQL communication
const { spawn } = require('child_process');
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
app.get("/query", (req, res) => {
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
  const db_result = null; // list of row objects
  if (os_compat) {
    const platform = os.platform();
    console.log(`Filtering compatibility for the following platform: ${platform}`);
  }
  else {
    const platform = 'none';
  }

  try {
    db_result = pool.query(`
        SELECT game_name, price, positive_votes, negative_votes, short_description, long_description, genres, tags, categories
        FROM games G
        WHERE G.genres IN ${genres.join(',')} AND G.long_description LIKE ${keywords}
        ${platform === 'win32' ? 'AND G.windows_support = true' : ''}
        ${platform === 'darwin' ? 'AND G.mac_support = true' : ''}
        ${platform === 'linux' ? 'AND G.linux_support = true' : ''}
        ORDER BY positive_votes DESC
    `);
  } 
  catch (err) {
    console.error('Error: Query failed:', err.message);
  }

  // STEP 3: Further processing of the result
  console.log('\n🎮 Top 5 Games:');
  result.rows.forEach((row, i) => {
      console.log(`  ${i+1}. ${row.game_name} (${row.positive_votes.toLocaleString()} votes)`);
  });

  //Working on the result of the search
  
  //potential code to output the top 5 search, keeping it commented but feel free to test it
  
  /*
  const topResult = result.rows.slice(0,5);

  res.json({
    games: topResult  
  });
  */

  // ...
})

// Logging in with user's Steam API Key
app.post("/login/:id", (req, res) => {
  steamID = req.params.id;

  let apiKey = req.query['apiKey'];

  // Perform user's context indexing
  
})

// Build the index
app.post("/index", (req, res) => {
  // Spawn the python process with the script path and arguments
  const pythonProcess = spawn('python', ['../games_to_db.py']); // trigger python script to import

  // Collect data from the script's standard output
  pythonProcess.stdout.on('data', (data) => {
      dataToSend += data.toString();
  });

  // Handle the child process closing
  pythonProcess.on('close', (code) => {
      console.log(`Child process exited with code ${code}`);
  });

  // Handle potential errors
  pythonProcess.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`);
  });
})
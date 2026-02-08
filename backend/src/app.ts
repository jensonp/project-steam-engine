import userRoutes from './routes/user.routes';
import gameRoutes from './routes/game.routes';
import recommendRoutes from './routes/recommend.routes';
import express from 'express';

const PORT = 3000;
const API_KEY = process.env.STEAM_API_KEY;

var createError = require('http-errors');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');

var indexRouter = require('./routes/index');

var app = express();
app.set('port', PORT);

// middleware
app.use(cors(['http://localhost:4200', 'http://localhost:5432'])); // allowed port for communication [angular, psql]
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// API Routes
app.use('/', indexRouter);
app.use('/api/user', userRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/recommend', recommendRoutes);

// 404 handler
app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Health check endpoint
app.get('/api/health', (req: express.Request, res: express.Response) => {
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
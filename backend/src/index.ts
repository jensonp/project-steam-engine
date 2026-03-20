import express from 'express';
import cors from 'cors';
import { config } from './config';
import userRoutes from './routes/user.routes';
import gameRoutes from './routes/game.routes';
import recommendRoutes from './routes/recommend.routes';
import searchRoutes from './routes/search.routes';

// Validate config
if (!config.port) {
  console.error('FATAL ERROR: PORT is not defined in config.');
  process.exit(1);
}

const app = express();
const PORT = config.port;

import rateLimit from 'express-rate-limit';

// Basic Middleware
app.use(cors());
app.use(express.json());

// Railway (and most managed platforms) sit behind a reverse proxy.
// Express must trust the first proxy hop so middleware relying on client IP
// (like express-rate-limit) behaves correctly.
app.set('trust proxy', 1);

function shouldSkipApiRateLimit(req: express.Request): boolean {
  const forwardedFor = req.headers['x-forwarded-for'];
  const forwarded = Array.isArray(forwardedFor) ? forwardedFor.join(',') : forwardedFor || '';
  const candidate = `${req.ip} ${forwarded}`.toLowerCase();
  return (
    process.env.NODE_ENV !== 'production' ||
    candidate.includes('127.0.0.1') ||
    candidate.includes('::1') ||
    candidate.includes('localhost')
  );
}

// Apply rate limiting to all requests
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { error: 'Too many requests, please try again later.' },
  skip: shouldSkipApiRateLimit,
});

app.use('/api/', limiter);

const healthPayload = () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  apiKeyConfigured: !!config.steamApiKey
});

// Keep root-level health routes for platforms that probe "/" by default.
app.get('/', (_req, res) => {
  res.json(healthPayload());
});

app.get('/health', (_req, res) => {
  res.json(healthPayload());
});

// Routes
app.use('/api/user', userRoutes);
app.use('/api/recommend', recommendRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/search', searchRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json(healthPayload());
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(` Backend server is running at: http://localhost:${PORT} `);
});

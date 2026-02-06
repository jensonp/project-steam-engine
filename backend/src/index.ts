import express from 'express';
import cors from 'cors';
import { config, validateConfig } from './config';
import userRoutes from './routes/user.routes';
import gameRoutes from './routes/game.routes';
import recommendRoutes from './routes/recommend.routes';

// Validate configuration on startup
validateConfig();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    apiKeyConfigured: !!config.steamApiKey,
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/user', userRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/recommend', recommendRoutes);

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
app.listen(config.port, () => {
  console.log(`
    Server running at: http://localhost:${config.port}
    API Key configured: ${config.steamApiKey ? 'Yes' : 'No'}
  `);
});

export default app;

import express from 'express';
import cors from 'cors';
import { config } from './config';
import userRoutes from './routes/user.routes';
import gameRoutes from './routes/game.routes';
import recommendRoutes from './routes/recommend.routes';

const app = express();
const PORT = config.port;

// Middleware
app.use(cors({
  origin: ['http://localhost:4200', 'http://localhost:5432']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// API Routes
app.use('/api/user', userRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/recommend', recommendRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
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
  console.log(`
    Backend server is running at: http://localhost:${PORT}
  `);
});

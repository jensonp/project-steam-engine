import dotenv from 'dotenv';
import path from 'path';

// Explicitly load from src/.env to avoid path issues when running from dist/
dotenv.config({ path: path.join(process.cwd(), 'src', '.env') });
export const config = {
  steamApiKey: process.env.STEAM_API_KEY || '',
  steamApiBaseUrl: 'https://api.steampowered.com',
  steamStoreApiUrl: 'https://store.steampowered.com/api',
  port: parseInt(process.env.PORT || '3000', 10),
  pgHost: process.env.PGHOST || 'localhost',
  pgDatabase: process.env.PGDATABASE || 'steam_collab',
  pgUser: process.env.PGUSER || 'postgres',
  pgPort: parseInt(process.env.PGPORT || '8080', 10),
};

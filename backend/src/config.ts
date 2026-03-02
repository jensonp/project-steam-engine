import dotenv from 'dotenv';
import path from 'path';

// Explicitly load from src/.env to avoid path issues when running from dist/
// Explicitly load from src/.env and store the exact file values
const envConfig = dotenv.config({ path: path.join(process.cwd(), 'src', '.env') }).parsed || {};

export const config = {
  steamApiKey: envConfig.STEAM_API_KEY || process.env.STEAM_API_KEY || '',
  steamApiBaseUrl: 'https://api.steampowered.com',
  steamStoreApiUrl: 'https://store.steampowered.com/api',
  port: parseInt(envConfig.PORT || process.env.PORT || '3000', 10),
  pgHost: envConfig.PGHOST || process.env.PGHOST || 'localhost',
  pgDatabase: envConfig.PGDATABASE || process.env.PGDATABASE || 'steam_collab',
  pgUser: envConfig.PGUSER || process.env.PGUSER || 'postgres',
  pgPort: parseInt(envConfig.PGPORT || process.env.PGPORT || '5432', 10),
  pgPassword: envConfig.PGPASSWORD || process.env.PGPASSWORD || '',
};

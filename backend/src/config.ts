import dotenv from 'dotenv';
import path from 'path';

// Load both the local src/.env and the root monorepo .env so values set at
// either location are available. The src/.env takes precedence if a key appears in both.
const rootEnv  = dotenv.config({ path: path.join(process.cwd(), '..', '.env') }).parsed || {};
const localEnv = dotenv.config({ path: path.join(process.cwd(), 'src', '.env') }).parsed || {};
const envConfig = { ...rootEnv, ...localEnv };

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
  pgConnectionTimeoutMs: parseInt(
    envConfig.PG_CONNECTION_TIMEOUT_MS || process.env.PG_CONNECTION_TIMEOUT_MS || '5000',
    10
  ),
};

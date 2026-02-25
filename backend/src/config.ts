import dotenv from 'dotenv';

dotenv.config();

export const config = {
  steamApiKey: process.env.STEAM_API_KEY || '',
  steamApiBaseUrl: 'https://api.steampowered.com',
  steamStoreApiUrl: 'https://store.steampowered.com/api',
  port: parseInt(process.env.PORT || '3000', 10),
  pgHost: process.env.PGHOST || 'localhost',
  pgDatabase: process.env.PGDATABASE || 'steam_engine',
  pgUser: process.env.PGUSER || 'postgres',
};

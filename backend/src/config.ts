import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  
  // Steam API
  steamApiKey: process.env.STEAM_API_KEY || '',
  steamApiBaseUrl: 'https://api.steampowered.com',
  steamStoreApiUrl: 'https://store.steampowered.com/api',
  
  // Rate limiting
  requestDelayMs: 1000,
};

// Validate required config
export function validateConfig(): void {
  if (!config.steamApiKey) {
    console.warn('WARNING: STEAM_API_KEY not set. API calls will fail.');
    console.warn('Copy .env.example to .env and add your API key.');
  }
}

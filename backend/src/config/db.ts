import { Pool } from 'pg';
import { config } from '../config';

// Create a single shared connection pool for PostgreSQL
export const pool = new Pool({
  host: config.pgHost,
  database: config.pgDatabase,
  user: config.pgUser,
  port: config.pgPort,
});

console.log(`[DB] Initialize connection pool: postgres://${config.pgUser}@${config.pgHost}:${config.pgPort}/${config.pgDatabase}`);

// Generic query helper
export const query = (text: string, params?: any[]) => pool.query(text, params);

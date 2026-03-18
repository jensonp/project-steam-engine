import { Pool, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config';

// Create a single shared connection pool for PostgreSQL
export const pool = new Pool({
  host: config.pgHost,
  password: config.pgPassword,
  database: config.pgDatabase,
  user: config.pgUser,
  port: config.pgPort,
});

console.log(`[DB] Initialize connection pool: postgres://${config.pgUser}@${config.pgHost}:${config.pgPort}/${config.pgDatabase}`);

// Strict Generic query helper mapping exactly to the Promise overload
export const query = <T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> => {
  return pool.query<T>(text, params);
};

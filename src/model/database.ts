import Database, { type Database as SQLiteDatabase } from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { Pool, type PoolClient } from 'pg';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import * as schema from './schema';
import { logger } from '../logger';

export type DrizzleDb = BetterSQLite3Database<typeof schema>;

let sqliteInstance: SQLiteDatabase | null = null;
let drizzleInstance: DrizzleDb | null = null;
let pgPoolInstance: Pool | null = null;

export function isPostgres(): boolean {
  return Boolean(config.databaseUrl && (
    config.databaseUrl.startsWith('postgres://') ||
    config.databaseUrl.startsWith('postgresql://')
  ));
}

export function getPostgresPool(): Pool | null {
  if (!isPostgres()) {
    return null;
  }
  if (!pgPoolInstance) {
    pgPoolInstance = new Pool({
      connectionString: config.databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    pgPoolInstance.on('error', (err) => {
      logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
    });
  }
  return pgPoolInstance;
}

export function initDatabase(dbPath: string = config.dbPath): { sqlite: SQLiteDatabase; db: DrizzleDb } {
  // Close any existing instance
  if (sqliteInstance) {
    sqliteInstance.close();
    sqliteInstance = null;
    drizzleInstance = null;
  }

  const sqlite = new Database(dbPath);

  // Enable foreign keys and WAL mode
  sqlite.pragma('foreign_keys = ON');
  if (dbPath !== ':memory:') {
    sqlite.pragma('journal_mode = WAL');
  }

  // Load and execute schema DDL
  const primarySchemaPath = path.resolve(__dirname, 'schema.sql');
  const fallbackSchemaPath = path.resolve(__dirname, '../../src/model/schema.sql');

  let ddl: string;
  if (fs.existsSync(primarySchemaPath)) {
    ddl = fs.readFileSync(primarySchemaPath, 'utf-8');
  } else if (fs.existsSync(fallbackSchemaPath)) {
    ddl = fs.readFileSync(fallbackSchemaPath, 'utf-8');
  } else {
    ddl = `
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        sku TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS product_cost_history (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        cost REAL NOT NULL CHECK(cost >= 0),
        effective_from TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_cost_history_lookup ON product_cost_history (product_id, effective_from DESC, created_at DESC);
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        order_id TEXT UNIQUE NOT NULL,
        created_at TEXT NOT NULL,
        shipping_cost REAL NOT NULL DEFAULT 0 CHECK(shipping_cost >= 0),
        total_revenue REAL NOT NULL,
        total_cogs REAL NOT NULL,
        total_profit REAL NOT NULL,
        processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        sku TEXT NOT NULL,
        quantity INTEGER NOT NULL CHECK(quantity > 0),
        selling_price REAL NOT NULL CHECK(selling_price >= 0),
        unit_cost REAL NOT NULL CHECK(unit_cost >= 0),
        item_revenue REAL NOT NULL,
        item_cogs REAL NOT NULL,
        item_profit REAL NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
      );
      CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        token TEXT UNIQUE NOT NULL,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked_at TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens (token);
    `;
  }
  sqlite.exec(ddl);

  const db = drizzle(sqlite, { schema });

  sqliteInstance = sqlite;
  drizzleInstance = db;

  return { sqlite, db };
}

export function getDatabase(): DrizzleDb {
  if (!drizzleInstance) {
    const { db } = initDatabase();
    return db;
  }
  return drizzleInstance;
}

export function getSqliteRaw(): SQLiteDatabase {
  if (!sqliteInstance) {
    const { sqlite } = initDatabase();
    return sqlite;
  }
  return sqliteInstance;
}

export function closeDatabase(): void {
  if (sqliteInstance) {
    sqliteInstance.close();
    sqliteInstance = null;
    drizzleInstance = null;
  }
  if (pgPoolInstance) {
    pgPoolInstance.end();
    pgPoolInstance = null;
  }
}

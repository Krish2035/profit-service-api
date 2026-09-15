import { defineConfig } from 'drizzle-kit';
import { config } from './src/config';

export default defineConfig({
  schema: './src/model/schema.ts',
  out: './drizzle',
  dialect: config.databaseUrl ? 'postgresql' : 'sqlite',
  dbCredentials: config.databaseUrl
    ? { url: config.databaseUrl }
    : { url: config.dbPath },
});

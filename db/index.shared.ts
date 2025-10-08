import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import * as schema from './schema';

let sqlite: SQLiteDatabase | undefined;

const globalContext = globalThis as typeof globalThis & {
  navigator?: { product?: string };
  window?: unknown;
};

const canUseSQLite =
  typeof globalContext.window !== 'undefined' ||
  globalContext.navigator?.product === 'ReactNative';

if (canUseSQLite) {
  try {
    const database = openDatabaseSync('frc-redzone-app.db');

    database.execSync('PRAGMA foreign_keys = ON;');

    const createStatements = [
      `CREATE TABLE IF NOT EXISTS teamrecord (
    team_number INTEGER PRIMARY KEY NOT NULL,
    team_name TEXT NOT NULL,
    location TEXT
  );`,
      `CREATE TABLE IF NOT EXISTS frcevent (
    event_key TEXT PRIMARY KEY NOT NULL,
    event_name TEXT NOT NULL,
    short_name TEXT,
    year INTEGER NOT NULL,
    week INTEGER NOT NULL
  );`,
      `CREATE TABLE IF NOT EXISTS season (
    id INTEGER PRIMARY KEY NOT NULL,
    year INTEGER NOT NULL,
    name TEXT NOT NULL
  );`,
      `CREATE TABLE IF NOT EXISTS matchschedule (
    event_key TEXT NOT NULL,
    match_number INTEGER NOT NULL,
    match_level TEXT NOT NULL,
    red1_id INTEGER NOT NULL,
    red2_id INTEGER NOT NULL,
    red3_id INTEGER NOT NULL,
    blue1_id INTEGER NOT NULL,
    blue2_id INTEGER NOT NULL,
    blue3_id INTEGER NOT NULL,
    PRIMARY KEY (event_key, match_number, match_level),
    FOREIGN KEY (event_key) REFERENCES frcevent(event_key),
    FOREIGN KEY (red1_id) REFERENCES teamrecord(team_number),
    FOREIGN KEY (red2_id) REFERENCES teamrecord(team_number),
    FOREIGN KEY (red3_id) REFERENCES teamrecord(team_number),
    FOREIGN KEY (blue1_id) REFERENCES teamrecord(team_number),
    FOREIGN KEY (blue2_id) REFERENCES teamrecord(team_number),
    FOREIGN KEY (blue3_id) REFERENCES teamrecord(team_number)
  );`,
      `CREATE TABLE IF NOT EXISTS teamevent (
    event_key TEXT NOT NULL,
    team_number INTEGER NOT NULL,
    PRIMARY KEY (event_key, team_number),
    FOREIGN KEY (event_key) REFERENCES frcevent(event_key),
    FOREIGN KEY (team_number) REFERENCES teamrecord(team_number)
  );`,
    ];

    for (const statement of createStatements) {
      database.execSync(statement);
    }

    sqlite = database;
  } catch (error) {
    console.warn(
      'expo-sqlite failed to initialize; skipping SQLite setup for this environment.',
      error
    );
  }
}

const drizzleDb = sqlite ? drizzle(sqlite, { schema }) : undefined;

export const db = drizzleDb;

export type Database = NonNullable<typeof drizzleDb>;

export function getDbOrThrow(): Database {
  if (!drizzleDb) {
    throw new Error('SQLite database is not available in this environment.');
  }

  return drizzleDb;
}

export { schema };

import { Platform } from 'react-native';
import localforage from 'localforage';
import { drizzle as drizzleExpo } from 'drizzle-orm/expo-sqlite';
import { drizzle as drizzleLocalforage } from 'drizzle-orm/localforage';
import * as SQLite from 'expo-sqlite/next';

import * as schema from './schema';

const DATABASE_NAME = 'frc-redzone-app';
const STORE_NAME = 'frc_redzone_store';

function initializeLocalforageDb() {
  localforage.config({
    driver: localforage.INDEXEDDB,
    name: DATABASE_NAME,
    storeName: STORE_NAME,
    description: 'IndexedDB store for offline scouting data',
  });

  return drizzleLocalforage(localforage, { schema });
}

function initializeExpoSqliteDb() {
  const database = SQLite.openDatabaseSync(`${DATABASE_NAME}.db`);

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

  return drizzleExpo(database, { schema });
}

type LocalforageDatabase = ReturnType<typeof initializeLocalforageDb>;
type ExpoSqliteDatabase = ReturnType<typeof initializeExpoSqliteDb>;

let drizzleDb: LocalforageDatabase | ExpoSqliteDatabase | undefined;

try {
  if (Platform.OS === 'web') {
    drizzleDb = initializeLocalforageDb();
  } else {
    drizzleDb = initializeExpoSqliteDb();
  }
} catch (error) {
  console.warn('Failed to initialize database; persistence will be unavailable.', error);
}

export const db = drizzleDb;

export type Database = NonNullable<typeof drizzleDb>;

export function getDbOrThrow(): Database {
  if (!drizzleDb) {
    throw new Error('Database is not available in this environment.');
  }

  return drizzleDb;
}

export { schema };

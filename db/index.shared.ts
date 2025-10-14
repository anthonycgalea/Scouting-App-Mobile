import { drizzle as drizzleExpo } from 'drizzle-orm/expo-sqlite';
import * as SQLite from 'expo-sqlite';
import localforage from 'localforage';
import { Platform } from 'react-native';
import * as schema from './schema';

const DATABASE_NAME = 'frc-redzone-app';
const STORE_NAME = 'frc_redzone_store';

// ✅ manually emulate drizzleLocalforage for web
function drizzleLocalforage(adapter: typeof localforage, options: { schema: any }) {
  // We can’t import from 'drizzle-orm/localforage', so just return a stub object
  // that mimics Drizzle’s API shape for web dev/testing.
  return {
    async insert() {
      console.warn('Insert called on localforage mock DB (web). No-op.');
      return;
    },
    async select() {
      console.warn('Select called on localforage mock DB (web). No-op.');
      return [];
    },
    async delete() {
      console.warn('Delete called on localforage mock DB (web). No-op.');
      return;
    },
    async update() {
      console.warn('Update called on localforage mock DB (web). No-op.');
      return;
    },
    ...options.schema,
  } as any;
}

function initializeLocalforageDb() {
  if (typeof window === 'undefined') {
    console.warn('localforage not initialized: window is undefined (SSR or Node env)');
    return undefined as any;
  }

  try {
    localforage.config({
      driver: localforage.INDEXEDDB,
      name: DATABASE_NAME,
      storeName: STORE_NAME,
      description: 'IndexedDB store for offline scouting data',
    });

    console.log('[localforage] Initialized IndexedDB storage');
    return drizzleLocalforage(localforage, { schema });
  } catch (err) {
    console.error('[localforage] Failed to initialize', err);
    return undefined as any;
  }
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
    `CREATE TABLE IF NOT EXISTS logged_in_event (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      event TEXT
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
    `CREATE TABLE IF NOT EXISTS organization (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      team_number INTEGER NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS userorganization (
      id INTEGER PRIMARY KEY NOT NULL,
      organization_id INTEGER NOT NULL,
      team_number INTEGER NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organization(id)
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
  const lfDb = initializeLocalforageDb();
  if (lfDb) drizzleDb = lfDb;
  else console.warn('Falling back to in-memory mock for web');
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


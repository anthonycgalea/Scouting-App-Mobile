import { drizzle as drizzleExpo } from 'drizzle-orm/expo-sqlite';
import * as SQLite from 'expo-sqlite';
import localforage from 'localforage';
import { Platform } from 'react-native';
import * as schema from './schema';

const DATABASE_NAME = 'codystats-app';
const STORE_NAME = 'codystats_store';

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
      team_name TEXT,
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
    `CREATE TABLE IF NOT EXISTS logged_in_organization (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      organization_id INTEGER,
      FOREIGN KEY (organization_id) REFERENCES organization(id)
    );`,
    `CREATE TABLE IF NOT EXISTS userorganization (
      id INTEGER PRIMARY KEY NOT NULL,
      organization_id INTEGER NOT NULL,
      team_number INTEGER NOT NULL,
      role TEXT,
      FOREIGN KEY (organization_id) REFERENCES organization(id)
    );`,
    `CREATE TABLE IF NOT EXISTS picklist (
      id TEXT PRIMARY KEY NOT NULL,
      season INTEGER,
      organization_id INTEGER NOT NULL,
      event_key TEXT,
      title TEXT NOT NULL DEFAULT 'Pick List',
      notes TEXT NOT NULL DEFAULT '',
      created INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      last_updated INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      favorited INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (organization_id) REFERENCES organization(id),
      FOREIGN KEY (event_key) REFERENCES frcevent(event_key)
    );`,
    `CREATE TABLE IF NOT EXISTS picklist_rank (
      picklist_id TEXT NOT NULL,
      rank INTEGER NOT NULL,
      team_number INTEGER NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      dnp INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (picklist_id, rank),
      FOREIGN KEY (picklist_id) REFERENCES picklist(id),
      FOREIGN KEY (team_number) REFERENCES teamrecord(team_number)
    );`,
    `CREATE TABLE IF NOT EXISTS robot_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_key TEXT NOT NULL,
      team_number INTEGER NOT NULL,
      local_uri TEXT NOT NULL,
      remote_url TEXT,
      upload_pending INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (team_number) REFERENCES teamrecord(team_number),
      FOREIGN KEY (event_key) REFERENCES frcevent(event_key)
    );`,
    `CREATE TABLE IF NOT EXISTS pitdata2025 (
      event_key TEXT NOT NULL,
      team_number INTEGER NOT NULL,
      notes TEXT,
      drivetrain TEXT,
      driveteam TEXT,
      auto_notes TEXT,
      tele_notes TEXT,
      overall_notes TEXT,
      robot_weight INTEGER,
      auto_coral_count INTEGER DEFAULT 0,
      auto_algae_net INTEGER DEFAULT 0,
      auto_algae_processor INTEGER DEFAULT 0,
      start_position_left INTEGER NOT NULL DEFAULT 0,
      start_position_center INTEGER NOT NULL DEFAULT 0,
      start_position_right INTEGER NOT NULL DEFAULT 0,
      auto_l4_coral INTEGER NOT NULL DEFAULT 0,
      auto_l3_coral INTEGER NOT NULL DEFAULT 0,
      auto_l2_coral INTEGER NOT NULL DEFAULT 0,
      auto_l1_coral INTEGER NOT NULL DEFAULT 0,
      tele_l4_coral INTEGER NOT NULL DEFAULT 0,
      tele_l3_coral INTEGER NOT NULL DEFAULT 0,
      tele_l2_coral INTEGER NOT NULL DEFAULT 0,
      tele_l1_coral INTEGER NOT NULL DEFAULT 0,
      pickup_ground INTEGER NOT NULL DEFAULT 0,
      pickup_feeder INTEGER NOT NULL DEFAULT 0,
      tele_algae_net INTEGER NOT NULL DEFAULT 0,
      tele_algae_processor INTEGER NOT NULL DEFAULT 0,
      endgame TEXT NOT NULL DEFAULT 'NONE' CHECK (endgame IN ('NONE', 'SHALLOW', 'DEEP')),
      PRIMARY KEY (event_key, team_number),
      FOREIGN KEY (event_key) REFERENCES frcevent(event_key),
      FOREIGN KEY (team_number) REFERENCES teamrecord(team_number)
    );`,
    `CREATE TABLE IF NOT EXISTS matchdata2025 (
      event_key TEXT NOT NULL,
      team_number INTEGER NOT NULL,
      match_number INTEGER NOT NULL,
      match_level TEXT NOT NULL,
      notes TEXT,
      al4c INTEGER NOT NULL DEFAULT 0,
      al3c INTEGER NOT NULL DEFAULT 0,
      al2c INTEGER NOT NULL DEFAULT 0,
      al1c INTEGER NOT NULL DEFAULT 0,
      tl4c INTEGER NOT NULL DEFAULT 0,
      tl3c INTEGER NOT NULL DEFAULT 0,
      tl2c INTEGER NOT NULL DEFAULT 0,
      tl1c INTEGER NOT NULL DEFAULT 0,
      a_processor INTEGER NOT NULL DEFAULT 0,
      t_processor INTEGER NOT NULL DEFAULT 0,
      a_net INTEGER NOT NULL DEFAULT 0,
      t_net INTEGER NOT NULL DEFAULT 0,
      already_uploaded INTEGER NOT NULL DEFAULT 0,
      endgame TEXT NOT NULL DEFAULT 'NONE' CHECK (endgame IN ('NONE', 'PARK', 'SHALLOW', 'DEEP')),
      PRIMARY KEY (event_key, team_number, match_number, match_level),
      FOREIGN KEY (event_key) REFERENCES frcevent(event_key),
      FOREIGN KEY (team_number) REFERENCES teamrecord(team_number)
    );`,
    `CREATE TABLE IF NOT EXISTS already_scouted (
      event_code TEXT NOT NULL,
      team_number INTEGER NOT NULL,
      match_number INTEGER NOT NULL,
      match_level TEXT NOT NULL,
      organization_id INTEGER NOT NULL,
      PRIMARY KEY (event_code, team_number, match_number, match_level, organization_id),
      FOREIGN KEY (event_code) REFERENCES frcevent(event_key),
      FOREIGN KEY (team_number) REFERENCES teamrecord(team_number),
      FOREIGN KEY (organization_id) REFERENCES organization(id)
    );`,
    `CREATE TABLE IF NOT EXISTS already_pit_scouted (
      event_code TEXT NOT NULL,
      team_number INTEGER NOT NULL,
      organization_id INTEGER NOT NULL,
      PRIMARY KEY (event_code, team_number, organization_id),
      FOREIGN KEY (event_code) REFERENCES frcevent(event_key),
      FOREIGN KEY (team_number) REFERENCES teamrecord(team_number),
      FOREIGN KEY (organization_id) REFERENCES organization(id)
    );`,
    `CREATE TABLE IF NOT EXISTS already_super_scouted (
      event_code TEXT NOT NULL,
      match_level TEXT NOT NULL,
      match_number INTEGER NOT NULL,
      alliance TEXT NOT NULL CHECK (alliance IN ('red', 'blue')),
      PRIMARY KEY (event_code, match_level, match_number, alliance),
      FOREIGN KEY (event_code) REFERENCES frcevent(event_key)
    );`,
    `CREATE TABLE IF NOT EXISTS prescoutmatchdata2025 (
      event_key TEXT NOT NULL,
      team_number INTEGER NOT NULL,
      match_number INTEGER NOT NULL,
      match_level TEXT NOT NULL,
      notes TEXT,
      al4c INTEGER NOT NULL DEFAULT 0,
      al3c INTEGER NOT NULL DEFAULT 0,
      al2c INTEGER NOT NULL DEFAULT 0,
      al1c INTEGER NOT NULL DEFAULT 0,
      tl4c INTEGER NOT NULL DEFAULT 0,
      tl3c INTEGER NOT NULL DEFAULT 0,
      tl2c INTEGER NOT NULL DEFAULT 0,
      tl1c INTEGER NOT NULL DEFAULT 0,
      a_processor INTEGER NOT NULL DEFAULT 0,
      t_processor INTEGER NOT NULL DEFAULT 0,
      a_net INTEGER NOT NULL DEFAULT 0,
      t_net INTEGER NOT NULL DEFAULT 0,
      endgame TEXT NOT NULL DEFAULT 'NONE' CHECK (endgame IN ('NONE', 'PARK', 'SHALLOW', 'DEEP')),
      PRIMARY KEY (event_key, team_number, match_number, match_level),
      FOREIGN KEY (event_key) REFERENCES frcevent(event_key),
      FOREIGN KEY (team_number) REFERENCES teamrecord(team_number)
    );`,
    `CREATE TABLE IF NOT EXISTS superscout_field (
      key TEXT PRIMARY KEY NOT NULL,
      label TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS superscout_data (
      event_key TEXT NOT NULL,
      team_number INTEGER NOT NULL,
      match_number INTEGER NOT NULL,
      match_level TEXT NOT NULL,
      alliance TEXT NOT NULL,
      start_position TEXT,
      notes TEXT,
      driver_rating INTEGER NOT NULL DEFAULT 0,
      robot_overall INTEGER NOT NULL DEFAULT 0,
      defense_rating INTEGER,
      submission_pending INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (event_key, team_number, match_number, match_level),
      FOREIGN KEY (event_key) REFERENCES frcevent(event_key),
      FOREIGN KEY (team_number) REFERENCES teamrecord(team_number)
    );`,
    `CREATE TABLE IF NOT EXISTS superscout_selection (
      event_key TEXT NOT NULL,
      team_number INTEGER NOT NULL,
      match_number INTEGER NOT NULL,
      match_level TEXT NOT NULL,
      field_key TEXT NOT NULL,
      PRIMARY KEY (event_key, team_number, match_number, match_level, field_key),
      FOREIGN KEY (event_key) REFERENCES frcevent(event_key),
      FOREIGN KEY (team_number) REFERENCES teamrecord(team_number),
      FOREIGN KEY (field_key) REFERENCES superscout_field(key)
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


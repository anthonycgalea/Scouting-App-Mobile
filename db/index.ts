import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite/next';

import * as schema from './schema';

const sqlite = openDatabaseSync('frc-redzone-app.db');

sqlite.execSync('PRAGMA foreign_keys = ON;');

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
  sqlite.execSync(statement);
}

export const db = drizzle(sqlite, { schema });

export type Database = typeof db;

export { schema };


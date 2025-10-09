import type { SQLiteDatabase } from 'expo-sqlite/next';

/**
 * Creates the schema_version table when it does not exist and seeds it with a
 * default version. This prepares the database for future migration tracking.
 */
export async function initSchemaVersion(db: SQLiteDatabase): Promise<void> {
  // Ensure the schema_version table exists so we can track migration state.
  await db.execAsync(
    'CREATE TABLE IF NOT EXISTS schema_version (version INTEGER);',
  );

  // Count how many rows currently exist so we can seed the default value if needed.
  const existing = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM schema_version;',
  );

  if (!existing || existing.count === 0) {
    // Insert the initial schema version so future migrations know where to start.
    await db.runAsync('INSERT INTO schema_version (version) VALUES (?);', [1]);
  }
}

/**
 * Reads the stored schema version so callers can determine which migrations to run.
 */
export async function getSchemaVersion(db: SQLiteDatabase): Promise<number> {
  // Retrieve the first (and only) version entry. Default to 1 if no value is present.
  const row = await db.getFirstAsync<{ version: number }>(
    'SELECT version FROM schema_version LIMIT 1;',
  );

  return row?.version ?? 1;
}

/**
 * Persists the provided schema version so the next app launch can resume migrations.
 */
export async function setSchemaVersion(
  db: SQLiteDatabase,
  version: number,
): Promise<void> {
  // Replace any existing value with the new version to keep the table normalized.
  await db.execAsync('DELETE FROM schema_version;');
  await db.runAsync('INSERT INTO schema_version (version) VALUES (?);', [version]);
}

// Example usage for initializing and reading the schema version.
// import * as SQLite from 'expo-sqlite/next';
//
// const db = SQLite.openDatabaseSync('app.db');
// await initSchemaVersion(db);
// const current = await getSchemaVersion(db);
// console.log('Current schema version:', current);

import { getDbOrThrow } from './index.shared';

if (typeof window !== 'undefined') {
  try {
    // Force eagerly opening the SQLite database on the client so the Expo WASM
    // worker sets up its persistent backing store (IndexedDB/OPFS) before the
    // rest of the app tries to run queries.
    getDbOrThrow();
  } catch (error) {
    console.warn(
      'SQLite is unavailable on this web build; falling back to in-memory mode.',
      error
    );
  }
}

export * from './index.shared';

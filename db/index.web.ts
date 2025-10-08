import { getDbOrThrow } from './index.shared';

if (typeof window !== 'undefined') {
  try {
    // Force eagerly opening the web database so IndexedDB storage is ready
    // before the rest of the app tries to run queries.
    getDbOrThrow();
  } catch (error) {
    console.warn(
      'IndexedDB is unavailable on this web build; persistence will be disabled.',
      error
    );
  }
}

export * from './index.shared';

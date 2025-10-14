import * as SecureStore from 'expo-secure-store';

export interface AsyncStorageLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const inMemoryStore = new Map<string, string>();
let secureStoreAvailability: Promise<boolean> | null = null;

const isSecureStoreAvailable = (): Promise<boolean> => {
  if (secureStoreAvailability) {
    return secureStoreAvailability;
  }

  if (typeof SecureStore.isAvailableAsync !== 'function') {
    secureStoreAvailability = Promise.resolve(false);
    return secureStoreAvailability;
  }

  secureStoreAvailability = SecureStore.isAvailableAsync().catch((error) => {
    console.warn('[SecureStore] Failed to determine availability:', error);
    return false;
  });

  return secureStoreAvailability;
};

const ExpoSecureStoreAdapter: AsyncStorageLike = {
  async getItem(key) {
    if (!(await isSecureStoreAvailable())) {
      return inMemoryStore.get(key) ?? null;
    }

    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.warn(`[SecureStore] Failed to read key "${key}":`, error);
      return null;
    }
  },
  async setItem(key, value) {
    if (!(await isSecureStoreAvailable())) {
      inMemoryStore.set(key, value);
      return;
    }

    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.warn(`[SecureStore] Failed to write key "${key}":`, error);
    }
  },
  async removeItem(key) {
    if (!(await isSecureStoreAvailable())) {
      inMemoryStore.delete(key);
      return;
    }

    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.warn(`[SecureStore] Failed to delete key "${key}":`, error);
    }
  },
};

export default ExpoSecureStoreAdapter;

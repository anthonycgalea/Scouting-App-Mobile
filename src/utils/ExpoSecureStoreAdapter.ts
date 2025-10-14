import * as SecureStore from 'expo-secure-store';

export interface AsyncStorageLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const ExpoSecureStoreAdapter: AsyncStorageLike = {
  async getItem(key) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.warn(`[SecureStore] Failed to read key "${key}":`, error);
      return null;
    }
  },
  async setItem(key, value) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.warn(`[SecureStore] Failed to write key "${key}":`, error);
    }
  },
  async removeItem(key) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.warn(`[SecureStore] Failed to delete key "${key}":`, error);
    }
  },
};

export default ExpoSecureStoreAdapter;

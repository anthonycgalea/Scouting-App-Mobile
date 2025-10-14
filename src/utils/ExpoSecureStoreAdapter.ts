import type { SupportedStorage } from '@supabase/auth-js';
import {
  deleteItemAsync,
  getItemAsync,
  setItemAsync,
} from 'expo-secure-store';

const ExpoSecureStoreAdapter: SupportedStorage = {
  async getItem(key) {
    try {
      return await getItemAsync(key);
    } catch (error) {
      console.warn(`[SecureStore] Failed to read key "${key}":`, error);
      return null;
    }
  },
  async setItem(key, value) {
    try {
      await setItemAsync(key, value);
    } catch (error) {
      console.warn(`[SecureStore] Failed to write key "${key}":`, error);
    }
  },
  async removeItem(key) {
    try {
      await deleteItemAsync(key);
    } catch (error) {
      console.warn(`[SecureStore] Failed to delete key "${key}":`, error);
    }
  },
};

export default ExpoSecureStoreAdapter;

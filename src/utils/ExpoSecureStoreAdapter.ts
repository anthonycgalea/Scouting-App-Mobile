import type { SupportedStorage } from '@supabase/auth-js';
import * as SecureStore from 'expo-secure-store';

const ExpoSecureStoreAdapter: SupportedStorage = {
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

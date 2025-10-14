import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

import ExpoSecureStoreAdapter from './utils/ExpoSecureStoreAdapter';

const expoConfig = Constants.expoConfig ?? Constants.manifest;
const extra = (expoConfig as typeof expoConfig & { extra?: Record<string, unknown> })?.extra ?? {};

const supabaseUrl =
  (extra?.supabaseUrl as string | undefined) ??
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  '';

const supabaseAnonKey =
  (extra?.supabaseAnonKey as string | undefined) ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase credentials are not configured. Please supply SUPABASE_URL and SUPABASE_ANON_KEY.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export default supabase;

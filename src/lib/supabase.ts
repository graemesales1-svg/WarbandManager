import { createClient, SupabaseClient } from '@supabase/supabase-js';

const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const STORAGE_SUPABASE_CONFIG_KEY = 'bb2_supabase_runtime_config';

export interface RuntimeSupabaseConfig {
  url: string;
  anonKey: string;
}

export function getSavedSupabaseConfig(): RuntimeSupabaseConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_SUPABASE_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as RuntimeSupabaseConfig;
      if (parsed.url && parsed.anonKey) return parsed;
    }
  } catch {
    // ignore storage errors
  }
  if (
    envUrl &&
    envKey &&
    !envUrl.includes('your-project-id') &&
    !envKey.includes('your-supabase-anon')
  ) {
    return { url: envUrl, anonKey: envKey };
  }
  return null;
}

export function saveRuntimeSupabaseConfig(config: RuntimeSupabaseConfig | null): void {
  if (!config || !config.url.trim() || !config.anonKey.trim()) {
    localStorage.removeItem(STORAGE_SUPABASE_CONFIG_KEY);
  } else {
    localStorage.setItem(
      STORAGE_SUPABASE_CONFIG_KEY,
      JSON.stringify({ url: config.url.trim(), anonKey: config.anonKey.trim() })
    );
  }
}

let cachedClient: SupabaseClient | null = null;
let cachedUrl = '';

export function getSupabaseClient(): SupabaseClient | null {
  const cfg = getSavedSupabaseConfig();
  if (!cfg) return null;
  if (cachedClient && cachedUrl === cfg.url) {
    return cachedClient;
  }
  try {
    cachedClient = createClient(cfg.url, cfg.anonKey);
    cachedUrl = cfg.url;
    return cachedClient;
  } catch {
    return null;
  }
}

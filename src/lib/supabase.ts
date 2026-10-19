import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://kcstwlnkjskawgzilere.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtjc3R3bG5ranNrYXdnemlsZXJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0MzA4ODgsImV4cCI6MjEwODAwNjg4OH0.0HFAQKhN92-DzutdsY-IPXgkvnlBK4Tw1LqQD6umUmI';

const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || DEFAULT_SUPABASE_URL;
const envKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || DEFAULT_SUPABASE_ANON_KEY;

const STORAGE_SUPABASE_CONFIG_KEY = 'bb2_supabase_runtime_config';

export interface RuntimeSupabaseConfig {
  url: string;
  anonKey: string;
}

export function normalizeSupabaseUrl(rawUrl: string): string {
  return rawUrl
    .trim()
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/+$/, '');
}

export function getSavedSupabaseConfig(): RuntimeSupabaseConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_SUPABASE_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as RuntimeSupabaseConfig;
      if (parsed.url && parsed.anonKey) {
        return {
          url: normalizeSupabaseUrl(parsed.url),
          anonKey: parsed.anonKey.trim(),
        };
      }
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
    return { url: normalizeSupabaseUrl(envUrl), anonKey: envKey.trim() };
  }
  return null;
}

export function saveRuntimeSupabaseConfig(config: RuntimeSupabaseConfig | null): void {
  if (!config || !config.url.trim() || !config.anonKey.trim()) {
    localStorage.removeItem(STORAGE_SUPABASE_CONFIG_KEY);
  } else {
    localStorage.setItem(
      STORAGE_SUPABASE_CONFIG_KEY,
      JSON.stringify({
        url: normalizeSupabaseUrl(config.url),
        anonKey: config.anonKey.trim(),
      })
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


import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client — real user accounts (register / login / session).
 *
 * Credentials come from environment variables so they're never
 * hardcoded (set them in .env.local for local dev, or in your hosting
 * provider's Environment Variables for deploys — same pattern as the
 * Tencent keys):
 *
 *   VITE_SUPABASE_URL       = https://xxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY  = eyJhbGciOi... (the public "anon" key)
 *
 * Get both from your Supabase project dashboard:
 *   Project Settings → API → Project URL / Project API keys (anon public).
 * The anon key is safe to expose in the browser; Row Level Security on
 * the database is what protects your data.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Only construct a real client when configured; otherwise export null so
// callers can show a clear "not configured" message instead of crashing.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

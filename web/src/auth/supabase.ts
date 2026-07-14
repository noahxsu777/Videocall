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
 *
 * As a fallback we also accept the non-prefixed names created by the
 * Vercel ⇄ Supabase integration (SUPABASE_URL / SUPABASE_ANON_KEY, incl.
 * project-prefixed variants). Those are bridged into __SUPABASE_URL__ /
 * __SUPABASE_ANON_KEY__ at build time by vite.config.ts.
 */
declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON_KEY__: string;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || __SUPABASE_URL__ || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || __SUPABASE_ANON_KEY__ || '';

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

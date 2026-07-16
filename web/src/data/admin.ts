import { supabase } from '../auth/supabase';

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase no está configurado.');
  }
  return supabase;
}

export interface AdminUserRow {
  id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  coins: number;
  call_rate: number;
  vip_until: string | null;
  verified: boolean;
  is_creator: boolean;
  is_admin: boolean;
  banned: boolean;
  created_at: string;
}

/** Whether the given user has admin-panel access. Plain select — the
 *  `profiles` table is readable by everyone, so no RPC is needed just to
 *  check your own flag. Every admin action is re-checked server-side
 *  regardless, so this is only used to decide what the UI shows. */
export async function isAdmin(userId: string): Promise<boolean> {
  const client = requireClient();
  const { data, error } = await client.from('profiles').select('is_admin').eq('id', userId).maybeSingle();
  if (error) {
    console.warn('[admin] isAdmin check failed:', error.message);
    return false;
  }
  return !!(data as any)?.is_admin;
}

/** Full account list (with email) for the admin panel's "Usuarios" tab. */
export async function listAllUsers(): Promise<AdminUserRow[]> {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_list_users');
  if (error) {
    throw new Error(error.message);
  }
  return (data || []) as AdminUserRow[];
}

export async function setBanned(targetId: string, banned: boolean): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc('admin_set_banned', { target_id: targetId, is_banned: banned });
  if (error) {
    throw new Error(error.message);
  }
}

/** Credit (positive) or debit (negative) a user's coin balance. Returns the new balance. */
export async function addCoins(targetId: string, amount: number): Promise<number> {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_add_coins', { target_id: targetId, amount: Math.round(amount) });
  if (error) {
    throw new Error(error.message);
  }
  return data as number;
}

export interface AdminProfilePatch {
  display_name?: string;
  username?: string;
  bio?: string;
  verified?: boolean;
}

export async function adminUpdateProfile(targetId: string, patch: AdminProfilePatch): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc('admin_update_profile', {
    target_id: targetId,
    new_display_name: patch.display_name ?? null,
    new_username: patch.username ?? null,
    new_bio: patch.bio ?? null,
    new_verified: patch.verified ?? null,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export interface VisitorRow {
  ip: string | null;
  user_agent: string | null;
  /** Display name / email if the visitor was logged in; null if anonymous. */
  name: string | null;
  visits: number;
  first_seen: string;
  last_seen: string;
}

/**
 * Visitor IP log for the /sharmin panel — one row per unique IP, with
 * how many times it's been seen and when. Reads the `visitors` table
 * straight from Supabase (no serverless functions — those kept crashing
 * on Vercel). The rows are written by src/data/sessionLog.ts on every
 * app load.
 */
export async function listVisitors(): Promise<VisitorRow[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('visitors')
    .select('ip, user_agent, name, visits, first_seen, last_seen')
    .order('last_seen', { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  return (data || []) as VisitorRow[];
}

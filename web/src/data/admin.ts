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

export interface AdminSessionRow {
  user_id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  ip: string | null;
  user_agent: string | null;
  first_seen: string;
  last_seen: string;
}

/** IP / device log for the /sharmin panel — one row per account, the
 *  last IP + user agent seen when their app last booted. Reads through
 *  the /api/list-visits serverless endpoint (service-role, plain table
 *  read) rather than a Supabase RPC — the RPC route kept getting stuck
 *  in PostgREST's schema cache. */
export async function listAllSessions(): Promise<AdminSessionRow[]> {
  const res = await fetch('/api/list-visits');
  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const body = await res.json();
      message = body?.error || message;
    } catch {
      // response wasn't JSON — keep the status-code message
    }
    throw new Error(message);
  }
  const body = await res.json();
  return (body.sessions || []) as AdminSessionRow[];
}

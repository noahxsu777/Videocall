import { supabase } from '../auth/supabase';

// Live moderation: the host can promote viewers to moderator with
// per-permission toggles (mute chat / kick), and kicked users land on a
// per-live block list that stops them from re-entering. Engine-side
// enforcement (actually muting/kicking through Tencent's room engine) is
// done by the live views; this module only owns the Supabase state.

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase no está configurado.');
  }
  return supabase;
}

export interface ModPerms {
  canMute: boolean;
  canKick: boolean;
}

export interface ModeratorRow {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  can_mute: boolean;
  can_kick: boolean;
}

export interface BlockRow {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface ModTarget {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export async function listModerators(liveId: string): Promise<ModeratorRow[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('live_moderators')
    .select('user_id, name, avatar_url, can_mute, can_kick')
    .eq('live_id', liveId)
    .order('created_at', { ascending: true });
  if (error) {
    console.warn('[moderation] listModerators failed:', error.message);
    return [];
  }
  return (data || []) as ModeratorRow[];
}

export async function getModPerms(liveId: string, userId: string): Promise<ModPerms | null> {
  const client = requireClient();
  const { data, error } = await client
    .from('live_moderators')
    .select('can_mute, can_kick')
    .eq('live_id', liveId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return { canMute: !!(data as any).can_mute, canKick: !!(data as any).can_kick };
}

export async function setModerator(
  liveId: string,
  target: ModTarget,
  perms: ModPerms,
  grantedBy: string,
): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('live_moderators').upsert({
    live_id: liveId,
    user_id: target.id,
    granted_by: grantedBy,
    name: target.name,
    avatar_url: target.avatarUrl,
    can_mute: perms.canMute,
    can_kick: perms.canKick,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function removeModerator(liveId: string, userId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from('live_moderators')
    .delete()
    .eq('live_id', liveId)
    .eq('user_id', userId);
  if (error) {
    throw new Error(error.message);
  }
}

export async function listBlocked(liveId: string): Promise<BlockRow[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('live_blocks')
    .select('user_id, name, avatar_url, created_at')
    .eq('live_id', liveId)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[moderation] listBlocked failed:', error.message);
    return [];
  }
  return (data || []) as BlockRow[];
}

export async function blockUser(liveId: string, target: ModTarget, blockedBy: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('live_blocks').upsert({
    live_id: liveId,
    user_id: target.id,
    blocked_by: blockedBy,
    name: target.name,
    avatar_url: target.avatarUrl,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function unblockUser(liveId: string, userId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from('live_blocks')
    .delete()
    .eq('live_id', liveId)
    .eq('user_id', userId);
  if (error) {
    throw new Error(error.message);
  }
}

export async function isBlocked(liveId: string, userId: string): Promise<boolean> {
  const client = requireClient();
  const { data, error } = await client
    .from('live_blocks')
    .select('user_id')
    .eq('live_id', liveId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    return false;
  }
  return !!data;
}

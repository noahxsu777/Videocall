import { supabase } from '../auth/supabase';

export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  name_updated_at?: string | null;
  created_at?: string;
}

/** The display name (a.k.a. username) can only be changed this often. */
export const NAME_CHANGE_DAYS = 30;

/** Days remaining before the name can be changed again (0 = allowed now). */
export function daysUntilNameChange(nameUpdatedAt?: string | null): number {
  if (!nameUpdatedAt) {
    return 0;
  }
  const nextAllowed = new Date(nameUpdatedAt).getTime() + NAME_CHANGE_DAYS * 86400000;
  const diff = nextAllowed - Date.now();
  return diff <= 0 ? 0 : Math.ceil(diff / 86400000);
}

export interface Photo {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
}

const STORAGE_BUCKET = 'media';

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase no está configurado.');
  }
  return supabase;
}

/** Fetch a single profile by user id. Returns null if not found. */
export async function getProfile(userId: string): Promise<Profile | null> {
  const client = requireClient();
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[profiles] getProfile failed:', error.message);
    return null;
  }
  return data as Profile | null;
}

/**
 * Make sure a profile row exists for the current user (the DB trigger
 * normally creates it on sign-up, but this is a safe fallback e.g. for
 * accounts created before the trigger existed).
 */
export async function ensureProfile(userId: string, displayName: string): Promise<void> {
  const client = requireClient();
  const existing = await getProfile(userId);
  if (existing) {
    return;
  }
  const { error } = await client.from('profiles').insert({
    id: userId,
    display_name: displayName,
    username: displayName,
  });
  if (error) {
    console.warn('[profiles] ensureProfile failed:', error.message);
  }
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, 'display_name' | 'bio' | 'avatar_url' | 'username'>>,
): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('profiles').update(patch).eq('id', userId);
  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Change the user's shown name (the "username" that appears in lives and
 * on the profile). Stamps name_updated_at so the 30-day limit can be
 * enforced, and best-effort keeps the unique @handle in sync.
 */
export async function updateDisplayName(userId: string, name: string): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from('profiles')
    .update({ display_name: name, name_updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) {
    throw new Error(error.message);
  }
  // Keep the unique @handle aligned when possible; ignore clashes so a
  // taken handle never blocks the visible name from updating.
  await client.from('profiles').update({ username: name }).eq('id', userId);
}

export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const client = requireClient();
  const [{ count: followers }, { count: following }] = await Promise.all([
    client.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
    client.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
  ]);
  return { followers: followers || 0, following: following || 0 };
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const client = requireClient();
  const { data } = await client
    .from('follows')
    .select('follower_id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle();
  return !!data;
}

export async function follow(followerId: string, followingId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('follows').insert({
    follower_id: followerId,
    following_id: followingId,
  });
  if (error && !error.message.includes('duplicate')) {
    throw new Error(error.message);
  }
}

export async function unfollow(followerId: string, followingId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);
  if (error) {
    throw new Error(error.message);
  }
}

/** Upload a File to Storage and return its public URL. */
export async function uploadMedia(userId: string, file: File): Promise<string> {
  const client = requireClient();
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await client.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) {
    throw new Error(error.message);
  }
  const { data } = client.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function listPhotos(userId: string): Promise<Photo[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('photos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[profiles] listPhotos failed:', error.message);
    return [];
  }
  return (data || []) as Photo[];
}

export async function addPhoto(userId: string, imageUrl: string, caption = ''): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('photos').insert({
    user_id: userId,
    image_url: imageUrl,
    caption,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function deletePhoto(photoId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('photos').delete().eq('id', photoId);
  if (error) {
    throw new Error(error.message);
  }
}

import { supabase } from '../auth/supabase';

export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  name_updated_at?: string | null;
  vip_until?: string | null;
  coins?: number;
  call_rate?: number;
  /** Twitter-style checkmark. Only settable by the project owner directly
   *  in Supabase (see the protect_verified_column trigger) — never via
   *  the app's own updateProfile(). */
  verified?: boolean;
  created_at?: string;
}

/** True if the profile has an active VIP subscription right now. */
export function isVipActive(vipUntil?: string | null): boolean {
  if (!vipUntil) {
    return false;
  }
  return new Date(vipUntil).getTime() > Date.now();
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
  media_type?: 'image' | 'video';
  created_at: string;
}

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

/**
 * Turn a picked image File into a compressed data URL — stored directly in
 * the DB (profiles.avatar_url / photos.image_url). This means uploads work
 * with ZERO Supabase Storage setup (no "media" bucket needed). Images are
 * downscaled + JPEG-compressed on the client so the strings stay small.
 */
export async function uploadMedia(
  userId: string,
  file: File,
  maxSize = 1280,
  quality = 0.72,
): Promise<string> {
  return compressImageToDataUrl(file, maxSize, quality);
}

function compressImageToDataUrl(file: File, maxSize: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('El archivo debe ser una imagen.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width >= height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > width && height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas no disponible.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Imagen inválida.'));
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
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

export async function addPhoto(
  userId: string,
  imageUrl: string,
  caption = '',
  mediaType: 'image' | 'video' = 'image',
): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('photos').insert({
    user_id: userId,
    image_url: imageUrl,
    caption,
    media_type: mediaType,
  });
  if (error) {
    throw new Error(error.message);
  }
}

const REELS_VIDEO_BUCKET = 'reels-videos';
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB

/**
 * Upload a video File to Storage and return its public URL. Unlike
 * photos (compressed client-side into a small data URL and stored
 * inline), videos are too large for that — they need the
 * "reels-videos" Storage bucket (public, no RLS policies required).
 */
export async function uploadVideo(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith('video/')) {
    throw new Error('El archivo debe ser un video.');
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error('El video pesa demasiado (máximo 50MB).');
  }
  const client = requireClient();
  const ext = file.name.split('.').pop() || 'mp4';
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await client.storage.from(REELS_VIDEO_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });
  if (error) {
    throw new Error(
      error.message.includes('not found')
        ? 'Falta crear el bucket "reels-videos" en Supabase Storage (público).'
        : error.message,
    );
  }
  const { data } = client.storage.from(REELS_VIDEO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deletePhoto(photoId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('photos').delete().eq('id', photoId);
  if (error) {
    throw new Error(error.message);
  }
}

/** A photo plus its author, for the global Reels feed. */
export interface FeedPhoto extends Photo {
  author: Pick<Profile, 'id' | 'display_name' | 'username' | 'avatar_url' | 'verified'> | null;
}

/** All recent photos across users (newest first) with author info. */
export async function listFeedPhotos(limit = 60): Promise<FeedPhoto[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('photos')
    .select('*, author:profiles(id, display_name, username, avatar_url, verified)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[profiles] listFeedPhotos failed:', error.message);
    return [];
  }
  return (data || []) as FeedPhoto[];
}

// ---------- likes & comments (reels) ----------

export interface PhotoComment {
  id: string;
  photo_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author?: Pick<Profile, 'id' | 'display_name' | 'username' | 'avatar_url' | 'verified'> | null;
}

/** Like + comment counts for a set of photos, in two batched queries. */
export async function getPhotoStats(
  photoIds: string[],
): Promise<Record<string, { likes: number; comments: number }>> {
  const client = requireClient();
  const stats: Record<string, { likes: number; comments: number }> = {};
  for (const id of photoIds) {
    stats[id] = { likes: 0, comments: 0 };
  }
  if (!photoIds.length) {
    return stats;
  }
  const [{ data: likes }, { data: comments }] = await Promise.all([
    client.from('likes').select('photo_id').in('photo_id', photoIds),
    client.from('comments').select('photo_id').in('photo_id', photoIds),
  ]);
  for (const row of (likes || []) as { photo_id: string }[]) {
    stats[row.photo_id].likes += 1;
  }
  for (const row of (comments || []) as { photo_id: string }[]) {
    stats[row.photo_id].comments += 1;
  }
  return stats;
}

/** Which of these photos has the user already liked? */
export async function myLikedPhotoIds(userId: string, photoIds: string[]): Promise<Set<string>> {
  const client = requireClient();
  if (!photoIds.length) {
    return new Set();
  }
  const { data } = await client
    .from('likes')
    .select('photo_id')
    .eq('user_id', userId)
    .in('photo_id', photoIds);
  return new Set(((data || []) as { photo_id: string }[]).map(r => r.photo_id));
}

export async function likePhoto(userId: string, photoId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('likes').insert({ user_id: userId, photo_id: photoId });
  if (error && !error.message.includes('duplicate')) {
    throw new Error(error.message);
  }
}

export async function unlikePhoto(userId: string, photoId: string): Promise<void> {
  const client = requireClient();
  await client.from('likes').delete().eq('user_id', userId).eq('photo_id', photoId);
}

export async function listComments(photoId: string): Promise<PhotoComment[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('comments')
    .select('*, author:profiles(id, display_name, username, avatar_url, verified)')
    .eq('photo_id', photoId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) {
    console.warn('[profiles] listComments failed:', error.message);
    return [];
  }
  return (data || []) as PhotoComment[];
}

export async function addComment(
  userId: string,
  photoId: string,
  content: string,
): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from('comments')
    .insert({ user_id: userId, photo_id: photoId, content });
  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Activate (or extend) a VIP subscription. Simulated purchase — no real
 * payment gateway is wired yet, so this just extends vip_until by the
 * chosen number of days from now (or from the current expiry if still
 * active).
 */
export async function activateVip(userId: string, days: number): Promise<string> {
  const client = requireClient();
  const current = await getProfile(userId);
  const base =
    current?.vip_until && new Date(current.vip_until).getTime() > Date.now()
      ? new Date(current.vip_until).getTime()
      : Date.now();
  const until = new Date(base + days * 86400000).toISOString();
  const { error } = await client.from('profiles').update({ vip_until: until }).eq('id', userId);
  if (error) {
    throw new Error(error.message);
  }
  return until;
}

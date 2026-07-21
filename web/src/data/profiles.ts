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
  /** Twitter-style checkmark. Can't be set via updateProfile() — the
   *  protect_privileged_columns trigger blocks direct writes to it. The
   *  only legitimate way to grant it (besides you editing it by hand in
   *  Supabase) is purchaseVerification() below. */
  verified?: boolean;
  /** Purely cosmetic "Creator" badge — see becomeCreator() below. Doesn't
   *  gate anything: any account can already start a live without it. */
  is_creator?: boolean;
  /** Grants access to /admin. Same self-service block as `verified` —
   *  only settable by hand in Supabase (there's no purchase path for
   *  this one, on purpose). */
  is_admin?: boolean;
  /** Blocks login when true (enforced in auth/useAuth.ts). Only settable
   *  through the admin_set_banned() RPC — see data/admin.ts. */
  banned?: boolean;
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

/**
 * "HDR+" look, applied in-place to a canvas of the (already downscaled)
 * image: an S-curve contrast boost, a shadow lift, and a vibrance bump so
 * uploaded photos come out punchy and vivid like a phone's HDR mode —
 * while still being JPEG-compressed. Runs one pass over the pixels; skips
 * silently (leaving the plain image) if the browser blocks getImageData.
 */
function applyHdrPlus(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  try {
    const image = ctx.getImageData(0, 0, width, height);
    const d = image.data;
    const contrast = 1.14; // >1 deepens darks / brightens lights
    const sat = 1.2; // vibrance / color pop
    const gamma = 1 / 1.06; // gentle shadow/midtone lift
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i] / 255;
      let g = d[i + 1] / 255;
      let b = d[i + 2] / 255;
      // S-curve contrast around mid-grey.
      r = (r - 0.5) * contrast + 0.5;
      g = (g - 0.5) * contrast + 0.5;
      b = (b - 0.5) * contrast + 0.5;
      // Shadow/midtone lift.
      r = Math.pow(Math.max(0, r), gamma);
      g = Math.pow(Math.max(0, g), gamma);
      b = Math.pow(Math.max(0, b), gamma);
      // Saturation around perceived luma.
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = luma + (r - luma) * sat;
      g = luma + (g - luma) * sat;
      b = luma + (b - luma) * sat;
      d[i] = Math.max(0, Math.min(255, r * 255));
      d[i + 1] = Math.max(0, Math.min(255, g * 255));
      d[i + 2] = Math.max(0, Math.min(255, b * 255));
    }
    ctx.putImageData(image, 0, 0);
  } catch {
    // Tainted canvas / blocked pixel access — keep the un-enhanced image.
  }
}

function fitDimensions(w: number, h: number, maxSize: number): [number, number] {
  if (w >= h && w > maxSize) {
    return [maxSize, Math.round((h * maxSize) / w)];
  }
  if (h > w && h > maxSize) {
    return [Math.round((w * maxSize) / h), maxSize];
  }
  return [w, h];
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
        const [width, height] = fitDimensions(img.width, img.height, maxSize);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas no disponible.'));
          return;
        }
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        applyHdrPlus(ctx, width, height);
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

/**
 * Guarantee the user's avatar is a real http(s) URL (which Tencent's
 * setSelfInfo accepts) and return it. If the stored avatar is a legacy
 * data: URL — which Tencent rejects, so the user showed the default
 * silhouette — this uploads it to Storage, persists the resulting public
 * URL back onto the profile + auth metadata (so it's done once), and
 * returns it. Returns '' only when there is genuinely no avatar.
 */
export async function ensureRealAvatarUrl(userId: string): Promise<string> {
  const client = requireClient();
  let avatarUrl = '';
  try {
    const p = await getProfile(userId);
    avatarUrl = p?.avatar_url || '';
  } catch {
    return '';
  }
  if (!avatarUrl) {
    return '';
  }
  if (!avatarUrl.startsWith('data:')) {
    return avatarUrl; // already a real URL
  }
  // Legacy inline data URL → upload to Storage for a short, real URL.
  try {
    const blob = await (await fetch(avatarUrl)).blob();
    const path = `avatars/${userId}/${Date.now()}.jpg`;
    const { error } = await client.storage.from(REELS_VIDEO_BUCKET).upload(path, blob, {
      cacheControl: '3600',
      upsert: false,
      contentType: blob.type || 'image/jpeg',
    });
    if (error) {
      return '';
    }
    const { data } = client.storage.from(REELS_VIDEO_BUCKET).getPublicUrl(path);
    const publicUrl = data.publicUrl;
    try {
      await updateProfile(userId, { avatar_url: publicUrl });
    } catch {
      // best-effort
    }
    try {
      await client.auth.updateUser({ data: { avatar_url: publicUrl } });
    } catch {
      // best-effort
    }
    return publicUrl;
  } catch {
    return '';
  }
}

/**
 * Credit the Coins a creator earned from a received gift straight onto
 * their coin balance (single-currency model: gifts pay out in the same
 * Coins users buy, so withdrawal is direct). Server-side RPC keyed to
 * auth.uid() so nobody can credit someone else. Best-effort: logs and
 * continues if the migration hasn't been run yet.
 */
export async function addEarnedCoins(amount: number): Promise<void> {
  if (!amount || amount <= 0) {
    return;
  }
  try {
    const client = requireClient();
    const { error } = await client.rpc('add_earned_coins', { amount: Math.round(amount) });
    if (error) {
      console.warn('[profiles] add_earned_coins failed (¿falta la migración SQL?):', error.message);
    }
  } catch (error) {
    console.warn('[profiles] addEarnedCoins failed:', error);
  }
}

/** A colored initials avatar (real http URL) from a display name. */
export function initialsAvatarUrl(name: string): string {
  const n = encodeURIComponent((name || 'User').trim().slice(0, 24) || 'User');
  return `https://ui-avatars.com/api/?name=${n}&background=8b3dff&color=ffffff&bold=true&size=256`;
}

/**
 * The best avatar URL to push to Tencent's setSelfInfo for this user: their
 * real photo (migrating a legacy data: URL to Storage if needed), or a
 * colored initials avatar as a fallback. Guaranteed to be a real http(s)
 * URL Tencent accepts — never empty and never a data: URL, so every place
 * that calls setSelfInfo shows a picture in the live / audience list.
 */
export async function resolveTencentAvatar(userId: string, name: string): Promise<string> {
  try {
    const real = await ensureRealAvatarUrl(userId);
    if (real && !real.startsWith('data:')) {
      return real;
    }
  } catch {
    // fall through to initials
  }
  return initialsAvatarUrl(name);
}

/**
 * Compress + upload a live-cover image and return its public URL. The
 * cover is passed to Tencent's startLive({ coverUrl }) and shown in the
 * live list, so it must be a short URL (a big data URL would be rejected
 * by the room metadata) — hence Storage, not an inline data URL. Reuses
 * the public "reels-videos" bucket under a covers/ path so there's no
 * extra bucket to create.
 */
export async function uploadCover(userId: string, file: File): Promise<string> {
  return uploadImageToBucket(userId, file, 'covers', 720);
}

/**
 * Upload an avatar and return its public URL. Unlike the rest of the
 * app's avatars (compressed to inline data URLs), the live/co-host view
 * pushes this to Tencent's setSelfInfo({ avatarUrl }), which needs a
 * short real URL — a long data URL gets rejected/truncated and the user
 * shows up as the default silhouette. So avatars for the live go through
 * Storage too.
 */
export async function uploadAvatarImage(userId: string, file: File): Promise<string> {
  return uploadImageToBucket(userId, file, 'avatars', 256);
}

/** Upload a chat photo (DMs) and return its public URL. */
export async function uploadChatImage(userId: string, file: File): Promise<string> {
  return uploadImageToBucket(userId, file, 'chat', 1080);
}

async function uploadImageToBucket(
  userId: string,
  file: File,
  folder: string,
  maxSize: number,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo debe ser una imagen.');
  }
  const blob = await compressImageToBlob(file, maxSize, 0.8);
  const client = requireClient();
  const path = `${folder}/${userId}/${Date.now()}.jpg`;
  const { error } = await client.storage.from(REELS_VIDEO_BUCKET).upload(path, blob, {
    cacheControl: '3600',
    upsert: false,
    contentType: 'image/jpeg',
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

function compressImageToBlob(file: File, maxSize: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const [width, height] = fitDimensions(img.width, img.height, maxSize);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas no disponible.'));
          return;
        }
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        applyHdrPlus(ctx, width, height);
        canvas.toBlob(
          blob => (blob ? resolve(blob) : reject(new Error('No se pudo procesar la imagen.'))),
          'image/jpeg',
          quality,
        );
      };
      img.onerror = () => reject(new Error('Imagen inválida.'));
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
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
/**
 * Fetch the author profiles for a set of user ids as a map. Kept separate
 * from the photos/comments queries on purpose: an embedded PostgREST join
 * (`author:profiles(...)`) makes the WHOLE query fail if anything about
 * the relationship or a selected column hiccups (e.g. the `verified`
 * column not migrated yet), which emptied the entire Reels feed. Fetching
 * authors on their own — with a retry that drops `verified` — means the
 * feed always loads even when author enrichment can't.
 */
async function fetchAuthorsMap(userIds: string[]): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  const client = requireClient();
  const ids = [...new Set(userIds)].filter(Boolean);
  if (!ids.length) {
    return map;
  }
  let res = await client
    .from('profiles')
    .select('id, display_name, username, avatar_url, verified')
    .in('id', ids);
  if (res.error) {
    // Retry without `verified` in case that column isn't migrated yet.
    res = await client
      .from('profiles')
      .select('id, display_name, username, avatar_url')
      .in('id', ids);
  }
  for (const a of (res.data || []) as any[]) {
    map.set(a.id, a);
  }
  return map;
}

export async function listFeedPhotos(limit = 60): Promise<FeedPhoto[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('photos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[profiles] listFeedPhotos failed:', error.message);
    return [];
  }
  const photos = (data || []) as any[];
  const authors = await fetchAuthorsMap(photos.map(p => p.user_id));
  return photos.map(p => ({ ...p, author: authors.get(p.user_id) || null })) as FeedPhoto[];
}

/** The ids of everyone this user follows. */
export async function listFollowingIds(userId: string): Promise<string[]> {
  const client = requireClient();
  const { data } = await client
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);
  return ((data || []) as { following_id: string }[]).map(r => r.following_id);
}

/** Reels/photos ONLY from the people this user follows ("Seguidos" tab). */
export async function listFollowingFeed(userId: string, limit = 60): Promise<FeedPhoto[]> {
  const client = requireClient();
  const ids = await listFollowingIds(userId);
  if (!ids.length) {
    return [];
  }
  const { data, error } = await client
    .from('photos')
    .select('*')
    .in('user_id', ids)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[profiles] listFollowingFeed failed:', error.message);
    return [];
  }
  const photos = (data || []) as any[];
  const authors = await fetchAuthorsMap(photos.map(p => p.user_id));
  return photos.map(p => ({ ...p, author: authors.get(p.user_id) || null })) as FeedPhoto[];
}

/**
 * A lightweight "taste profile" for the For You algorithm: which posts the
 * user has already liked, and how strongly they lean toward each creator
 * (based on how many of that creator's posts they've liked). Bounded to the
 * user's most recent likes so it stays a small, fast query.
 */
export async function getTasteProfile(
  userId: string,
): Promise<{ likedPhotoIds: Set<string>; authorAffinity: Record<string, number> }> {
  const client = requireClient();
  const { data: likeRows } = await client
    .from('likes')
    .select('photo_id')
    .eq('user_id', userId)
    .limit(300);
  const likedPhotoIds = new Set(((likeRows || []) as { photo_id: string }[]).map(r => r.photo_id));
  const authorAffinity: Record<string, number> = {};
  if (likedPhotoIds.size) {
    const { data: likedPhotos } = await client
      .from('photos')
      .select('id,user_id')
      .in('id', Array.from(likedPhotoIds));
    for (const row of (likedPhotos || []) as { id: string; user_id: string }[]) {
      authorAffinity[row.user_id] = (authorAffinity[row.user_id] || 0) + 1;
    }
  }
  return { likedPhotoIds, authorAffinity };
}

/** Fetch a single reel/photo by id (with its author) — used to open a
 *  shared deep link even when the post isn't in the recent feed. */
export async function getFeedPhoto(id: string): Promise<FeedPhoto | null> {
  const client = requireClient();
  const { data, error } = await client.from('photos').select('*').eq('id', id).maybeSingle();
  if (error || !data) {
    return null;
  }
  const photo = data as any;
  const authors = await fetchAuthorsMap([photo.user_id]);
  return { ...photo, author: authors.get(photo.user_id) || null } as FeedPhoto;
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
    .select('*')
    .eq('photo_id', photoId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) {
    console.warn('[profiles] listComments failed:', error.message);
    return [];
  }
  const comments = (data || []) as any[];
  const authors = await fetchAuthorsMap(comments.map(c => c.user_id));
  return comments.map(c => ({ ...c, author: authors.get(c.user_id) || null })) as PhotoComment[];
}

export async function addComment(
  userId: string,
  photoId: string,
  content: string,
  meta?: { ownerId?: string; senderName?: string; senderAvatar?: string | null },
): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from('comments')
    .insert({ user_id: userId, photo_id: photoId, content });
  if (error) {
    throw new Error(error.message);
  }
  // Notify the post owner (native push) — best-effort, skips self-comments.
  if (meta?.ownerId && meta.ownerId !== userId) {
    void sendCommentPushNotification(meta.ownerId, userId, content, photoId, meta);
  }
}

async function sendCommentPushNotification(
  ownerId: string,
  senderId: string,
  content: string,
  photoId: string,
  meta: { senderName?: string; senderAvatar?: string | null },
): Promise<void> {
  try {
    const client = requireClient();
    const { data } = await client.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      return;
    }
    await fetch('/api/notify-comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        ownerId,
        senderId,
        senderName: meta.senderName || '',
        senderAvatar: meta.senderAvatar || null,
        preview: content,
        photoId,
      }),
    });
  } catch (error) {
    console.warn('[profiles] comment push failed:', error);
  }
}

/** Fire a native push to a creator's followers that they've gone live. */
export async function notifyLiveStarted(
  streamerId: string,
  info: { name?: string; avatar?: string | null; liveId?: string; message?: string },
): Promise<void> {
  try {
    const client = requireClient();
    const { data } = await client.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      return;
    }
    await fetch('/api/notify-live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        streamerId,
        streamerName: info.name || '',
        streamerAvatar: info.avatar || null,
        liveId: info.liveId || null,
        message: info.message || '',
      }),
    });
  } catch (error) {
    console.warn('[profiles] live push failed:', error);
  }
}

/**
 * Delete a comment. Allowed for the comment's author OR the owner of the
 * reel it's on (see the "delete comments" RLS policy in schema.sql — the
 * database enforces this, so a plain delete just fails for anyone else).
 */
export async function deleteComment(commentId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('comments').delete().eq('id', commentId);
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

/** Coins needed to self-purchase the verified badge (see purchaseVerification). */
export const VERIFIED_PRICE_COINS = 5000;

/**
 * Self-purchase the Twitter-style verified badge with coins. Goes through
 * the purchase_verification() RPC (a security-definer function) because
 * the profiles table itself rejects any direct update to `verified` made
 * with a logged-in session — this is the only path that's allowed
 * through. Throws 'insufficient_coins' or 'already_verified' on failure.
 * Returns the buyer's new coin balance on success.
 */
export async function purchaseVerification(): Promise<number> {
  const client = requireClient();
  const { data, error } = await client.rpc('purchase_verification');
  if (error) {
    throw new Error(error.message);
  }
  return data as number;
}

/**
 * Request the verified badge by application (the current flow — not paid
 * with coins). Flags the user's profile as having requested verification;
 * you approve/reject it from the /sharmin panel.
 */
export async function requestVerification(note?: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc('request_verification', { note: note || null });
  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Turns on the (purely cosmetic) Creator badge for this account. Unlike
 * `verified`/`is_admin`, `is_creator` isn't a protected column and isn't
 * gating anything today — every account can already open /live-pusher
 * and go live with zero approval. This just flips a flag so the badge
 * can show up on the profile later.
 */
export async function becomeCreator(userId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('profiles').update({ is_creator: true }).eq('id', userId);
  if (error) {
    throw new Error(error.message);
  }
}

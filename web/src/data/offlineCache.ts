// Tiny localStorage-backed cache so key screens (conversation list, a
// chat thread) can still show the last known data when offline —
// Supabase itself has no offline story, so this is done at the app
// level. Namespaced per user id so a shared device never mixes accounts.
const PREFIX = 'hypecall_cache_v1_';

interface CacheEntry<T> {
  data: T;
  savedAt: number;
}

export function saveCache<T>(userId: string, key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, savedAt: Date.now() };
    localStorage.setItem(`${PREFIX}${userId}_${key}`, JSON.stringify(entry));
  } catch (error) {
    // Storage full/unavailable (private browsing, quota) — best-effort only.
    console.warn('[offlineCache] save failed:', error);
  }
}

export function loadCache<T>(userId: string, key: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}${userId}_${key}`);
    return raw ? (JSON.parse(raw) as CacheEntry<T>) : null;
  } catch {
    return null;
  }
}

export const isOnline = () => typeof navigator === 'undefined' || navigator.onLine;

/**
 * Stale-while-revalidate: paint the last cached value INSTANTLY (so a
 * screen never shows a blank/spinner on a repeat visit), then fetch fresh
 * data in the background and repaint + re-cache when it arrives.
 *
 * `apply` is called synchronously with the cached value first (if any),
 * then again with the fresh value once the network resolves. On a network
 * error we keep whatever was cached instead of blowing up. The cache read
 * runs before the first await, so the instant paint is truly synchronous.
 */
export async function swr<T>(
  userId: string,
  key: string,
  fetcher: () => Promise<T>,
  apply: (data: T, fromCache: boolean) => void,
): Promise<T | null> {
  const cached = loadCache<T>(userId, key);
  if (cached) {
    apply(cached.data, true);
  }
  try {
    const fresh = await fetcher();
    saveCache(userId, key, fresh);
    apply(fresh, false);
    return fresh;
  } catch (error) {
    if (cached) {
      return cached.data; // offline / failed — the cached paint stands
    }
    throw error;
  }
}

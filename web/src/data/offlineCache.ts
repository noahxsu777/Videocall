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

// Per-live session records for the Estadísticas screen: hours streamed,
// coins earned, viewers — written by the host when a live ends.
import { supabase } from '../auth/supabase';

export interface LiveSession {
  id: string;
  duration_seconds: number;
  coins_earned: number;
  viewers: number;
  created_at: string;
}

/** Record a finished live (best-effort; needs the live_sessions table). */
export async function recordLiveSession(
  durationSeconds: number,
  coinsEarned: number,
  viewers: number,
): Promise<void> {
  try {
    const { data } = await supabase!.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) {
      return;
    }
    const { error } = await supabase!.from('live_sessions').insert({
      user_id: userId,
      duration_seconds: Math.max(0, Math.round(durationSeconds)),
      coins_earned: Math.max(0, Math.round(coinsEarned)),
      viewers: Math.max(0, Math.round(viewers)),
    });
    if (error) {
      console.warn('[stats] recordLiveSession failed (¿falta la tabla live_sessions?):', error.message);
    }
  } catch (error) {
    console.warn('[stats] recordLiveSession failed:', error);
  }
}

/** All of this creator's live sessions, newest first. */
export async function listLiveSessions(userId: string): Promise<LiveSession[]> {
  const { data, error } = await supabase!
    .from('live_sessions')
    .select('id, duration_seconds, coins_earned, viewers, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    console.warn('[stats] listLiveSessions failed:', error.message);
    return [];
  }
  return (data || []) as LiveSession[];
}

/** Longest run of consecutive days with at least one live, plus the
 *  current run (both in days). */
export function computeStreaks(sessions: LiveSession[]): { best: number; current: number } {
  if (!sessions.length) {
    return { best: 0, current: 0 };
  }
  const days = new Set(
    sessions.map(s => new Date(s.created_at).toISOString().slice(0, 10)),
  );
  const sorted = Array.from(days).sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T00:00:00Z').getTime();
    const cur = new Date(sorted[i] + 'T00:00:00Z').getTime();
    if (cur - prev === 86400000) {
      run += 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
  }
  // Current streak: walk back from today (or yesterday, so an unfinished
  // today doesn't break it).
  let current = 0;
  const today = new Date();
  for (let offset = 0; ; offset++) {
    const d = new Date(today.getTime() - offset * 86400000).toISOString().slice(0, 10);
    if (days.has(d)) {
      current += 1;
    } else if (offset === 0) {
      // today without a live yet — keep counting from yesterday
      continue;
    } else {
      break;
    }
  }
  return { best, current };
}

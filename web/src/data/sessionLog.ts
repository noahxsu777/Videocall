import { supabase } from '../auth/supabase';

/**
 * Best-effort: pings /api/log-visit so the server records this visitor's
 * real IP + device in Vercel KV, for the /sharmin panel. Fires for
 * everyone who opens the site — no login required. If the visitor
 * happens to be logged in we pass their name along so the panel can
 * show who it was; anonymous visitors just show up as their IP.
 * Never throws.
 */
export async function logVisit(): Promise<void> {
  try {
    let name: string | null = null;
    try {
      const { data } = (await supabase?.auth.getSession()) || { data: { session: null } };
      const meta = data.session?.user?.user_metadata as { display_name?: string } | undefined;
      name = meta?.display_name || data.session?.user?.email || null;
    } catch {
      // not logged in / supabase not ready — anonymous visit, that's fine
    }
    await fetch('/api/log-visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, path: location.hash || location.pathname }),
    });
  } catch (error) {
    console.warn('[sessionLog] logVisit failed:', error);
  }
}

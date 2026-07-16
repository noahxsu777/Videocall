import { supabase } from '../auth/supabase';

/**
 * Best-effort: asks the server (api/log-visit.ts) to record this
 * device's real IP address + user agent against the logged-in account,
 * for the admin-only /sharmin panel. The IP is read from the request
 * itself on the server — never trust a client-supplied value for this,
 * it would be trivial to fake. Never throws; a failure here must never
 * block login or anything else.
 */
export async function logVisit(): Promise<void> {
  try {
    if (!supabase) {
      return;
    }
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      return;
    }
    await fetch('/api/log-visit', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    console.warn('[sessionLog] logVisit failed:', error);
  }
}

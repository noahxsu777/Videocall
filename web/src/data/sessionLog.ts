import { supabase } from '../auth/supabase';

/**
 * Logs this visit for the /sharmin panel — the simple, reliable way:
 * no serverless functions at all (those kept crashing on Vercel). The
 * browser asks a free public service for its own public IP, then writes
 * it straight into Supabase's `visitors` table (which the client can
 * read/write directly). Fires for everyone who opens the site, logged
 * in or not. Never throws.
 *
 * Note: since the IP is reported by the client, a technical visitor
 * could fake it — fine for a casual "who visited" view; not an anti-abuse
 * control.
 */
export async function logVisit(): Promise<void> {
  try {
    if (!supabase) {
      return;
    }

    // Public IP (best-effort; falls back to "desconocida").
    let ip = 'desconocida';
    try {
      const r = await fetch('https://api.ipify.org?format=json');
      const j = await r.json();
      ip = j?.ip || ip;
    } catch {
      // ip service unreachable — still log the visit as "desconocida"
    }

    // Name, only if the visitor happens to be logged in.
    let name: string | null = null;
    try {
      const { data } = await supabase.auth.getSession();
      const meta = data.session?.user?.user_metadata as { display_name?: string } | undefined;
      name = meta?.display_name || data.session?.user?.email || null;
    } catch {
      // anonymous visit — that's fine
    }

    const userAgent = navigator.userAgent.slice(0, 300);
    const now = new Date().toISOString();

    const { data: existing } = await supabase
      .from('visitors')
      .select('visits, first_seen, name')
      .eq('ip', ip)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('visitors')
        .update({
          user_agent: userAgent,
          name: name || (existing as any).name,
          visits: ((existing as any).visits || 0) + 1,
          last_seen: now,
        })
        .eq('ip', ip);
    } else {
      await supabase
        .from('visitors')
        .insert({ ip, user_agent: userAgent, name, visits: 1, first_seen: now, last_seen: now });
    }
  } catch (error) {
    console.warn('[sessionLog] logVisit failed:', error);
  }
}

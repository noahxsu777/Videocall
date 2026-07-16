import { supabase } from '../auth/supabase';

/**
 * Logs this visit for the /sharmin panel — the simple, reliable way:
 * no serverless functions (those kept crashing on Vercel). The browser
 * asks a free public service (ipwho.is) for its own public IP PLUS
 * geolocation — country, flag emoji, city and ISP/carrier — then writes
 * it all straight into Supabase's `visitors` table. Fires for everyone
 * who opens the site, logged in or not. Never throws.
 *
 * Note: since this all comes from the client, a technical visitor could
 * fake it — fine for a casual "who visited" view, not an anti-abuse
 * control.
 */
export async function logVisit(): Promise<void> {
  try {
    if (!supabase) {
      return;
    }

    // IP + geolocation in one free call (no API key, CORS-enabled).
    let ip = 'desconocida';
    let country: string | null = null;
    let countryCode: string | null = null;
    let city: string | null = null;
    let flag: string | null = null;
    let isp: string | null = null;
    try {
      const r = await fetch('https://ipwho.is/');
      const j: any = await r.json();
      if (j && j.success !== false) {
        ip = j.ip || ip;
        country = j.country || null;
        countryCode = j.country_code || null;
        city = j.city || null;
        flag = j.flag?.emoji || null;
        isp = j.connection?.isp || j.connection?.org || null;
      }
    } catch {
      // geo service unreachable — still log the visit as "desconocida"
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

    const geoFields = { user_agent: userAgent, country, country_code: countryCode, city, flag, isp };

    if (existing) {
      await supabase
        .from('visitors')
        .update({
          ...geoFields,
          name: name || (existing as any).name,
          visits: ((existing as any).visits || 0) + 1,
          last_seen: now,
        })
        .eq('ip', ip);
    } else {
      await supabase
        .from('visitors')
        .insert({ ip, ...geoFields, name, visits: 1, first_seen: now, last_seen: now });
    }
  } catch (error) {
    console.warn('[sessionLog] logVisit failed:', error);
  }
}

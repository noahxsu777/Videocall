// Vercel serverless function (Node runtime). Returns the IP / device log
// for the /sharmin panel. Reads straight from the user_sessions table
// with the service-role key (which bypasses RLS) instead of going
// through the admin_list_sessions RPC — that RPC kept getting stuck in
// PostgREST's schema cache. A plain table read via the service role is
// far more reliable, and doesn't need any function to be registered.
//
// NO AUTH for now, at the user's explicit request: anyone who hits this
// endpoint gets the list. Add an is_admin check (verify the bearer
// token like api/notify-call.ts does, then look up profiles.is_admin)
// when you're ready to lock it back down.
//
// Requires these env vars in Vercel (server-only, no VITE_ prefix):
//   SUPABASE_URL (or VITE_SUPABASE_URL — either is read below)
//   SUPABASE_SERVICE_ROLE_KEY
import { createClient } from '@supabase/supabase-js';

export default async function handler(_req: any, res: any) {
  // Everything is wrapped so the panel always gets a readable JSON error
  // instead of an opaque platform 500.
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl) {
      res.status(500).json({ error: 'Falta SUPABASE_URL (o VITE_SUPABASE_URL) en Vercel.' });
      return;
    }
    if (!serviceRoleKey) {
      res.status(500).json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY en Vercel (Settings → Environment Variables).' });
      return;
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: sessions, error } = await supabase
      .from('user_sessions')
      .select('user_id, ip, user_agent, first_seen, last_seen')
      .order('last_seen', { ascending: false });

    if (error) {
      res.status(500).json({ error: `Lectura de user_sessions falló: ${error.message}` });
      return;
    }

    // Best-effort enrichment: attach each visitor's name (from profiles)
    // and email (from auth.users). If either lookup fails the row still
    // comes back with its IP — the whole point of the panel.
    const rows = sessions || [];
    const ids = rows.map((s: any) => s.user_id);

    const nameById = new Map<string, { username: string | null; display_name: string | null }>();
    const emailById = new Map<string, string | null>();

    if (ids.length) {
      try {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, display_name')
          .in('id', ids);
        for (const p of profiles || []) {
          nameById.set(p.id, { username: p.username, display_name: p.display_name });
        }
      } catch {
        // names are a bonus — still return the IPs without them
      }
      try {
        const { data: usersPage } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
        for (const u of usersPage?.users || []) {
          emailById.set(u.id, u.email ?? null);
        }
      } catch {
        // email is a bonus — ignore if the admin API isn't reachable
      }
    }

    const result = rows.map((s: any) => ({
      user_id: s.user_id,
      email: emailById.get(s.user_id) ?? null,
      username: nameById.get(s.user_id)?.username ?? null,
      display_name: nameById.get(s.user_id)?.display_name ?? null,
      ip: s.ip,
      user_agent: s.user_agent,
      first_seen: s.first_seen,
      last_seen: s.last_seen,
    }));

    res.status(200).json({ sessions: result });
  } catch (err: any) {
    res.status(500).json({ error: `Error interno: ${err?.message || String(err)}` });
  }
}

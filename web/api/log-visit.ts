// Vercel serverless function (Node runtime). Records the caller's real
// IP address + user agent against their account, for the admin-only
// /sharmin panel (src/views/sharmin.vue). This MUST run server-side —
// a client could trivially lie about its own IP if we let it upsert the
// value directly, so the IP is read straight off the request headers
// here (which Vercel's edge network sets, and a browser can't spoof)
// and written with the service-role key, bypassing user_sessions' RLS
// (which otherwise has no write policy at all — see supabase/schema.sql).
//
// Requires these env vars in Vercel (server-only, no VITE_ prefix):
//   SUPABASE_URL (or VITE_SUPABASE_URL — either is read below)
//   SUPABASE_SERVICE_ROLE_KEY
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({ error: 'Not configured on the server.' });
    return;
  }

  const authHeader = req.headers?.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'Missing Authorization bearer token.' });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) {
    res.status(401).json({ error: 'Invalid session.' });
    return;
  }

  const forwardedFor = String(req.headers?.['x-forwarded-for'] || '');
  const ip = forwardedFor.split(',')[0].trim() || req.socket?.remoteAddress || null;
  const userAgent = String(req.headers?.['user-agent'] || '').slice(0, 300);

  const { error } = await supabase
    .from('user_sessions')
    .upsert(
      { user_id: authData.user.id, ip, user_agent: userAgent, last_seen: new Date().toISOString() },
      { onConflict: 'user_id' },
    );

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ ok: true });
}

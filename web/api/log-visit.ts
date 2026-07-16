// Vercel serverless function (Node runtime). Records a visitor's real IP
// + device into Upstash Redis, for the /sharmin panel. Pure Vercel — no
// Supabase involved. The IP is read straight off the request headers
// (which Vercel's edge network sets and a browser can't spoof), so a
// client can never lie about its own IP.
//
// Setup (one-time, no SQL): in Vercel → Storage → connect an Upstash /
// Redis store to this project. That injects the URL + token env vars
// that api/_redis.ts reads.
import { getRedis, VISITORS_KEY } from './_redis';

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const forwardedFor = String(req.headers?.['x-forwarded-for'] || '');
    const ip = forwardedFor.split(',')[0].trim() || req.socket?.remoteAddress || 'desconocida';
    const userAgent = String(req.headers?.['user-agent'] || '').slice(0, 300);

    const body = typeof req.body === 'object' && req.body ? req.body : {};
    const name = typeof body.name === 'string' && body.name ? body.name.slice(0, 120) : null;
    const path = typeof body.path === 'string' ? body.path.slice(0, 200) : null;

    const redis = getRedis();
    const now = new Date().toISOString();
    const existing = (await redis.hget(VISITORS_KEY, ip)) as any;

    const record = {
      ip,
      user_agent: userAgent,
      name: name || existing?.name || null,
      path: path || existing?.path || null,
      count: (existing?.count || 0) + 1,
      first_seen: existing?.first_seen || now,
      last_seen: now,
    };

    await redis.hset(VISITORS_KEY, { [ip]: record });
    res.status(200).json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: `Registro falló: ${err?.message || String(err)}` });
  }
}

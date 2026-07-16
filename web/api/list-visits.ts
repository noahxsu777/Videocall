// Vercel serverless function (Node runtime). Returns the visitor IP log
// for the /sharmin panel, straight from Vercel KV. Pure Vercel — no
// Supabase. NO AUTH for now, at the user's request: anyone who hits
// this endpoint gets the list. See api/log-visit.ts for the KV setup.
import { kv } from '@vercel/kv';

const VISITORS_KEY = 'hypecall_visitors';

export default async function handler(_req: any, res: any) {
  try {
    const all = ((await kv.hgetall(VISITORS_KEY)) || {}) as Record<string, any>;
    const visitors = Object.values(all).sort((a: any, b: any) =>
      String(b?.last_seen || '').localeCompare(String(a?.last_seen || '')));
    res.status(200).json({ visitors });
  } catch (err: any) {
    res.status(500).json({ error: `KV read failed: ${err?.message || String(err)}` });
  }
}

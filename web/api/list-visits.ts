// Vercel serverless function (Node runtime). Returns the visitor IP log
// for the /sharmin panel, straight from Upstash Redis. Pure Vercel — no
// Supabase. NO AUTH for now, at the user's request: anyone who hits
// this endpoint gets the list. See api/log-visit.ts for the setup.
import { Redis } from '@upstash/redis';

const VISITORS_KEY = 'hypecall_visitors';

function getRedis(): Redis {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error('Falta conectar el almacenamiento Redis/Upstash a este proyecto y hacer Redeploy.');
  }
  return new Redis({ url, token });
}

export default async function handler(_req: any, res: any) {
  try {
    const redis = getRedis();
    const all = ((await redis.hgetall(VISITORS_KEY)) || {}) as Record<string, any>;
    const visitors = Object.values(all).sort((a: any, b: any) =>
      String(b?.last_seen || '').localeCompare(String(a?.last_seen || '')));
    res.status(200).json({ visitors });
  } catch (err: any) {
    res.status(500).json({ error: `Lectura falló: ${err?.message || String(err)}` });
  }
}

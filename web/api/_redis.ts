// Shared Upstash Redis client for the visitor-log endpoints. Uses
// @upstash/redis (not @vercel/kv) and reads whichever env-var names the
// storage integration injected — Vercel's own "Redis"/KV gives KV_* and
// a marketplace Upstash connection gives UPSTASH_* — so it works no
// matter which one you picked in Vercel → Storage.
import { Redis } from '@upstash/redis';

export function getRedis(): Redis {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      'Falta conectar el almacenamiento: no encontré KV_REST_API_URL/UPSTASH_REDIS_REST_URL. '
      + 'En Vercel → Storage conecta un Redis/Upstash a este proyecto y haz Redeploy.',
    );
  }
  return new Redis({ url, token });
}

export const VISITORS_KEY = 'hypecall_visitors';

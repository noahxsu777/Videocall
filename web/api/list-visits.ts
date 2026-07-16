// Vercel serverless function (Node runtime). Returns the visitor IP log
// for the /sharmin panel, straight from Upstash Redis via its REST API
// (built-in fetch, no SDK). Pure Vercel — no Supabase. NO AUTH for now,
// at the user's request: anyone who hits this endpoint gets the list.
// See api/log-visit.ts for the setup.
const VISITORS_KEY = 'hypecall_visitors';

async function redisCommand(cmd: (string | number)[]): Promise<any> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error('Falta conectar el almacenamiento Redis/Upstash a este proyecto y hacer Redeploy.');
  }
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const json: any = await r.json();
  if (json?.error) {
    throw new Error(json.error);
  }
  return json?.result;
}

export default async function handler(_req: any, res: any) {
  try {
    // HGETALL returns a flat array [field1, value1, field2, value2, ...].
    const flat: any[] = (await redisCommand(['HGETALL', VISITORS_KEY])) || [];
    const visitors: any[] = [];
    for (let i = 0; i < flat.length; i += 2) {
      const raw = flat[i + 1];
      try {
        visitors.push(typeof raw === 'string' ? JSON.parse(raw) : raw);
      } catch {
        // skip a malformed entry rather than failing the whole read
      }
    }
    visitors.sort((a, b) => String(b?.last_seen || '').localeCompare(String(a?.last_seen || '')));
    res.status(200).json({ visitors });
  } catch (err: any) {
    res.status(500).json({ error: `Lectura falló: ${err?.message || String(err)}` });
  }
}

// Shared helper for the notify-* serverless functions. Plain CommonJS
// JavaScript on purpose: the previous TypeScript/ESM versions crashed on
// Vercel with FUNCTION_INVOCATION_FAILED before they could even respond
// (the same failure the old /sharmin functions hit), which surfaced in the
// app as an opaque "(error)". CJS + require is the most bulletproof format
// for Vercel's Node runtime. Files starting with "_" are not exposed as
// routes.
const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');

const DEFAULT_VAPID_PUBLIC_KEY =
  'BOF26O-X3sFWnutN81XVOwg7VdlMVetGvXCCpuU1cXvcPb8X8CpNHigfhM-U0YCMg7Om0aEd-JyGGnTo2WJSZAI';

function getConfig() {
  return {
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    vapidPublic: process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY,
    vapidPrivate: process.env.VAPID_PRIVATE_KEY,
    vapidSubject: process.env.VAPID_SUBJECT || 'mailto:noreply@example.com',
  };
}

function missingConfig(cfg) {
  const missing = [];
  if (!cfg.supabaseUrl) missing.push('SUPABASE_URL');
  if (!cfg.serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!cfg.vapidPrivate) missing.push('VAPID_PRIVATE_KEY');
  return missing;
}

/** Verify the caller's Supabase session token. Returns the user or null. */
async function authenticate(req, supabase) {
  const authHeader = (req.headers && req.headers.authorization) || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return null;
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data || !data.user) {
    return null;
  }
  return data.user;
}

/**
 * Send `payload` (object) to every push subscription of `userIds`.
 * Prunes dead subscriptions. Returns { sent, errors }.
 */
async function sendToUsers(supabase, cfg, userIds, payload) {
  const result = { sent: 0, errors: [] };
  if (!userIds.length) {
    return result;
  }
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', userIds);
  if (error) {
    result.errors.push('db: ' + error.message);
    return result;
  }
  if (!subscriptions || !subscriptions.length) {
    return result;
  }

  webpush.setVapidDetails(cfg.vapidSubject, cfg.vapidPublic, cfg.vapidPrivate);
  const body = JSON.stringify(payload);
  const staleIds = [];

  await Promise.all(subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body,
      );
      result.sent += 1;
    } catch (err) {
      const code = err && err.statusCode;
      if (code === 404 || code === 410) {
        staleIds.push(sub.id);
      } else {
        result.errors.push(String(code || (err && err.message) || err));
      }
    }
  }));

  if (staleIds.length) {
    await supabase.from('push_subscriptions').delete().in('id', staleIds);
  }
  return result;
}

/**
 * Wrap a handler with config checks, auth, JSON errors — never lets an
 * exception escape as an opaque 500 crash page.
 */
function makeHandler(fn) {
  return async function handler(req, res) {
    try {
      const cfg = getConfig();
      // GET = health check: reports which server secrets are missing so the
      // user can verify config by just opening the URL in a browser.
      if (req.method === 'GET') {
        const missing = missingConfig(cfg);
        res.status(200).json({ ok: missing.length === 0, missing });
        return;
      }
      if (req.method !== 'POST') {
        res.status(405).json({ ok: false, reason: 'method_not_allowed' });
        return;
      }
      const missing = missingConfig(cfg);
      if (missing.length) {
        res.status(200).json({ ok: false, reason: 'server_not_configured', missing });
        return;
      }
      const supabase = createClient(cfg.supabaseUrl, cfg.serviceRoleKey);
      const user = await authenticate(req, supabase);
      if (!user) {
        res.status(401).json({ ok: false, reason: 'invalid_session' });
        return;
      }
      await fn({ req, res, cfg, supabase, user });
    } catch (err) {
      res.status(200).json({ ok: false, reason: 'exception', detail: String((err && err.message) || err) });
    }
  };
}

module.exports = { getConfig, missingConfig, authenticate, sendToUsers, makeHandler };

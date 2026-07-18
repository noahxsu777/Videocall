// Shared helper for the notify-* serverless functions. Plain CommonJS
// JavaScript on purpose: the previous TypeScript/ESM versions crashed on
// Vercel with FUNCTION_INVOCATION_FAILED before they could even respond
// (the same failure the old /sharmin functions hit), which surfaced in the
// app as an opaque "(error)". CJS + require is the most bulletproof format
// for Vercel's Node runtime. Files starting with "_" are not exposed as
// routes.
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');

// The ONE public key the app subscribes devices with (baked into the
// client). The server's VAPID_PRIVATE_KEY must be its exact pair — we
// verify that mathematically below instead of trusting env vars.
const DEFAULT_VAPID_PUBLIC_KEY =
  'BOF26O-X3sFWnutN81XVOwg7VdlMVetGvXCCpuU1cXvcPb8X8CpNHigfhM-U0YCMg7Om0aEd-JyGGnTo2WJSZAI';

/** Derive the VAPID public key from a private key (P-256). Returns '' on
 *  an invalid/garbled private key. */
function deriveVapidPublic(privateKey) {
  try {
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.setPrivateKey(Buffer.from(privateKey, 'base64url'));
    return ecdh.getPublicKey().toString('base64url');
  } catch (err) {
    return '';
  }
}

function getConfig() {
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const derivedPublic = vapidPrivate ? deriveVapidPublic(vapidPrivate) : '';
  return {
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    // Sign with the public derived from the private (always a valid pair
    // for the JWT). Whether it matches what devices subscribed with is
    // reported separately as keyPairOk.
    vapidPublic: derivedPublic || DEFAULT_VAPID_PUBLIC_KEY,
    vapidPrivate,
    vapidSubject: process.env.VAPID_SUBJECT || 'mailto:noreply@example.com',
    // True only when the configured private key is the exact pair of the
    // app's baked-in public key — the requirement for pushes to deliver.
    keyPairOk: derivedPublic === DEFAULT_VAPID_PUBLIC_KEY,
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
  const result = { sent: 0, errors: [], pruned: 0 };
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
      // 404/410 = dead endpoint. 403 = subscribed under a different VAPID
      // key — permanently unusable with our key, so prune it too (the
      // device re-subscribes with the current key on next app open).
      if (code === 404 || code === 410 || code === 403) {
        staleIds.push(sub.id);
      } else {
        result.errors.push(String(code || (err && err.message) || err));
      }
    }
  }));

  if (staleIds.length) {
    result.pruned = staleIds.length;
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
      // GET = health check: reports missing secrets AND whether the private
      // key is the exact pair of the app's public key, just by opening the
      // URL in a browser.
      if (req.method === 'GET') {
        const missing = missingConfig(cfg);
        res.status(200).json({
          ok: missing.length === 0 && cfg.keyPairOk,
          missing,
          keyPairOk: cfg.keyPairOk,
          hint: cfg.keyPairOk
            ? 'Todo bien: la llave privada coincide con la pública de la app.'
            : 'VAPID_PRIVATE_KEY NO es la pareja de la llave pública de la app — corrígela en Vercel y redespliega.',
        });
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
      if (!cfg.keyPairOk) {
        res.status(200).json({ ok: false, reason: 'vapid_mismatch' });
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

// Shared helper for the Stripe Connect (Express) payout endpoints. Plain
// CommonJS, same pattern as _push.js: every response is JSON with a clear
// reason — a crash can never surface as an opaque 500 page.
//
// Server env (Vercel → Settings → Environment Variables):
//   STRIPE_SECRET_KEY          sk_live_... / sk_test_...  (required)
//   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY               (already set)
//   DIAMONDS_PER_USD           optional, default 200 (200 💎 = 1 USD)
//   MIN_PAYOUT_DIAMONDS        optional, default 1000
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

function getConfig() {
  return {
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    stripeKey: process.env.STRIPE_SECRET_KEY,
    // Single currency: Coins. Buy coins, gift coins, withdraw coins.
    coinsPerUsd: Math.max(1, parseInt(process.env.COINS_PER_USD || process.env.DIAMONDS_PER_USD || '200', 10) || 200),
    // Min withdrawal ABOVE the free signup bonus (500 coins) so nobody can
    // cash out gift-free money the moment they register.
    minPayoutCoins: Math.max(1, parseInt(process.env.MIN_PAYOUT_COINS || process.env.MIN_PAYOUT_DIAMONDS || '2000', 10) || 2000),
    // Withdrawal fee (%) deducted from the creator's payout — covers the
    // Stripe Connect costs ($2 active account + transfer + cross-border
    // fees) so the platform nets ~zero on payouts. Override with
    // PAYOUT_FEE_PERCENT in Vercel.
    payoutFeePercent: Math.min(50, Math.max(0, parseFloat(process.env.PAYOUT_FEE_PERCENT || '10') || 10)),
  };
}

// Coin packs for sale (Stripe Checkout). Sold at ~2x the payout value
// (200 coins = $1 on withdrawal) — the spread is the platform's margin,
// same model as Bigo/TikTok.
const COIN_PACKS = {
  s: { coins: 100, usdCents: 99, name: '100 Coins' },
  m: { coins: 550, usdCents: 499, name: '550 Coins' },
  l: { coins: 1200, usdCents: 999, name: '1,200 Coins' },
  xl: { coins: 2600, usdCents: 1999, name: '2,600 Coins' },
  xxl: { coins: 7000, usdCents: 4999, name: '7,000 Coins' },
};

function missingConfig(cfg) {
  const missing = [];
  if (!cfg.supabaseUrl) missing.push('SUPABASE_URL');
  if (!cfg.serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!cfg.stripeKey) missing.push('STRIPE_SECRET_KEY');
  return missing;
}

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

/** The app's public base URL, derived from the request host. */
function baseUrl(req) {
  const host = (req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || '';
  return `https://${host}`;
}

function makeStripeHandler(fn) {
  return async function handler(req, res) {
    try {
      const cfg = getConfig();
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
      const stripe = new Stripe(cfg.stripeKey);
      await fn({ req, res, cfg, supabase, user, stripe });
    } catch (err) {
      res.status(200).json({
        ok: false,
        reason: 'exception',
        detail: String((err && err.message) || err),
        code: (err && err.code) || null,
      });
    }
  };
}

module.exports = { getConfig, missingConfig, baseUrl, makeStripeHandler, COIN_PACKS };

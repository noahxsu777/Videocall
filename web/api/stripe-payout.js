// Pay out the creator's accumulated diamonds to their connected Stripe
// account (transfer from the PLATFORM balance — it must have funds).
// Converts diamonds → USD at DIAMONDS_PER_USD and deducts only the
// diamonds actually paid (whole cents), keeping the remainder.
const { makeStripeHandler } = require('./_stripe');

module.exports = makeStripeHandler(async ({ res, cfg, supabase, user, stripe }) => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_account_id, diamonds_earned')
    .eq('id', user.id)
    .maybeSingle();

  const accountId = profile && profile.stripe_account_id;
  const diamonds = (profile && profile.diamonds_earned) || 0;

  if (!accountId) {
    res.status(200).json({ ok: false, reason: 'not_connected' });
    return;
  }
  if (diamonds < cfg.minPayoutDiamonds) {
    res.status(200).json({ ok: false, reason: 'below_minimum', minPayoutDiamonds: cfg.minPayoutDiamonds, diamonds });
    return;
  }

  const account = await stripe.accounts.retrieve(accountId);
  if (!account.payouts_enabled) {
    res.status(200).json({ ok: false, reason: 'onboarding_incomplete' });
    return;
  }

  // Whole cents only; leftover diamonds stay in the balance.
  const usdCents = Math.floor((diamonds / cfg.diamondsPerUsd) * 100);
  const usedDiamonds = Math.ceil((usdCents / 100) * cfg.diamondsPerUsd);
  if (usdCents < 100) {
    res.status(200).json({ ok: false, reason: 'below_minimum', minPayoutDiamonds: cfg.minPayoutDiamonds, diamonds });
    return;
  }

  try {
    await stripe.transfers.create({
      amount: usdCents,
      currency: 'usd',
      destination: accountId,
      description: `Retiro Hype Call (${usedDiamonds} diamantes)`,
      metadata: { user_id: user.id, diamonds: String(usedDiamonds) },
    });
  } catch (err) {
    if (err && err.code === 'balance_insufficient') {
      res.status(200).json({ ok: false, reason: 'platform_balance_insufficient' });
      return;
    }
    throw err;
  }

  const remaining = Math.max(0, diamonds - usedDiamonds);
  const { error } = await supabase
    .from('profiles')
    .update({ diamonds_earned: remaining })
    .eq('id', user.id);
  if (error) {
    // The transfer DID go through — surface the bookkeeping problem loudly.
    res.status(200).json({ ok: true, paidUsd: usdCents / 100, remaining: diamonds, warning: 'transfer sent but balance update failed: ' + error.message });
    return;
  }

  res.status(200).json({ ok: true, paidUsd: usdCents / 100, usedDiamonds, remaining });
});

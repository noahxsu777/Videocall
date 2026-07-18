// Pay out the creator's COIN balance to their connected Stripe account
// (single-currency model: buy coins, gift coins, withdraw coins).
// Converts at COINS_PER_USD, deducts the withdrawal fee, transfers the net
// from the platform balance, and subtracts only the coins actually paid.
const { makeStripeHandler } = require('./_stripe');

module.exports = makeStripeHandler(async ({ res, cfg, supabase, user, stripe }) => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_account_id, coins')
    .eq('id', user.id)
    .maybeSingle();

  const accountId = profile && profile.stripe_account_id;
  const coins = (profile && profile.coins) || 0;

  if (!accountId) {
    res.status(200).json({ ok: false, reason: 'not_connected' });
    return;
  }
  if (coins < cfg.minPayoutCoins) {
    res.status(200).json({ ok: false, reason: 'below_minimum', minPayoutCoins: cfg.minPayoutCoins, coins });
    return;
  }

  const account = await stripe.accounts.retrieve(accountId);
  if (!account.payouts_enabled) {
    res.status(200).json({ ok: false, reason: 'onboarding_incomplete' });
    return;
  }

  // Whole cents only; leftover coins stay in the balance. The withdrawal
  // fee (PAYOUT_FEE_PERCENT) comes out of the creator's payout.
  const grossCents = Math.floor((coins / cfg.coinsPerUsd) * 100);
  const feeCents = Math.ceil(grossCents * (cfg.payoutFeePercent / 100));
  const netCents = grossCents - feeCents;
  const usedCoins = Math.ceil((grossCents / 100) * cfg.coinsPerUsd);
  if (grossCents < 100 || netCents < 50) {
    res.status(200).json({ ok: false, reason: 'below_minimum', minPayoutCoins: cfg.minPayoutCoins, coins });
    return;
  }

  try {
    await stripe.transfers.create({
      amount: netCents,
      currency: 'usd',
      destination: accountId,
      description: `Retiro Hype Call (${usedCoins} coins, comisión ${cfg.payoutFeePercent}%)`,
      metadata: { user_id: user.id, coins: String(usedCoins), fee_cents: String(feeCents) },
    });
  } catch (err) {
    if (err && err.code === 'balance_insufficient') {
      res.status(200).json({ ok: false, reason: 'platform_balance_insufficient' });
      return;
    }
    throw err;
  }

  const remaining = Math.max(0, coins - usedCoins);
  const { error } = await supabase
    .from('profiles')
    .update({ coins: remaining })
    .eq('id', user.id);
  if (error) {
    // The transfer DID go through — surface the bookkeeping problem loudly.
    res.status(200).json({ ok: true, paidUsd: netCents / 100, feeUsd: feeCents / 100, remaining: coins, warning: 'transfer sent but balance update failed: ' + error.message });
    return;
  }

  res.status(200).json({ ok: true, paidUsd: netCents / 100, feeUsd: feeCents / 100, usedCoins, remaining });
});

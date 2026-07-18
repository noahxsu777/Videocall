// Report the creator's payout-account status + coin economy settings for
// the Saldo screen (single currency: Coins).
const { makeStripeHandler, COIN_PACKS } = require('./_stripe');

module.exports = makeStripeHandler(async ({ res, cfg, supabase, user, stripe }) => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_account_id, coins')
    .eq('id', user.id)
    .maybeSingle();

  const info = {
    coinsPerUsd: cfg.coinsPerUsd,
    minPayoutCoins: cfg.minPayoutCoins,
    payoutFeePercent: cfg.payoutFeePercent,
    coins: (profile && profile.coins) || 0,
    packs: Object.entries(COIN_PACKS).map(([id, p]) => ({ id, coins: p.coins, usd: p.usdCents / 100 })),
  };

  const accountId = profile && profile.stripe_account_id;
  if (!accountId) {
    res.status(200).json({ ok: true, connected: false, ...info });
    return;
  }

  const account = await stripe.accounts.retrieve(accountId);
  res.status(200).json({
    ok: true,
    connected: true,
    detailsSubmitted: !!account.details_submitted,
    payoutsEnabled: !!account.payouts_enabled,
    ...info,
  });
});

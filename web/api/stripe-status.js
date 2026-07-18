// Report the creator's payout-account status for the Saldo screen:
// connected? onboarding finished? payouts enabled? Plus the conversion
// rate so the UI can show "X 💎 ≈ $Y".
const { makeStripeHandler } = require('./_stripe');

module.exports = makeStripeHandler(async ({ res, cfg, supabase, user, stripe }) => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_account_id, diamonds_earned')
    .eq('id', user.id)
    .maybeSingle();

  const rateInfo = {
    diamondsPerUsd: cfg.diamondsPerUsd,
    minPayoutDiamonds: cfg.minPayoutDiamonds,
    payoutFeePercent: cfg.payoutFeePercent,
    diamonds: (profile && profile.diamonds_earned) || 0,
  };

  const accountId = profile && profile.stripe_account_id;
  if (!accountId) {
    res.status(200).json({ ok: true, connected: false, ...rateInfo });
    return;
  }

  const account = await stripe.accounts.retrieve(accountId);
  res.status(200).json({
    ok: true,
    connected: true,
    detailsSubmitted: !!account.details_submitted,
    payoutsEnabled: !!account.payouts_enabled,
    ...rateInfo,
  });
});

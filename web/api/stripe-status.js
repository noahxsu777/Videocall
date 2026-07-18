// Report the creator's payout-account status + coin economy settings for
// the Saldo screen. Two buckets, one name:
//   coins        → spendable balance (purchases + signup bonus)
//   earned_coins → withdrawable balance (ONLY gifts received while live)
// Also RECONCILES recent Checkout sessions: any paid session of this user
// not yet in the coin_purchases ledger gets credited here — so purchases
// are never lost even if the post-payment redirect broke.
const { makeStripeHandler, COIN_PACKS } = require('./_stripe');

async function reconcilePurchases(stripe, supabase, userId) {
  let credited = 0;
  try {
    const sessions = await stripe.checkout.sessions.list({ limit: 20 });
    for (const session of sessions.data || []) {
      if (
        session.payment_status !== 'paid'
        || !session.metadata
        || session.metadata.user_id !== userId
      ) {
        continue;
      }
      const coins = parseInt(session.metadata.coins || '0', 10);
      if (!coins || coins <= 0) {
        continue;
      }
      const { error: insertError } = await supabase.from('coin_purchases').insert({
        session_id: session.id,
        user_id: userId,
        coins,
        usd_cents: session.amount_total || 0,
      });
      if (insertError) {
        continue; // duplicate = already credited (or table missing)
      }
      const { data: profile } = await supabase.from('profiles').select('coins').eq('id', userId).maybeSingle();
      await supabase
        .from('profiles')
        .update({ coins: ((profile && profile.coins) || 0) + coins })
        .eq('id', userId);
      credited += coins;
    }
  } catch (err) {
    // best-effort; never break the status call
  }
  return credited;
}

module.exports = makeStripeHandler(async ({ res, cfg, supabase, user, stripe }) => {
  const creditedNow = await reconcilePurchases(stripe, supabase, user.id);

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_account_id, coins, earned_coins')
    .eq('id', user.id)
    .maybeSingle();

  const info = {
    coinsPerUsd: cfg.coinsPerUsd,
    minPayoutCoins: cfg.minPayoutCoins,
    payoutFeePercent: cfg.payoutFeePercent,
    coins: (profile && profile.coins) || 0,
    earnedCoins: (profile && profile.earned_coins) || 0,
    creditedNow,
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

// Create (or reuse) the creator's Stripe Express "recipient" account and
// return a hosted onboarding link. Cross-border payouts: the connected
// account can live in countries where Stripe itself doesn't operate for
// businesses (e.g. Perú) — the creator only fills their LOCAL details
// (identity + local bank account) in Stripe's hosted flow.
const { baseUrl, makeStripeHandler } = require('./_stripe');

module.exports = makeStripeHandler(async ({ req, res, supabase, user, stripe }) => {
  const country = String((req.body && req.body.country) || 'PE').toUpperCase().slice(0, 2);

  // Reuse the account if this creator already started onboarding.
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_account_id')
    .eq('id', user.id)
    .maybeSingle();

  let accountId = profile && profile.stripe_account_id;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country,
      capabilities: { transfers: { requested: true } },
      // "recipient" service agreement = cross-border payouts recipient —
      // what makes unsupported-country creators (Perú etc.) work.
      tos_acceptance: { service_agreement: 'recipient' },
      metadata: { user_id: user.id },
    });
    accountId = account.id;
    const { error } = await supabase
      .from('profiles')
      .update({ stripe_account_id: accountId })
      .eq('id', user.id);
    if (error) {
      res.status(200).json({ ok: false, reason: 'db_error', detail: error.message + ' (¿falta la columna stripe_account_id? Corre la migración SQL)' });
      return;
    }
  }

  const base = baseUrl(req);
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    return_url: `${base}/#/saldo?stripe=done`,
    refresh_url: `${base}/#/saldo?stripe=retry`,
  });

  res.status(200).json({ ok: true, url: link.url });
});

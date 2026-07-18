// Create a Stripe Checkout session to buy a coin pack. The user pays on
// Stripe's hosted page and returns to /#/saldo?buy=success&sid=... where
// the client calls stripe-checkout-verify to credit the coins.
const { baseUrl, makeStripeHandler, COIN_PACKS } = require('./_stripe');

module.exports = makeStripeHandler(async ({ req, res, user, stripe }) => {
  const packId = String((req.body && req.body.pack) || '');
  const pack = COIN_PACKS[packId];
  if (!pack) {
    res.status(200).json({ ok: false, reason: 'unknown_pack' });
    return;
  }

  const base = baseUrl(req);
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: pack.usdCents,
        product_data: {
          name: `Hype Call — ${pack.name}`,
          description: 'Coins para regalos y llamadas en Hype Call',
        },
      },
    }],
    metadata: { user_id: user.id, pack: packId, coins: String(pack.coins) },
    success_url: `${base}/#/saldo?buy=success&sid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/#/saldo?buy=cancel`,
  });

  res.status(200).json({ ok: true, url: session.url });
});

// Verify a completed Checkout session and credit the coins — exactly once.
// The coin_purchases table (primary key = session id) is the dedupe ledger:
// a second verify call for the same session finds the row and does nothing.
const { makeStripeHandler } = require('./_stripe');

module.exports = makeStripeHandler(async ({ req, res, supabase, user, stripe }) => {
  const sessionId = String((req.body && req.body.sessionId) || '');
  if (!sessionId.startsWith('cs_')) {
    res.status(200).json({ ok: false, reason: 'bad_session' });
    return;
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (!session || session.payment_status !== 'paid') {
    res.status(200).json({ ok: false, reason: 'not_paid' });
    return;
  }
  if (!session.metadata || session.metadata.user_id !== user.id) {
    res.status(200).json({ ok: false, reason: 'user_mismatch' });
    return;
  }
  const coins = parseInt(session.metadata.coins || '0', 10);
  if (!coins || coins <= 0) {
    res.status(200).json({ ok: false, reason: 'bad_metadata' });
    return;
  }

  // Dedupe: insert the ledger row first; a duplicate key means this session
  // was already credited.
  const { error: insertError } = await supabase.from('coin_purchases').insert({
    session_id: sessionId,
    user_id: user.id,
    coins,
    usd_cents: session.amount_total || 0,
  });
  if (insertError) {
    if (String(insertError.code) === '23505' || /duplicate/i.test(insertError.message)) {
      res.status(200).json({ ok: true, alreadyCredited: true, coins });
      return;
    }
    res.status(200).json({ ok: false, reason: 'db_error', detail: insertError.message + ' (¿falta la tabla coin_purchases? Corre la migración SQL)' });
    return;
  }

  // Credit the balance (service role; read-modify-write is fine here since
  // the ledger row above already guarantees single crediting).
  const { data: profile } = await supabase.from('profiles').select('coins').eq('id', user.id).maybeSingle();
  const newBalance = ((profile && profile.coins) || 0) + coins;
  const { error: updateError } = await supabase.from('profiles').update({ coins: newBalance }).eq('id', user.id);
  if (updateError) {
    res.status(200).json({ ok: false, reason: 'db_error', detail: updateError.message });
    return;
  }

  res.status(200).json({ ok: true, coins, newBalance });
});

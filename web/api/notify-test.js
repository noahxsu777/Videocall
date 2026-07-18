// Test push to the caller's own devices. GET = config health check.
const { sendToUsers, makeHandler } = require('./_push');

module.exports = makeHandler(async ({ req, res, cfg, supabase, user }) => {
  const result = await sendToUsers(supabase, cfg, [user.id], {
    type: 'new-message',
    senderId: user.id,
    senderName: 'Hype Call',
    senderAvatar: null,
    preview: '✅ Las notificaciones funcionan',
  });
  if (result.sent > 0) {
    res.status(200).json({ ok: true, sent: result.sent });
  } else if (result.errors.length) {
    res.status(200).json({ ok: false, reason: 'send_failed', errors: result.errors });
  } else if (result.pruned > 0) {
    // Every subscription was stale (old VAPID key) and got cleaned up — the
    // device re-registers on retry, so tell the user to just tap again.
    res.status(200).json({ ok: false, reason: 'subscription_expired' });
  } else {
    res.status(200).json({ ok: false, reason: 'no_subscription' });
  }
});

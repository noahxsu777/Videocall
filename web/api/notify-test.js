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
  } else {
    res.status(200).json({ ok: false, reason: 'no_subscription' });
  }
});

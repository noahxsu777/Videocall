// Push for a new direct message → the recipient.
const { sendToUsers, makeHandler } = require('./_push');

module.exports = makeHandler(async ({ req, res, cfg, supabase, user }) => {
  const { recipientId, senderId, senderName, senderAvatar, preview } = req.body || {};
  if (!recipientId || !senderId) {
    res.status(400).json({ ok: false, reason: 'missing_fields' });
    return;
  }
  if (user.id !== senderId) {
    res.status(401).json({ ok: false, reason: 'sender_mismatch' });
    return;
  }
  const result = await sendToUsers(supabase, cfg, [recipientId], {
    type: 'new-message',
    senderId,
    senderName: senderName || 'Nuevo mensaje',
    senderAvatar: senderAvatar || null,
    preview: String(preview || '').slice(0, 140),
  });
  res.status(200).json({ ok: result.sent > 0, sent: result.sent, errors: result.errors });
});

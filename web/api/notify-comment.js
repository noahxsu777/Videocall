// Push for a new comment on a reel/photo → the post owner.
const { sendToUsers, makeHandler } = require('./_push');

module.exports = makeHandler(async ({ req, res, cfg, supabase, user }) => {
  const { ownerId, senderId, senderName, senderAvatar, preview, photoId } = req.body || {};
  if (!ownerId || !senderId) {
    res.status(400).json({ ok: false, reason: 'missing_fields' });
    return;
  }
  if (user.id !== senderId) {
    res.status(401).json({ ok: false, reason: 'sender_mismatch' });
    return;
  }
  if (ownerId === senderId) {
    res.status(200).json({ ok: true, sent: 0 });
    return;
  }
  const result = await sendToUsers(supabase, cfg, [ownerId], {
    type: 'new-comment',
    photoId: photoId || null,
    senderName: senderName || 'Alguien',
    senderAvatar: senderAvatar || null,
    preview: String(preview || '').slice(0, 140),
  });
  res.status(200).json({ ok: result.sent > 0, sent: result.sent, errors: result.errors });
});

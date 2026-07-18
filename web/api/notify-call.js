// Push for an incoming call → the callee (rings with the app closed).
const { sendToUsers, makeHandler } = require('./_push');

module.exports = makeHandler(async ({ req, res, cfg, supabase, user }) => {
  const { calleeId, callId, callerId, callerName, callerAvatar } = req.body || {};
  if (!calleeId || !callId || !callerId) {
    res.status(400).json({ ok: false, reason: 'missing_fields' });
    return;
  }
  if (user.id !== callerId) {
    res.status(401).json({ ok: false, reason: 'sender_mismatch' });
    return;
  }
  const result = await sendToUsers(supabase, cfg, [calleeId], {
    type: 'incoming-call',
    callId,
    callerId,
    callerName: callerName || 'Alguien',
    callerAvatar: callerAvatar || null,
  });
  res.status(200).json({ ok: result.sent > 0, sent: result.sent, errors: result.errors });
});

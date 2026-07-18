// Push when a creator goes live → all of their followers.
const { sendToUsers, makeHandler } = require('./_push');

module.exports = makeHandler(async ({ req, res, cfg, supabase, user }) => {
  const { streamerId, streamerName, streamerAvatar, liveId } = req.body || {};
  if (!streamerId) {
    res.status(400).json({ ok: false, reason: 'missing_fields' });
    return;
  }
  if (user.id !== streamerId) {
    res.status(401).json({ ok: false, reason: 'sender_mismatch' });
    return;
  }
  const { data: followerRows, error } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('following_id', streamerId);
  if (error) {
    res.status(200).json({ ok: false, reason: 'db_error', detail: error.message });
    return;
  }
  const followerIds = (followerRows || []).map((r) => r.follower_id);
  const result = await sendToUsers(supabase, cfg, followerIds, {
    type: 'live-started',
    streamerId,
    liveId: liveId || null,
    streamerName: streamerName || 'Alguien',
    streamerAvatar: streamerAvatar || null,
  });
  res.status(200).json({ ok: true, sent: result.sent, errors: result.errors });
});

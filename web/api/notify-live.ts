// Vercel serverless function (Node runtime). Web Push when a creator goes
// live — notifies ALL of their followers so they don't miss the stream.
// Followers are resolved server-side (service role) from the follows table.
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const DEFAULT_VAPID_PUBLIC_KEY =
  'BOF26O-X3sFWnutN81XVOwg7VdlMVetGvXCCpuU1cXvcPb8X8CpNHigfhM-U0YCMg7Om0aEd-JyGGnTo2WJSZAI';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublic = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:noreply@example.com';

  if (!supabaseUrl || !serviceRoleKey || !vapidPrivate) {
    res.status(500).json({ error: 'Push notifications are not configured on the server.' });
    return;
  }

  const { streamerId, streamerName, streamerAvatar, liveId } = req.body || {};
  if (!streamerId) {
    res.status(400).json({ error: 'Missing streamerId.' });
    return;
  }

  const authHeader = req.headers?.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'Missing Authorization bearer token.' });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user || authData.user.id !== streamerId) {
    res.status(401).json({ error: 'Invalid session.' });
    return;
  }

  // Who follows this creator?
  const { data: followerRows, error: followErr } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('following_id', streamerId);
  if (followErr) {
    res.status(500).json({ error: followErr.message });
    return;
  }
  const followerIds = (followerRows || []).map((r: any) => r.follower_id);
  if (!followerIds.length) {
    res.status(200).json({ sent: 0 });
    return;
  }

  const { data: subscriptions, error: subError } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', followerIds);

  if (subError) {
    res.status(500).json({ error: subError.message });
    return;
  }
  if (!subscriptions?.length) {
    res.status(200).json({ sent: 0 });
    return;
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const payload = JSON.stringify({
    type: 'live-started',
    streamerId,
    liveId: liveId || null,
    streamerName: streamerName || 'Alguien',
    streamerAvatar: streamerAvatar || null,
  });

  let sent = 0;
  const staleIds: string[] = [];
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent += 1;
      } catch (error: any) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          staleIds.push(sub.id);
        } else {
          console.warn('[notify-live] push send failed:', error?.message || error);
        }
      }
    }),
  );
  if (staleIds.length) {
    await supabase.from('push_subscriptions').delete().in('id', staleIds);
  }
  res.status(200).json({ sent });
}

// Vercel serverless function (Node runtime). Sends a Web Push
// notification for a new direct message so the recipient's phone gets a
// real, native OS notification even when the app/tab is closed or
// backgrounded — the in-app Supabase Realtime subscription (see
// src/data/messages.ts) only reaches a tab that's already open on the
// messages screen.
//
// Mirrors api/notify-call.ts. Same server-only env vars:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@example.com)
//   SUPABASE_URL (or VITE_SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY (needed to read the recipient's push subs
//     under RLS)
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublic = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || 'BOF26O-X3sFWnutN81XVOwg7VdlMVetGvXCCpuU1cXvcPb8X8CpNHigfhM-U0YCMg7Om0aEd-JyGGnTo2WJSZAI';
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:noreply@example.com';

  if (!supabaseUrl || !serviceRoleKey || !vapidPublic || !vapidPrivate) {
    res.status(500).json({ error: 'Push notifications are not configured on the server.' });
    return;
  }

  const { recipientId, senderId, senderName, senderAvatar, preview } = req.body || {};
  if (!recipientId || !senderId) {
    res.status(400).json({ error: 'Missing recipientId or senderId.' });
    return;
  }

  // Verify the request comes from the authenticated sender, so nobody can
  // spam push notifications at other users.
  const authHeader = req.headers?.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'Missing Authorization bearer token.' });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user || authData.user.id !== senderId) {
    res.status(401).json({ error: 'Invalid session.' });
    return;
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const { data: subscriptions, error: subError } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', recipientId);

  if (subError) {
    res.status(500).json({ error: subError.message });
    return;
  }
  if (!subscriptions?.length) {
    res.status(200).json({ sent: 0 });
    return;
  }

  const payload = JSON.stringify({
    type: 'new-message',
    senderId,
    senderName: senderName || 'Nuevo mensaje',
    senderAvatar: senderAvatar || null,
    preview: (preview || '').slice(0, 140),
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
        // 404/410 = dead subscription — prune it.
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          staleIds.push(sub.id);
        } else {
          console.warn('[notify-message] push send failed:', error?.message || error);
        }
      }
    }),
  );

  if (staleIds.length) {
    await supabase.from('push_subscriptions').delete().in('id', staleIds);
  }

  res.status(200).json({ sent });
}

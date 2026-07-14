// Vercel serverless function (Node runtime). Sends a Web Push
// notification so an incoming call rings even when the callee's app/tab
// is closed or backgrounded — the in-app Supabase Realtime broadcast
// (see src/data/calls.ts) only reaches a tab that's already open.
//
// Requires these env vars set in Vercel (server-only — NEVER prefix them
// with VITE_, or Vite would bundle them into client JS):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@example.com)
//   SUPABASE_URL (or VITE_SUPABASE_URL — either is read below)
//   SUPABASE_SERVICE_ROLE_KEY (Project Settings → API → service_role —
//     bypasses RLS; that's required here to read another user's stored
//     push subscriptions, which regular users can't do under RLS)
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublic = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:noreply@example.com';

  if (!supabaseUrl || !serviceRoleKey || !vapidPublic || !vapidPrivate) {
    res.status(500).json({ error: 'Push notifications are not configured on the server.' });
    return;
  }

  const { calleeId, callId, callerId, callerName, callerAvatar } = req.body || {};
  if (!calleeId || !callId || !callerId) {
    res.status(400).json({ error: 'Missing calleeId, callId or callerId.' });
    return;
  }

  // Verify the request actually comes from an authenticated Supabase user
  // matching the claimed callerId, so nobody can spam pushes at will.
  const authHeader = req.headers?.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'Missing Authorization bearer token.' });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user || authData.user.id !== callerId) {
    res.status(401).json({ error: 'Invalid session.' });
    return;
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const { data: subscriptions, error: subError } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', calleeId);

  if (subError) {
    res.status(500).json({ error: subError.message });
    return;
  }
  if (!subscriptions?.length) {
    res.status(200).json({ sent: 0 });
    return;
  }

  const payload = JSON.stringify({
    type: 'incoming-call',
    callId,
    callerId,
    callerName: callerName || 'Alguien',
    callerAvatar: callerAvatar || null,
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
        // 404/410 = the subscription is dead (uninstalled, permission
        // revoked, etc.) — prune it so we stop trying in the future.
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          staleIds.push(sub.id);
        } else {
          console.warn('[notify-call] push send failed:', error?.message || error);
        }
      }
    }),
  );

  if (staleIds.length) {
    await supabase.from('push_subscriptions').delete().in('id', staleIds);
  }

  res.status(200).json({ sent });
}

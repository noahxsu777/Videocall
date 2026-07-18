// Vercel serverless function (Node runtime). Sends a TEST Web Push to the
// authenticated user's own devices so they can verify end-to-end that push
// notifications work — and, when they don't, get a precise reason instead
// of silence. Used by the "Probar notificación" button in Settings.
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const DEFAULT_VAPID_PUBLIC_KEY =
  'BOF26O-X3sFWnutN81XVOwg7VdlMVetGvXCCpuU1cXvcPb8X8CpNHigfhM-U0YCMg7Om0aEd-JyGGnTo2WJSZAI';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, reason: 'method_not_allowed' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublic = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:noreply@example.com';

  // Precise config diagnostics so the user knows WHICH secret is missing.
  const missing: string[] = [];
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!vapidPrivate) missing.push('VAPID_PRIVATE_KEY');
  if (missing.length) {
    res.status(200).json({ ok: false, reason: 'server_not_configured', missing });
    return;
  }

  const authHeader = req.headers?.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    res.status(401).json({ ok: false, reason: 'no_token' });
    return;
  }

  const supabase = createClient(supabaseUrl as string, serviceRoleKey as string);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) {
    res.status(401).json({ ok: false, reason: 'invalid_session' });
    return;
  }
  const userId = authData.user.id;

  const { data: subscriptions, error: subError } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (subError) {
    res.status(200).json({ ok: false, reason: 'db_error', detail: subError.message });
    return;
  }
  if (!subscriptions?.length) {
    res.status(200).json({ ok: false, reason: 'no_subscription' });
    return;
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic as string, vapidPrivate as string);

  const payload = JSON.stringify({
    type: 'new-message',
    senderId: userId,
    senderName: 'Hype Call',
    senderAvatar: null,
    preview: '✅ Las notificaciones funcionan',
  });

  let sent = 0;
  const staleIds: string[] = [];
  const errors: string[] = [];
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
          errors.push(String(error?.statusCode || error?.message || error));
        }
      }
    }),
  );
  if (staleIds.length) {
    await supabase.from('push_subscriptions').delete().in('id', staleIds);
  }

  if (sent > 0) {
    res.status(200).json({ ok: true, sent });
  } else if (staleIds.length) {
    res.status(200).json({ ok: false, reason: 'subscription_expired' });
  } else {
    res.status(200).json({ ok: false, reason: 'send_failed', errors });
  }
}

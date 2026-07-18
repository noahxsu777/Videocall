import { supabase } from '../auth/supabase';

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase no está configurado.');
  }
  return supabase;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64Safe);
  return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
}

export const isPushSupported =
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

// The VAPID PUBLIC key is not secret — it's sent to the browser anyway — so
// we bake it in as a default. This means push works out of the box without
// needing VITE_VAPID_PUBLIC_KEY set at build time (a common reason no
// device ever subscribed). Only the matching PRIVATE key must live in the
// Vercel server env (VAPID_PRIVATE_KEY). Set VITE_VAPID_PUBLIC_KEY to
// override if you rotate to a different keypair.
const DEFAULT_VAPID_PUBLIC_KEY =
  'BOF26O-X3sFWnutN81XVOwg7VdlMVetGvXCCpuU1cXvcPb8X8CpNHigfhM-U0YCMg7Om0aEd-JyGGnTo2WJSZAI';

/**
 * Ask for notification permission and register this device to receive
 * Web Push (incoming-call ringing even when the app/tab is closed). Saves
 * the subscription under the user's own row — best-effort, silently
 * no-ops if the browser doesn't support push or the user denies.
 */
export async function subscribeToPush(userId: string): Promise<void> {
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;
  if (!isPushSupported || !publicKey) {
    return;
  }
  try {
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return;
      }
    } else if (Notification.permission !== 'granted') {
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return;
    }
    const client = requireClient();
    await client.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
      { onConflict: 'endpoint' },
    );
  } catch (error) {
    console.warn('[push] subscribe failed:', error);
  }
}

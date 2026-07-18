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

/** Current notification permission as a simple label for the UI. */
export function notificationPermission(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (!isPushSupported || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  return Notification.permission as 'granted' | 'denied' | 'default';
}

/**
 * Ask for notification permission FROM A USER GESTURE (a button tap) and
 * register this device. Browsers ignore an auto-request on page load, which
 * is why the prompt never appeared — this must be called from a click.
 */
export async function enableNotifications(userId: string): Promise<{ ok: boolean; message: string }> {
  if (!isPushSupported || typeof Notification === 'undefined') {
    return { ok: false, message: 'Este navegador no soporta notificaciones. En iPhone, instala primero la app en la pantalla de inicio (Compartir → Añadir a inicio) y ábrela desde ahí.' };
  }
  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission === 'denied') {
    return { ok: false, message: 'Notificaciones bloqueadas. Ábrelas en los ajustes del navegador/app para este sitio y vuelve a intentarlo.' };
  }
  if (permission !== 'granted') {
    return { ok: false, message: 'No se concedió el permiso de notificaciones.' };
  }
  await subscribeToPush(userId);
  return { ok: true, message: '✅ Notificaciones activadas en este dispositivo.' };
}

/**
 * Verify the whole push chain end-to-end and return a human message:
 * requests permission + (re)subscribes this device, then asks the server to
 * send a test push back. Used by the "Probar notificación" button so the
 * user (and we) can see exactly where it breaks.
 */
export async function testPushNotification(userId: string): Promise<{ ok: boolean; message: string }> {
  if (!isPushSupported) {
    return { ok: false, message: 'Este navegador no soporta notificaciones push. En iPhone, primero instala la app en la pantalla de inicio.' };
  }
  // Ensure permission + a saved subscription first.
  if (Notification.permission !== 'granted') {
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (permission !== 'granted') {
      return { ok: false, message: 'No diste permiso de notificaciones. Actívalo en los ajustes del navegador/app para este sitio.' };
    }
  }
  await subscribeToPush(userId);

  let token = '';
  try {
    const { data } = await requireClient().auth.getSession();
    token = data.session?.access_token || '';
  } catch {
    // ignore
  }
  if (!token) {
    return { ok: false, message: 'No hay sesión activa. Inicia sesión e inténtalo de nuevo.' };
  }

  try {
    const res = await fetch('/api/notify-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (data?.ok) {
      return { ok: true, message: '✅ Enviada. Deberías ver la notificación en unos segundos (si la app está en segundo plano).' };
    }
    switch (data?.reason) {
      case 'server_not_configured':
        return { ok: false, message: `El servidor no tiene configurados: ${(data.missing || []).join(', ')}. Agrégalos en Vercel → Settings → Environment Variables y vuelve a desplegar.` };
      case 'no_subscription':
        return { ok: false, message: 'Este dispositivo no está registrado para push. Da permiso de notificaciones y reintenta.' };
      case 'subscription_expired':
        return { ok: false, message: 'La suscripción de este dispositivo caducó. Reintenta (se volverá a registrar).' };
      default:
        return { ok: false, message: `No se pudo enviar (${data?.reason || 'error'}). Revisa las variables de entorno del servidor.` };
    }
  } catch (error: any) {
    return { ok: false, message: `Error de red al probar: ${error?.message || error}` };
  }
}

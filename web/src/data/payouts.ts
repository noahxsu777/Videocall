// Client for the Stripe endpoints (see web/api/stripe-*.js). Single
// currency model: users BUY Coins (Checkout), gift them in lives, and
// creators WITHDRAW the same Coins (Connect Express — works for Perú via
// cross-border recipient accounts).
import { supabase } from '../auth/supabase';

export interface CoinPack {
  id: string;
  coins: number;
  usd: number;
}

export interface PayoutStatus {
  configured: boolean; // server has STRIPE_SECRET_KEY
  connected: boolean;
  detailsSubmitted?: boolean;
  payoutsEnabled?: boolean;
  coins: number;
  coinsPerUsd: number;
  minPayoutCoins: number;
  payoutFeePercent: number;
  packs: CoinPack[];
}

// Mirror of the server's COIN_PACKS — shown before the status call
// resolves; the server list (from stripe-status) always wins.
export const DEFAULT_PACKS: CoinPack[] = [
  { id: 's', coins: 100, usd: 0.99 },
  { id: 'm', coins: 550, usd: 4.99 },
  { id: 'l', coins: 1200, usd: 9.99 },
  { id: 'xl', coins: 2600, usd: 19.99 },
  { id: 'xxl', coins: 7000, usd: 49.99 },
];

async function authedPost(path: string, body?: unknown): Promise<any> {
  const { data } = await supabase!.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('No hay sesión activa.');
  }
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await res.text();
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`El servidor falló (HTTP ${res.status}).`);
  }
}

/** Payout status for the Saldo screen. Never throws for "not configured". */
export async function getPayoutStatus(): Promise<PayoutStatus> {
  const fallback: PayoutStatus = {
    configured: false,
    connected: false,
    coins: 0,
    coinsPerUsd: 200,
    minPayoutCoins: 2000,
    payoutFeePercent: 10,
    packs: DEFAULT_PACKS,
  };
  try {
    const data = await authedPost('/api/stripe-status');
    if (data?.reason === 'server_not_configured') {
      return fallback;
    }
    return {
      configured: true,
      connected: !!data?.connected,
      detailsSubmitted: data?.detailsSubmitted,
      payoutsEnabled: data?.payoutsEnabled,
      coins: data?.coins ?? 0,
      coinsPerUsd: data?.coinsPerUsd ?? 200,
      minPayoutCoins: data?.minPayoutCoins ?? 2000,
      payoutFeePercent: data?.payoutFeePercent ?? 10,
      packs: Array.isArray(data?.packs) && data.packs.length ? data.packs : DEFAULT_PACKS,
    };
  } catch {
    return fallback;
  }
}

/** Start (or resume) Stripe onboarding; returns the hosted-flow URL. */
export async function connectPayoutAccount(country = 'PE'): Promise<string> {
  const data = await authedPost('/api/stripe-connect', { country });
  if (data?.ok && data.url) {
    return data.url as string;
  }
  if (data?.reason === 'server_not_configured') {
    throw new Error('Los retiros aún no están habilitados (falta configurar Stripe en el servidor).');
  }
  throw new Error(data?.detail || data?.reason || 'No se pudo iniciar la conexión con Stripe.');
}

/** Withdraw the coin balance. Returns a human result message. */
export async function requestPayout(): Promise<{ ok: boolean; message: string }> {
  const data = await authedPost('/api/stripe-payout');
  if (data?.ok) {
    const warn = data.warning ? ' (aviso interno registrado)' : '';
    const fee = data.feeUsd ? ` (comisión: $${Number(data.feeUsd).toFixed(2)})` : '';
    return { ok: true, message: `✅ Retiro enviado: $${Number(data.paidUsd).toFixed(2)} USD a tu cuenta${fee}.${warn}` };
  }
  switch (data?.reason) {
    case 'not_connected':
      return { ok: false, message: 'Primero conecta tu cuenta de retiro.' };
    case 'below_minimum':
      return { ok: false, message: `Necesitas al menos ${Number(data.minPayoutCoins || 2000).toLocaleString()} 🪙 para retirar (tienes ${Number(data.coins || 0).toLocaleString()}).` };
    case 'onboarding_incomplete':
      return { ok: false, message: 'Tu cuenta de retiro aún está en verificación. Completa los pasos de Stripe y reintenta.' };
    case 'platform_balance_insufficient':
      return { ok: false, message: 'La plataforma no tiene fondos suficientes en este momento. Intenta más tarde.' };
    case 'server_not_configured':
      return { ok: false, message: 'Los retiros aún no están habilitados.' };
    default:
      return { ok: false, message: `No se pudo procesar el retiro (${data?.detail || data?.reason || 'error'}).` };
  }
}

/** Start a coin-pack purchase; returns the Stripe Checkout URL. */
export async function buyCoinPack(packId: string): Promise<string> {
  const data = await authedPost('/api/stripe-checkout', { pack: packId });
  if (data?.ok && data.url) {
    return data.url as string;
  }
  if (data?.reason === 'server_not_configured') {
    throw new Error('La compra de Coins aún no está habilitada.');
  }
  throw new Error(data?.detail || data?.reason || 'No se pudo iniciar la compra.');
}

/** Credit a completed Checkout session (idempotent server-side). */
export async function verifyCoinPurchase(sessionId: string): Promise<{ ok: boolean; message: string; newBalance?: number }> {
  const data = await authedPost('/api/stripe-checkout-verify', { sessionId });
  if (data?.ok && data.alreadyCredited) {
    return { ok: true, message: 'Esta compra ya estaba acreditada.' };
  }
  if (data?.ok) {
    return { ok: true, message: `✅ ¡Compra exitosa! +${Number(data.coins).toLocaleString()} 🪙 añadidos.`, newBalance: data.newBalance };
  }
  if (data?.reason === 'not_paid') {
    return { ok: false, message: 'El pago no se completó.' };
  }
  return { ok: false, message: `No se pudo acreditar la compra (${data?.detail || data?.reason || 'error'}).` };
}

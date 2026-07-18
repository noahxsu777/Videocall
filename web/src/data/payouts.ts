// Client for the Stripe Connect payout endpoints (see web/api/stripe-*.js).
// Creators connect an Express "recipient" account (works for Perú and other
// cross-border countries) and withdraw their diamond earnings.
import { supabase } from '../auth/supabase';

export interface PayoutStatus {
  configured: boolean; // server has STRIPE_SECRET_KEY
  connected: boolean;
  detailsSubmitted?: boolean;
  payoutsEnabled?: boolean;
  diamonds: number;
  diamondsPerUsd: number;
  minPayoutDiamonds: number;
  payoutFeePercent: number;
}

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
    diamonds: 0,
    diamondsPerUsd: 200,
    minPayoutDiamonds: 1000,
    payoutFeePercent: 10,
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
      diamonds: data?.diamonds ?? 0,
      diamondsPerUsd: data?.diamondsPerUsd ?? 200,
      minPayoutDiamonds: data?.minPayoutDiamonds ?? 1000,
      payoutFeePercent: data?.payoutFeePercent ?? 10,
    };
  } catch {
    return fallback;
  }
}

/** Start (or resume) Stripe onboarding; navigates to Stripe's hosted flow. */
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

/** Withdraw the accumulated diamonds. Returns a human result message. */
export async function requestPayout(): Promise<{ ok: boolean; message: string }> {
  const data = await authedPost('/api/stripe-payout');
  if (data?.ok) {
    const warn = data.warning ? ' (aviso interno registrado)' : '';
    const fee = data.feeUsd ? ` (comisión de retiro: $${Number(data.feeUsd).toFixed(2)})` : '';
    return { ok: true, message: `✅ Retiro enviado: $${Number(data.paidUsd).toFixed(2)} USD a tu cuenta${fee}.${warn}` };
  }
  switch (data?.reason) {
    case 'not_connected':
      return { ok: false, message: 'Primero conecta tu cuenta de retiro.' };
    case 'below_minimum':
      return { ok: false, message: `Necesitas al menos ${data.minPayoutDiamonds?.toLocaleString?.() || data.minPayoutDiamonds} 💎 para retirar (tienes ${data.diamonds?.toLocaleString?.() || data.diamonds}).` };
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

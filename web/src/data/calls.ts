import { supabase } from '../auth/supabase';

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase no está configurado.');
  }
  return supabase;
}

export const DEFAULT_CALL_RATE = 100;
export const DEFAULT_STARTER_COINS = 500;

/** Coins per minute this user charges callers for incoming calls. */
export async function getCallRate(userId: string): Promise<number> {
  const client = requireClient();
  const { data, error } = await client.from('profiles').select('call_rate').eq('id', userId).maybeSingle();
  if (error) {
    console.warn('[calls] getCallRate failed:', error.message);
  }
  return (data as any)?.call_rate ?? DEFAULT_CALL_RATE;
}

export async function setCallRate(userId: string, ratePerMinute: number): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from('profiles')
    .update({ call_rate: Math.max(0, Math.round(ratePerMinute)) })
    .eq('id', userId);
  if (error) {
    throw new Error(error.message);
  }
}

export async function getCoins(userId: string): Promise<number> {
  const client = requireClient();
  const { data, error } = await client.from('profiles').select('coins').eq('id', userId).maybeSingle();
  if (error) {
    console.warn('[calls] getCoins failed:', error.message);
  }
  return (data as any)?.coins ?? 0;
}

/**
 * Best-effort coin transfer for a billed slice of call time (client-side
 * read-modify-write — fine at this app's scale, not race-condition-proof
 * under concurrent charges for the same user). Charges at most the
 * payer's current balance. Returns the payer's new balance.
 */
export async function transferCoins(payerId: string, payeeId: string, amount: number): Promise<number> {
  const rounded = Math.round(amount);
  if (rounded <= 0) {
    return getCoins(payerId);
  }
  const client = requireClient();
  const payerCoins = await getCoins(payerId);
  const charge = Math.min(payerCoins, rounded);
  if (charge <= 0) {
    return payerCoins;
  }
  const payeeCoins = await getCoins(payeeId);
  await Promise.all([
    client.from('profiles').update({ coins: payerCoins - charge }).eq('id', payerId),
    client.from('profiles').update({ coins: payeeCoins + charge }).eq('id', payeeId),
  ]);
  return payerCoins - charge;
}

// ---------- Realtime call signaling (Supabase Realtime Broadcast) ----------
// No separate signaling server / PeerJS broker needed — we already run
// Supabase for everything else in this app, so SDP offers/answers and ICE
// candidates travel over a per-call broadcast channel, and incoming-call
// "ringing" travels over each user's own personal channel.

export interface IncomingCallPayload {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar: string | null;
}

/** Each user's own channel — where invites/cancels for THEM are broadcast. */
export function personalRingChannel(userId: string) {
  const client = requireClient();
  return client.channel(`calls:${userId}`, { config: { broadcast: { self: false } } });
}

/** Per-call channel — both participants join this to exchange SDP/ICE. */
export function joinCallChannel(callId: string) {
  const client = requireClient();
  return client.channel(`call-signal:${callId}`, { config: { broadcast: { self: false } } });
}

/** Wait for a channel to reach SUBSCRIBED, with a safety timeout. */
function waitSubscribed(channel: ReturnType<typeof personalRingChannel>, timeoutMs = 4000): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(false);
      }
    }, timeoutMs);
    channel.subscribe((status) => {
      if (!settled && status === 'SUBSCRIBED') {
        settled = true;
        window.clearTimeout(timer);
        resolve(true);
      }
    });
  });
}

/** Ring the callee: briefly join their personal channel to send one invite. */
export async function ringUser(calleeId: string, invite: IncomingCallPayload): Promise<void> {
  const channel = personalRingChannel(calleeId);
  const ok = await waitSubscribed(channel);
  if (ok) {
    await channel.send({ type: 'broadcast', event: 'invite', payload: invite });
  }
  window.setTimeout(() => channel.unsubscribe(), 300);
}

/** Caller-side cancel: tell the callee's ring channel to dismiss the invite. */
export async function cancelRing(calleeId: string, callId: string): Promise<void> {
  const channel = personalRingChannel(calleeId);
  const ok = await waitSubscribed(channel);
  if (ok) {
    await channel.send({ type: 'broadcast', event: 'cancel', payload: { callId } });
  }
  window.setTimeout(() => channel.unsubscribe(), 300);
}

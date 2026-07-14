import { ref } from 'vue';
import { useAuth } from '../auth/useAuth';
import { personalRingChannel, joinCallChannel, type IncomingCallPayload } from '../data/calls';

// Module-singleton: one ring subscription per app session, shared by
// whatever mounts <IncomingCallOverlay> (App.vue) and whoever reads
// `incomingCall` elsewhere.
const incomingCall = ref<IncomingCallPayload | null>(null);
let ringChannel: ReturnType<typeof personalRingChannel> | null = null;
let subscribedForUserId: string | null = null;

export function useIncomingCalls() {
  const { user } = useAuth();

  function start() {
    const myId = user.value?.id;
    if (!myId || subscribedForUserId === myId) {
      return;
    }
    subscribedForUserId = myId;
    ringChannel = personalRingChannel(myId);
    ringChannel
      .on('broadcast', { event: 'invite' }, ({ payload }: { payload: IncomingCallPayload }) => {
        incomingCall.value = payload;
      })
      .on('broadcast', { event: 'cancel' }, ({ payload }: { payload: { callId: string } }) => {
        if (incomingCall.value?.callId === payload?.callId) {
          incomingCall.value = null;
        }
      })
      .subscribe();
  }

  function decline() {
    const call = incomingCall.value;
    incomingCall.value = null;
    if (!call) {
      return;
    }
    // Let the caller (already waiting on the per-call channel) know we
    // declined so their screen stops ringing immediately.
    const channel = joinCallChannel(call.callId);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({ type: 'broadcast', event: 'signal', payload: { type: 'declined' } });
        window.setTimeout(() => channel.unsubscribe(), 400);
      }
    });
  }

  function clear() {
    incomingCall.value = null;
  }

  /**
   * Restore an incoming-call ring from outside the realtime channel —
   * used when a Web Push notification (app closed/backgrounded) is what
   * actually woke this page up, so the normal broadcast was never seen
   * by this tab. See main.ts's serviceWorker message listener and
   * App.vue's `?incomingCall=` cold-start deep link.
   */
  function restore(payload: IncomingCallPayload) {
    incomingCall.value = payload;
  }

  return { incomingCall, start, decline, clear, restore };
}

<template>
  <div class="call-screen">
    <!-- Remote video fills the screen once connected -->
    <video
      v-show="state === 'connected'"
      ref="remoteVideoEl"
      class="remote-video"
      autoplay
      playsinline
    />

    <!-- Waiting / connecting / ended states -->
    <div v-if="state !== 'connected'" class="status-layer">
      <div class="status-avatar-wrap">
        <span v-if="state === 'ringing' || state === 'connecting'" class="status-pulse p1" />
        <span v-if="state === 'ringing' || state === 'connecting'" class="status-pulse p2" />
        <span class="status-avatar">
          <img v-if="peerAvatar" :src="peerAvatar" alt="" />
          <span v-else>{{ initial }}</span>
        </span>
      </div>
      <h2 class="status-name">{{ peerName || 'Usuario' }}</h2>
      <p class="status-text">{{ statusText }}</p>
      <div v-if="state === 'ringing' || state === 'connecting'" class="status-spinner" />
    </div>

    <!-- Local self-view PiP (mirrored, FaceTime-style) -->
    <div v-show="state === 'connected' || state === 'connecting'" class="local-pip" :class="{ 'cam-off': !camOn }">
      <video ref="localVideoEl" autoplay playsinline muted class="local-video" />
      <span v-if="!camOn" class="local-pip-off">📷</span>
    </div>

    <!-- Top bar -->
    <div class="top-bar">
      <span class="top-name">{{ peerName || 'Usuario' }}</span>
      <span v-if="state === 'connected'" class="top-timer">{{ durationLabel }}</span>
      <!-- Host (callee) sees what they're earning live during the call. -->
      <span v-if="!isPayer && state === 'connected'" class="top-earn">🪙 +{{ coinsEarned.toLocaleString() }}</span>
    </div>

    <!-- Coin meter (payer only) -->
    <div v-if="isPayer && state === 'connected'" class="coin-meter">
      💰 {{ ratePerMinute }}/min · Saldo {{ myCoins }}
    </div>

    <!-- Gift received toast (host side) -->
    <Transition name="gift-pop">
      <div v-if="giftToast" class="gift-toast">
        <span class="gift-toast-ico">
          <img v-if="giftToast.kind === 'image'" :src="giftToast.icon" alt="" />
          <LottieIcon v-else-if="giftToast.kind === 'lottie'" :src="giftToast.icon" :size="28" />
          <template v-else>{{ giftToast.icon }}</template>
        </span>
        <span class="gift-toast-text">{{ peerName || 'Alguien' }} te envió +{{ giftToast.coins }} 🪙</span>
      </div>
    </Transition>

    <!-- Bottom controls -->
    <div v-if="state !== 'ended'" class="bottom-controls">
      <button
        v-if="state === 'connected'"
        class="ctrl-btn"
        :class="{ off: !micOn }"
        @click="toggleMic"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="#fff"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z"/><path d="M19 11a7 7 0 0 1-14 0H3a9 9 0 0 0 8 8.94V22h2v-2.06A9 9 0 0 0 21 11h-2Z"/></svg>
        <span v-if="!micOn" class="ctrl-slash" />
      </button>
      <button
        v-if="state === 'connected'"
        class="ctrl-btn"
        :class="{ off: !camOn }"
        @click="toggleCam"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="#fff"><path d="M17 10.5V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3.5l4 4v-11l-4 4Z"/></svg>
        <span v-if="!camOn" class="ctrl-slash" />
      </button>
      <button
        v-if="state === 'connected'"
        class="ctrl-btn"
        :class="{ off: !speakerOn }"
        @click="toggleSpeaker"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="#fff"><path d="M5 9v6h4l5 5V4L9 9H5Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
      </button>
      <button
        v-if="state === 'connected'"
        class="ctrl-btn"
        @click="flipCamera"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2.1 21 6l-4 3.9"/><path d="M3 12a9 9 0 0 1 15-6.7L21 6"/><path d="m7 21.9-4-3.9 4-3.9"/><path d="M21 12a9 9 0 0 1-15 6.7L3 18"/></svg>
      </button>

      <!-- Gift button: the payer can tip the host on top of the per-minute
           rate, same idea as gifting a streamer during a live. -->
      <button
        v-if="isPayer && state === 'connected'"
        class="ctrl-btn gift-btn"
        @click="giftSheetOpen = true"
      >
        <span class="gift-btn-emoji">🎁</span>
      </button>

      <button class="ctrl-btn hangup" @click="hangup">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="#fff"><path d="M12 3C6.8 3 2.7 5.4 1 9.2c-.3.7-.1 1.5.5 2l2.7 2.2c.6.5 1.4.5 2 .1l2-1.4c.4-.3.6-.8.5-1.3l-.5-2c1.7-.6 3.7-.6 5.4 0l-.5 2c-.1.5.1 1 .5 1.3l2 1.4c.6.4 1.4.4 2-.1l2.7-2.2c.6-.5.8-1.3.5-2C21.3 5.4 17.2 3 12 3Z" transform="rotate(135 12 12)"/></svg>
      </button>
    </div>

    <!-- Gift picker sheet -->
    <Transition name="sheet">
      <div v-if="giftSheetOpen" class="gift-sheet-backdrop" @click.self="giftSheetOpen = false">
        <div class="gift-sheet">
          <div class="gift-sheet-grab" />
          <p class="gift-sheet-title">Enviar regalo · Saldo {{ myCoins.toLocaleString() }} 🪙</p>
          <div class="gift-options">
            <button
              v-for="g in GIFT_PRESETS"
              :key="g.coins"
              class="gift-option"
              :disabled="sendingGift || myCoins < g.coins"
              @click="sendGift(g)"
            >
              <span class="gift-option-ico">
                <img v-if="g.kind === 'image'" :src="g.icon" alt="" />
                <LottieIcon v-else-if="g.kind === 'lottie'" :src="g.icon" :size="34" />
                <template v-else>{{ g.icon }}</template>
              </span>
              <span class="gift-option-coins">{{ g.coins }} 🪙</span>
            </button>
          </div>
          <button class="gift-sheet-cancel" @click="giftSheetOpen = false">Cancelar</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '../auth/useAuth';
import { getProfile } from '../data/profiles';
import { joinCallChannel, getCallRate, getCoins, transferCoins, cancelRing } from '../data/calls';
import LottieIcon from '../components/LottieIcon.vue';

type CallState = 'ringing' | 'connecting' | 'connected' | 'ended';

const route = useRoute();
const router = useRouter();
const { user } = useAuth();

const callId = route.params.callId as string;
const peerId = (route.query.peer as string) || '';
const role = ((route.query.role as string) || 'caller') as 'caller' | 'callee';

const myId = computed(() => user.value?.id || '');
const isPayer = computed(() => role === 'caller');

const peerName = ref((route.query.name as string) || '');
const peerAvatar = ref<string | null>(null);
const initial = computed(() => (peerName.value || '?').charAt(0).toUpperCase());

const state = ref<CallState>(role === 'callee' ? 'connecting' : 'ringing');
const endReason = ref('');
const statusText = computed(() => {
  switch (endReason.value) {
    case 'declined': return 'Llamada rechazada';
    case 'no-answer': return 'Nadie contestó';
    case 'peer-hangup': return 'Llamada finalizada';
    case 'no-coins': return 'Sin saldo suficiente';
    case 'no-media': return 'No se pudo acceder a la cámara';
    case 'failed': return 'No se pudo conectar';
    case 'self-hangup': return 'Llamada finalizada';
    default: break;
  }
  if (state.value === 'ringing') {
    return 'Llamando…';
  }
  if (state.value === 'connecting') {
    return 'Conectando…';
  }
  return '';
});

const localVideoEl = ref<HTMLVideoElement | null>(null);
const remoteVideoEl = ref<HTMLVideoElement | null>(null);

const micOn = ref(true);
const camOn = ref(true);
const speakerOn = ref(true);
const facingMode = ref<'user' | 'environment'>('user');

const ratePerMinute = ref(100);
const myCoins = ref(0);
// What the HOST (callee) has earned so far this call — per-minute charges
// plus any gifts — updated live from 'earn'/'gift' broadcasts on the
// signaling channel, no polling needed.
const coinsEarned = ref(0);
const elapsedSeconds = ref(0);
const durationLabel = computed(() => {
  const m = Math.floor(elapsedSeconds.value / 60).toString().padStart(2, '0');
  const s = (elapsedSeconds.value % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
});

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];
const BILL_INTERVAL_SECONDS = 10;

// --- Gifts during a call: the payer can tip the host on top of the
// per-minute rate. Reuses the same atomic transfer_call_coins RPC as
// billing, so gifts land straight in the host's withdrawable balance and
// show up in Transacciones -> Ganancias like any other call earning.
type GiftKind = 'emoji' | 'image' | 'lottie';
interface GiftPreset { kind: GiftKind; icon: string; coins: number }
const GIFT_PRESETS: GiftPreset[] = [
  { kind: 'image', icon: 'https://cdn3.emoji.gg/emojis/2071-heart-eyes.png', coins: 50 },
  { kind: 'emoji', icon: '🎉', coins: 100 },
  { kind: 'emoji', icon: '💎', coins: 500 },
  { kind: 'emoji', icon: '👑', coins: 1000 },
  { kind: 'lottie', icon: 'https://lottie.host/cd4c56a4-dbe3-484c-903d-b21f15c934e7/JtQ5tcpSNL.lottie', coins: 2000 },
];
const giftSheetOpen = ref(false);
const sendingGift = ref(false);
const giftToast = ref<{ kind: GiftKind; icon: string; coins: number } | null>(null);
let giftToastTimer: number | null = null;

let pc: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let channel: ReturnType<typeof joinCallChannel> | null = null;
let noAnswerTimer: number | null = null;
let durationTimer: number | null = null;
let billingTimer: number | null = null;
let pendingCandidates: RTCIceCandidateInit[] = [];
let madeOffer = false;

async function setupLocalMedia() {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: facingMode.value, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: true,
  });
  if (localVideoEl.value) {
    localVideoEl.value.srcObject = localStream;
  }
}

function createPeerConnection() {
  pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  localStream?.getTracks().forEach((track) => pc!.addTrack(track, localStream!));

  pc.ontrack = (event) => {
    if (remoteVideoEl.value) {
      remoteVideoEl.value.srcObject = event.streams[0];
    }
  };
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      channel?.send({
        type: 'broadcast',
        event: 'signal',
        payload: { type: 'candidate', candidate: event.candidate.toJSON() },
      });
    }
  };
  pc.onconnectionstatechange = () => {
    if (!pc) {
      return;
    }
    if (pc.connectionState === 'connected' && state.value !== 'connected') {
      onConnected();
    } else if (pc.connectionState === 'failed') {
      endCall('failed');
    }
  };
}

function onConnected() {
  state.value = 'connected';
  if (noAnswerTimer) {
    window.clearTimeout(noAnswerTimer);
    noAnswerTimer = null;
  }
  durationTimer = window.setInterval(() => {
    elapsedSeconds.value += 1;
  }, 1000);
  if (isPayer.value) {
    startBilling();
  }
}

function startBilling() {
  billingTimer = window.setInterval(async () => {
    const perTick = ratePerMinute.value * (BILL_INTERVAL_SECONDS / 60);
    const before = myCoins.value;
    try {
      const newBalance = await transferCoins(myId.value, peerId, perTick);
      myCoins.value = newBalance;
      // The RPC caps the charge at whatever the payer actually had, so the
      // real amount charged (and thus what the host earned) can be less
      // than perTick on the last tick before running out — broadcast the
      // true diff so the host's live counter never overshoots.
      const actuallyCharged = Math.max(0, before - newBalance);
      if (actuallyCharged > 0) {
        channel?.send({ type: 'broadcast', event: 'signal', payload: { type: 'earn', coins: actuallyCharged } });
      }
      if (newBalance <= 0) {
        endCall('no-coins');
      }
    } catch (error) {
      console.warn('[call] billing tick failed:', error);
    }
  }, BILL_INTERVAL_SECONDS * 1000);
}

async function sendGift(preset: GiftPreset) {
  if (sendingGift.value || myCoins.value < preset.coins) {
    return;
  }
  sendingGift.value = true;
  try {
    const newBalance = await transferCoins(myId.value, peerId, preset.coins);
    myCoins.value = newBalance;
    channel?.send({
      type: 'broadcast',
      event: 'signal',
      payload: { type: 'gift', kind: preset.kind, icon: preset.icon, coins: preset.coins },
    });
    giftSheetOpen.value = false;
  } catch (error) {
    console.warn('[call] gift send failed:', error);
  } finally {
    sendingGift.value = false;
  }
}

async function createAndSendOffer() {
  if (!pc) {
    return;
  }
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  channel?.send({ type: 'broadcast', event: 'signal', payload: { type: 'offer', sdp: offer } });
}

async function flushCandidates() {
  if (!pc) {
    return;
  }
  for (const candidate of pendingCandidates) {
    await pc.addIceCandidate(candidate).catch(() => {});
  }
  pendingCandidates = [];
}

async function handleSignal(payload: any) {
  if (!payload) {
    return;
  }
  switch (payload.type) {
    case 'ready':
      if (role === 'caller' && !madeOffer) {
        madeOffer = true;
        await createAndSendOffer();
      }
      break;
    case 'offer':
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await flushCandidates();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        channel?.send({ type: 'broadcast', event: 'signal', payload: { type: 'answer', sdp: answer } });
      }
      break;
    case 'answer':
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await flushCandidates();
      }
      break;
    case 'candidate':
      if (pc?.remoteDescription) {
        await pc.addIceCandidate(payload.candidate).catch(() => {});
      } else {
        pendingCandidates.push(payload.candidate);
      }
      break;
    case 'declined':
      endCall('declined');
      break;
    case 'hangup':
      endCall('peer-hangup');
      break;
    case 'earn':
      // Host side only: the payer just billed a tick — bump the live
      // earnings counter without needing to poll the DB.
      if (!isPayer.value && typeof payload.coins === 'number') {
        coinsEarned.value += payload.coins;
      }
      break;
    case 'gift':
      if (!isPayer.value && typeof payload.coins === 'number') {
        coinsEarned.value += payload.coins;
        showGiftToast(payload.kind || 'emoji', payload.icon || '🎁', payload.coins);
      }
      break;
    default:
      break;
  }
}

function showGiftToast(kind: GiftKind, icon: string, coins: number) {
  if (giftToastTimer) {
    window.clearTimeout(giftToastTimer);
  }
  giftToast.value = { kind, icon, coins };
  giftToastTimer = window.setTimeout(() => {
    giftToast.value = null;
    giftToastTimer = null;
  }, 3200);
}

function cleanup() {
  if (durationTimer) {
    window.clearInterval(durationTimer);
    durationTimer = null;
  }
  if (billingTimer) {
    window.clearInterval(billingTimer);
    billingTimer = null;
  }
  if (noAnswerTimer) {
    window.clearTimeout(noAnswerTimer);
    noAnswerTimer = null;
  }
  if (giftToastTimer) {
    window.clearTimeout(giftToastTimer);
    giftToastTimer = null;
  }
  localStream?.getTracks().forEach((track) => track.stop());
  pc?.close();
  pc = null;
  channel?.unsubscribe();
  channel = null;
}

function endCall(reason: string) {
  if (state.value === 'ended') {
    return;
  }
  endReason.value = reason;
  state.value = 'ended';
  cleanup();
  window.setTimeout(() => router.replace('/messages'), 1400);
}

function hangup() {
  channel?.send({ type: 'broadcast', event: 'signal', payload: { type: 'hangup' } });
  if (role === 'caller' && (state.value === 'ringing' || state.value === 'connecting')) {
    cancelRing(peerId, callId);
  }
  endCall('self-hangup');
}

function toggleMic() {
  micOn.value = !micOn.value;
  localStream?.getAudioTracks().forEach((track) => { track.enabled = micOn.value; });
}

function toggleCam() {
  camOn.value = !camOn.value;
  localStream?.getVideoTracks().forEach((track) => { track.enabled = camOn.value; });
}

function toggleSpeaker() {
  speakerOn.value = !speakerOn.value;
}

async function flipCamera() {
  facingMode.value = facingMode.value === 'user' ? 'environment' : 'user';
  try {
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facingMode.value, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    const newTrack = newStream.getVideoTracks()[0];
    const sender = pc?.getSenders().find(s => s.track?.kind === 'video');
    await sender?.replaceTrack(newTrack);
    const oldTrack = localStream?.getVideoTracks()[0];
    if (localStream && oldTrack) {
      localStream.removeTrack(oldTrack);
      oldTrack.stop();
      localStream.addTrack(newTrack);
    }
    if (localVideoEl.value) {
      localVideoEl.value.srcObject = localStream;
    }
  } catch (error) {
    console.warn('[call] flip camera failed:', error);
  }
}

onMounted(async () => {
  if (!myId.value || !peerId) {
    router.replace('/messages');
    return;
  }

  try {
    const [prof, rate, coins] = await Promise.all([
      getProfile(peerId),
      isPayer.value ? getCallRate(peerId) : Promise.resolve(0),
      isPayer.value ? getCoins(myId.value) : Promise.resolve(0),
    ]);
    if (prof) {
      peerName.value = prof.display_name || prof.username || peerName.value || 'Usuario';
      peerAvatar.value = prof.avatar_url || null;
    }
    ratePerMinute.value = rate || 100;
    myCoins.value = coins;
  } catch (error) {
    console.warn('[call] profile/rate load failed:', error);
  }

  try {
    await setupLocalMedia();
  } catch (error) {
    console.warn('[call] getUserMedia failed:', error);
    endCall('no-media');
    return;
  }

  createPeerConnection();

  channel = joinCallChannel(callId);
  channel.on('broadcast', { event: 'signal' }, ({ payload }: any) => {
    handleSignal(payload);
  });
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED' && role === 'callee') {
      state.value = 'connecting';
      channel?.send({ type: 'broadcast', event: 'signal', payload: { type: 'ready' } });
    }
  });

  // Applies to both roles: covers the caller waiting for an answer AND a
  // callee trying to join a call whose other side is no longer around
  // (e.g. tapping an old "join call" bubble from chat history).
  noAnswerTimer = window.setTimeout(() => {
    if (state.value === 'ringing' || state.value === 'connecting') {
      endCall('no-answer');
    }
  }, 35000);
});

onUnmounted(() => {
  if (state.value !== 'ended' && channel) {
    try {
      channel.send({ type: 'broadcast', event: 'signal', payload: { type: 'hangup' } });
    } catch {
      // best-effort
    }
  }
  cleanup();
});
</script>

<style scoped>
.call-screen {
  position: fixed;
  inset: 0;
  z-index: 400;
  background: #050308;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
}

.remote-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #000;
}

.status-layer {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: radial-gradient(120% 100% at 50% 20%, #241a3d 0%, #0b0710 70%);
}
.status-avatar-wrap {
  position: relative;
  width: 132px;
  height: 132px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}
.status-pulse {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid rgba(139, 61, 255, 0.5);
  animation: status-pulse-anim 2s ease-out infinite;
}
.status-pulse.p2 { animation-delay: 1s; }
@keyframes status-pulse-anim {
  0% { transform: scale(0.85); opacity: 0.9; }
  100% { transform: scale(1.5); opacity: 0; }
}
.status-avatar {
  width: 112px;
  height: 112px;
  border-radius: 50%;
  overflow: hidden;
  background: #1a2030;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 42px;
  font-weight: 800;
  color: #7fd7ff;
  border: 2px solid rgba(255, 255, 255, 0.2);
}
.status-avatar img { width: 100%; height: 100%; object-fit: cover; }
.status-name { margin: 4px 0 0; font-size: 24px; font-weight: 700; color: #fff; }
.status-text { margin: 0; font-size: 14px; color: rgba(255, 255, 255, 0.65); }
.status-spinner {
  width: 22px;
  height: 22px;
  margin-top: 10px;
  border: 2.5px solid rgba(255, 255, 255, 0.25);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.local-pip {
  position: absolute;
  top: 70px;
  right: 14px;
  width: 100px;
  height: 148px;
  border-radius: 18px;
  overflow: hidden;
  background: #111;
  border: 1.5px solid rgba(255, 255, 255, 0.25);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.5);
  z-index: 5;
}
.local-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}
.local-pip.cam-off .local-video { visibility: hidden; }
.local-pip-off {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
}

.top-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px 16px 30px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0));
}
.top-name { font-size: 15px; font-weight: 700; color: #fff; }
.top-timer { font-size: 13px; color: rgba(255, 255, 255, 0.7); font-variant-numeric: tabular-nums; }

.coin-meter {
  position: absolute;
  top: 58px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 4;
  padding: 6px 14px;
  border-radius: 16px;
  background: rgba(255, 200, 87, 0.16);
  border: 1px solid rgba(255, 200, 87, 0.4);
  color: #ffe0a3;
  font-size: 12.5px;
  font-weight: 700;
  white-space: nowrap;
}

.bottom-controls {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 18px 20px calc(30px + env(safe-area-inset-bottom, 0));
  background: linear-gradient(0deg, rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0));
}
.ctrl-btn {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: 28px;
  border: none;
  background: rgba(255, 255, 255, 0.16);
  -webkit-backdrop-filter: blur(14px) saturate(160%);
  backdrop-filter: blur(14px) saturate(160%);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.ctrl-btn.off { background: rgba(255, 255, 255, 0.85); }
.ctrl-btn.off svg { fill: #111; }
.ctrl-slash {
  position: absolute;
  width: 2px;
  height: 30px;
  background: #ff3b30;
  transform: rotate(45deg);
  border-radius: 1px;
}
.ctrl-btn.hangup {
  width: 64px;
  height: 64px;
  border-radius: 32px;
  background: #ff3b30;
}

/* Host's live earnings counter, next to the call timer. */
.top-earn {
  padding: 3px 10px;
  border-radius: 12px;
  background: rgba(52, 199, 89, 0.18);
  border: 1px solid rgba(52, 199, 89, 0.4);
  color: #6fe08a;
  font-size: 12.5px;
  font-weight: 800;
  white-space: nowrap;
}

/* Gift toast (host receives a tip) */
.gift-toast {
  position: absolute;
  top: 100px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 22px;
  background: linear-gradient(90deg, rgba(255, 61, 129, 0.9), rgba(155, 45, 247, 0.85));
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  color: #fff;
  font-size: 13.5px;
  font-weight: 700;
  white-space: nowrap;
}
.gift-toast-ico {
  font-size: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.gift-toast-ico img { width: 24px; height: 24px; object-fit: contain; }
.gift-pop-enter-active,
.gift-pop-leave-active {
  transition: transform 0.3s cubic-bezier(0.2, 1.2, 0.3, 1), opacity 0.3s ease;
}
.gift-pop-enter-from,
.gift-pop-leave-to {
  transform: translateX(-50%) translateY(-16px);
  opacity: 0;
}

/* Gift button (bottom controls) */
.gift-btn { background: rgba(255, 200, 87, 0.22); }
.gift-btn-emoji { font-size: 24px; line-height: 1; }

/* Gift picker sheet */
.gift-sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: flex;
  align-items: flex-end;
  background: rgba(0, 0, 0, 0.55);
}
.gift-sheet {
  width: 100%;
  background: #17171c;
  border-radius: 22px 22px 0 0;
  padding: 10px 18px calc(20px + env(safe-area-inset-bottom, 0));
}
.gift-sheet-grab {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.25);
  margin: 6px auto 14px;
}
.gift-sheet-title {
  margin: 0 0 14px;
  text-align: center;
  font-size: 14px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
}
.gift-options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}
.gift-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 6px;
  border-radius: 16px;
  border: 1.5px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  cursor: pointer;
}
.gift-option:disabled { opacity: 0.4; }
.gift-option-ico {
  font-size: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 34px;
}
.gift-option-ico img { width: 30px; height: 30px; object-fit: contain; }
.gift-option-coins { font-size: 12px; font-weight: 700; color: #ffe0a3; }
.gift-sheet-cancel {
  width: 100%;
  height: 46px;
  border: none;
  border-radius: 23px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.2s ease;
}
.sheet-enter-active .gift-sheet,
.sheet-leave-active .gift-sheet {
  transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.sheet-enter-from,
.sheet-leave-to { opacity: 0; }
.sheet-enter-from .gift-sheet,
.sheet-leave-to .gift-sheet { transform: translateY(100%); }
</style>

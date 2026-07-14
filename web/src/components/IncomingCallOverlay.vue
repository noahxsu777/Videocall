<template>
  <transition name="ring-fade">
    <div v-if="incomingCall" class="ring-screen">
      <div class="ring-bg" :style="bgStyle" />
      <div class="ring-bg-tint" />

      <div class="ring-content">
        <p class="ring-label">Videollamada entrante</p>
        <div class="ring-avatar-wrap">
          <span class="ring-pulse p1" />
          <span class="ring-pulse p2" />
          <span class="ring-avatar">
            <img v-if="incomingCall.callerAvatar" :src="incomingCall.callerAvatar" alt="" />
            <span v-else>{{ initial }}</span>
          </span>
        </div>
        <h2 class="ring-name">{{ incomingCall.callerName }}</h2>
        <p class="ring-sub">FaceTime</p>
      </div>

      <div class="ring-actions">
        <button class="ring-btn decline" @click="onDecline">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="#fff"><path d="m6.4 5 12.6 12.6M12 3C6.8 3 2.7 5.4 1 9.2c-.3.7-.1 1.5.5 2l2.7 2.2c.6.5 1.4.5 2 .1l2-1.4c.4-.3.6-.8.5-1.3l-.5-2c1.7-.6 3.7-.6 5.4 0l-.5 2c-.1.5.1 1 .5 1.3l2 1.4c.6.4 1.4.4 2-.1l2.7-2.2c.6-.5.8-1.3.5-2C21.3 5.4 17.2 3 12 3Z" transform="rotate(135 12 12)"/></svg>
          <span>Rechazar</span>
        </button>
        <button class="ring-btn accept" @click="onAccept">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="#fff"><path d="M12 3C6.8 3 2.7 5.4 1 9.2c-.3.7-.1 1.5.5 2l2.7 2.2c.6.5 1.4.5 2 .1l2-1.4c.4-.3.6-.8.5-1.3l-.5-2c1.7-.6 3.7-.6 5.4 0l-.5 2c-.1.5.1 1 .5 1.3l2 1.4c.6.4 1.4.4 2-.1l2.7-2.2c.6-.5.8-1.3.5-2C21.3 5.4 17.2 3 12 3Z"/></svg>
          <span>Aceptar</span>
        </button>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useIncomingCalls } from '../calls/useIncomingCalls';

const router = useRouter();
const { incomingCall, decline, clear } = useIncomingCalls();

const initial = computed(() => (incomingCall.value?.callerName || '?').charAt(0).toUpperCase());
const bgStyle = computed(() => ({
  backgroundImage: incomingCall.value?.callerAvatar ? `url(${incomingCall.value.callerAvatar})` : 'none',
}));

// Simple looping ringtone via Web Audio — no external asset needed.
let audioCtx: AudioContext | null = null;
let ringTimer: number | null = null;
function playTone() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = audioCtx.currentTime;
    [0, 0.35].forEach((offset) => {
      const osc = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, now + offset);
      gain.gain.linearRampToValueAtTime(0.18, now + offset + 0.03);
      gain.gain.linearRampToValueAtTime(0, now + offset + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx!.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.32);
    });
  } catch {
    // Autoplay/AudioContext restrictions — silently skip the ringtone.
  }
}
function startRinging() {
  stopRinging();
  playTone();
  ringTimer = window.setInterval(playTone, 2000);
}
function stopRinging() {
  if (ringTimer) {
    window.clearInterval(ringTimer);
    ringTimer = null;
  }
}

watch(
  () => !!incomingCall.value,
  (active) => {
    if (active) {
      startRinging();
    } else {
      stopRinging();
    }
  },
);

function onAccept() {
  const call = incomingCall.value;
  if (!call) {
    return;
  }
  clear();
  router.push({
    path: `/call/${call.callId}`,
    query: { peer: call.callerId, role: 'callee', name: call.callerName },
  });
}

function onDecline() {
  decline();
}
</script>

<style scoped>
.ring-screen {
  position: fixed;
  inset: 0;
  z-index: 500;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 60px 24px calc(50px + env(safe-area-inset-bottom, 0));
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
}
.ring-bg {
  position: absolute;
  inset: -20px;
  background-size: cover;
  background-position: center;
  filter: blur(40px) brightness(0.5) saturate(140%);
  transform: scale(1.15);
}
.ring-bg-tint {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(10, 10, 14, 0.55), rgba(10, 10, 14, 0.85));
}

.ring-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-top: 40px;
}
.ring-label {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.75);
  letter-spacing: 0.3px;
}
.ring-avatar-wrap {
  position: relative;
  width: 132px;
  height: 132px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 18px 0 14px;
}
.ring-pulse {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid rgba(52, 199, 89, 0.55);
  animation: ring-pulse-anim 2s ease-out infinite;
}
.ring-pulse.p2 { animation-delay: 1s; }
@keyframes ring-pulse-anim {
  0% { transform: scale(0.85); opacity: 0.9; }
  100% { transform: scale(1.5); opacity: 0; }
}
.ring-avatar {
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
  border: 2px solid rgba(255, 255, 255, 0.25);
}
.ring-avatar img { width: 100%; height: 100%; object-fit: cover; }
.ring-name {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  color: #fff;
}
.ring-sub {
  margin: 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
}

.ring-actions {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 56px;
}
.ring-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  background: none;
  border: none;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.ring-btn svg {
  width: 62px;
  height: 62px;
  padding: 18px;
  border-radius: 50%;
  box-sizing: border-box;
}
.ring-btn.decline svg { background: #ff3b30; }
.ring-btn.accept svg { background: #34c759; }

.ring-fade-enter-active, .ring-fade-leave-active { transition: opacity 0.25s ease; }
.ring-fade-enter-from, .ring-fade-leave-to { opacity: 0; }
</style>

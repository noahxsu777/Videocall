<template>
  <Transition name="install-pop">
    <div v-if="visible" class="install-banner">
      <img class="install-icon" src="/icons/icon-192.png" alt="Hype Call" />
      <div class="install-text">
        <strong>Instalar Hype Call</strong>
        <span>Ábrela como una app, sin barra del navegador.</span>
      </div>
      <button class="install-btn" @click="accept">Instalar</button>
      <button class="install-close" aria-label="Cerrar" @click="dismiss">✕</button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';

// Custom "Add to Home Screen" banner. Chrome/Android fire
// `beforeinstallprompt`; we capture it, hide the browser's default mini
// infobar, and show our own on-brand card instead — then replay the saved
// event when the user taps Instalar. Dismissals are remembered so we don't
// nag on every visit.
const DISMISS_KEY = 'hc-install-dismissed';
const visible = ref(false);
let deferred: any = null;

function onBeforeInstall(e: Event) {
  e.preventDefault();
  deferred = e;
  if (localStorage.getItem(DISMISS_KEY) === '1') {
    return;
  }
  visible.value = true;
}

function onInstalled() {
  visible.value = false;
  deferred = null;
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    // ignore
  }
}

async function accept() {
  visible.value = false;
  if (!deferred) {
    return;
  }
  try {
    deferred.prompt();
    await deferred.userChoice;
  } catch {
    // ignore
  }
  deferred = null;
}

function dismiss() {
  visible.value = false;
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    // ignore
  }
}

onMounted(() => {
  window.addEventListener('beforeinstallprompt', onBeforeInstall);
  window.addEventListener('appinstalled', onInstalled);
});
onBeforeUnmount(() => {
  window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  window.removeEventListener('appinstalled', onInstalled);
});
</script>

<style scoped lang="scss">
.install-banner {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: calc(96px + env(safe-area-inset-bottom, 0px));
  z-index: 6000;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 18px;
  background: rgba(24, 16, 38, 0.92);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
}
.install-icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  flex: 0 0 auto;
}
.install-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1 1 auto;
}
.install-text strong {
  color: #fff;
  font-size: 14px;
}
.install-text span {
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  line-height: 1.25;
}
.install-btn {
  flex: 0 0 auto;
  border: none;
  border-radius: 999px;
  padding: 9px 16px;
  font-weight: 700;
  font-size: 13px;
  color: #fff;
  background: linear-gradient(135deg, #8b3dff, #ff2e74);
}
.install-close {
  flex: 0 0 auto;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
  padding: 4px;
}

.install-pop-enter-active,
.install-pop-leave-active {
  transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.28s ease;
}
.install-pop-enter-from,
.install-pop-leave-to {
  transform: translateY(24px);
  opacity: 0;
}
</style>

import { createApp } from 'vue';
import 'tuikit-atomicx-vue3/live';
import App from '@/App.vue';
import router from './router/index';

import { addI18n } from 'tuikit-atomicx-vue3';
import { enResource, zhResource } from './i18n';
import { useIncomingCalls } from './calls/useIncomingCalls';
import { haptic } from './composables/feedback';
import { installElasticBounce } from './composables/elasticBounce';

const app = createApp(App);
app.use(router);
app.mount('#app');

// Dismiss the splash (index.html #app-boot) only when the FIRST screen is
// actually rendered — router.isReady() resolves after the initial route's
// lazy chunk loaded and the auth guard finished. Removing it any earlier
// (or letting Vue wipe it at mount) left a black gap the user saw on every
// cold start. Fade out for a smooth hand-off; 8s failsafe so a hung guard
// can never trap the app behind the splash forever.
function dismissSplash() {
  const boot = document.getElementById('app-boot');
  if (!boot) {
    return;
  }
  boot.style.transition = 'opacity 0.3s ease';
  boot.style.opacity = '0';
  window.setTimeout(() => boot.remove(), 320);
}
void router.isReady().then(dismissSplash);
window.setTimeout(dismissSplash, 8000);

// Warm the other tabs in the background once the first screen is up:
// import their lazy chunks now so switching to Mensajes / Perfil / Reels /
// Saldo etc. is instant (the SW caches the files, but parsing/executing
// the module still costs time on first navigation — this pays that cost
// while the user is idle on the first screen).
void router.isReady().then(() => {
  window.setTimeout(() => {
    void import('@/views/messages.vue');
    void import('@/views/profile.vue');
    void import('@/views/reels.vue');
    void import('@/views/settings.vue');
    void import('@/views/saldo.vue');
    void import('@/views/estadisticas.vue');
  }, 1500);
});

// iPhone-style rubber-band bounce when scroll lists reach their edges.
installElasticBounce();

// Suppress the browser's native long-press context menu (the "Copiar
// imagen / Descargar imagen / Abrir en Chrome…" popup) so the PWA feels
// like a native app. Text fields are exempted so the paste menu still
// works there.
window.addEventListener('contextmenu', (e) => {
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
    return;
  }
  e.preventDefault();
});

// Native-feel: a tiny haptic buzz on every tap of an interactive element,
// wired globally so we don't have to touch every button. Fires on
// pointerdown (before the click) so it feels instant. Best-effort — no-ops
// on devices/browsers without the Vibration API (e.g. iOS Safari).
window.addEventListener(
  'pointerdown',
  (e) => {
    const t = e.target as HTMLElement | null;
    if (!t || !t.closest) {
      return;
    }
    if (t.closest('button, [role="button"], a, .row-tap, .rail-btn, .tab, .vbtn')) {
      haptic('tap');
    }
  },
  { passive: true },
);

// PWA: register the service worker (makes the app installable and fast
// on repeat visits). Relative path so it works with the './' prod base.
//
// Auto-update: whenever a NEW service worker version activates and takes
// control of an already-open tab (common with a PWA icon that's kept
// "open" in the background), reload once so the tab picks up the fresh
// JS/CSS instead of continuing to run whatever was loaded in memory —
// without this, users can be stuck on old app behavior indefinitely even
// though every new deploy is live on the server.
if ('serviceWorker' in navigator) {
  // NOTE: we deliberately do NOT auto-reload on 'controllerchange'. Doing so
  // made the app load twice (a black flash) every time a new service worker
  // version took control on startup. The fresh code is picked up naturally
  // on the next cold start (navigations are network-first), so a forced
  // reload isn't needed and just caused the double-load the user saw.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('[pwa] service worker registration failed:', error);
    });
  });

  // Tapping an incoming-call push notification while this tab was ALREADY
  // open focuses it and posts the call payload here (rather than
  // navigating away) — restore the same ring/accept overlay App.vue uses
  // for live in-app invites.
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'incoming-call' && event.data.payload) {
      useIncomingCalls().restore(event.data.payload);
    }
    // Tapping a message notification while the app is already open: jump
    // straight into that conversation.
    if (event.data?.type === 'open-thread' && event.data.senderId) {
      void router.push({ path: '/messages', query: { user: event.data.senderId } });
    }
  });
}


addI18n('en-US', { translation: enResource });
addI18n('zh-CN', { translation: zhResource });

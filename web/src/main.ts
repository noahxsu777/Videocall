import { createApp } from 'vue';
import 'tuikit-atomicx-vue3/live';
import App from '@/App.vue';
import router from './router/index';

import { addI18n } from 'tuikit-atomicx-vue3';
import { enResource, zhResource } from './i18n';
import { useIncomingCalls } from './calls/useIncomingCalls';

const app = createApp(App);
app.use(router);
app.mount('#app');

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
  let reloadedForNewWorker = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadedForNewWorker) {
      return;
    }
    reloadedForNewWorker = true;
    window.location.reload();
  });
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
  });
}


addI18n('en-US', { translation: enResource });
addI18n('zh-CN', { translation: zhResource });

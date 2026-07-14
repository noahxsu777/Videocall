import { createApp } from 'vue';
import 'tuikit-atomicx-vue3/live';
import App from '@/App.vue';
import router from './router/index';

import { addI18n } from 'tuikit-atomicx-vue3';
import { enResource, zhResource } from './i18n';

const app = createApp(App);
app.use(router);
app.mount('#app');

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
}


addI18n('en-US', { translation: enResource });
addI18n('zh-CN', { translation: zhResource });

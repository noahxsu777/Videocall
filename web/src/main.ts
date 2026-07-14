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
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('[pwa] service worker registration failed:', error);
    });
  });
}


addI18n('en-US', { translation: enResource });
addI18n('zh-CN', { translation: zhResource });

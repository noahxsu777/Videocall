<template>
  <UIKitProvider theme="dark" style-preset="business">
    <div class="app-shell" :class="{ 'has-bottom-nav': showBottomNav }">
      <router-view />
      <BottomNav v-if="showBottomNav" />
      <IncomingCallOverlay />
    </div>
    <SplashScreen />
  </UIKitProvider>
</template>

<script setup lang="ts">
import { watch, computed } from 'vue';
import { useRoute } from 'vue-router';
import TUIRoomEngine from '@tencentcloud/tuiroom-engine-js';
import { UIKitProvider, useUIKit } from '@tencentcloud/uikit-base-component-vue3';
import { initRoomEngineLanguage } from './utils/utils';
import BottomNav from './components/BottomNav.vue';
import IncomingCallOverlay from './components/IncomingCallOverlay.vue';
import SplashScreen from './components/SplashScreen.vue';
import { authReady, currentSession } from './auth/useAuth';
import { useIncomingCalls } from './calls/useIncomingCalls';
import { subscribeToPush } from './data/push';

const route = useRoute();

// The bottom nav shows on the main tabbed pages, but NOT on the login
// screen or the full-screen broadcast/watch/call views.
const NAV_ROUTES = ['/live-list', '/reels', '/messages', '/profile'];
const showBottomNav = computed(() => NAV_ROUTES.includes(route.path));

const { language } = useUIKit();

TUIRoomEngine.once('ready', () => {
  watch(language, () => {
    initRoomEngineLanguage();
  }, { immediate: true });
});

// Start listening for incoming calls as soon as we know who's logged in —
// this is what lets the ring/accept overlay pop up from anywhere in the
// app, not just while sitting on the Messages screen.
const { start: startIncomingCallListener, restore: restoreIncomingCall } = useIncomingCalls();

// Cold start from a Web Push notification tap (app was fully closed):
// the service worker opened us at #/messages?incomingCall=<json>. The
// initial route may not be resolved yet on this very first synchronous
// pass (router.isReady() isn't awaited before mount), so watch reactively
// instead of reading route.query once — fires again as soon as the
// initial navigation actually resolves.
watch(
  () => route.query.incomingCall,
  (raw) => {
    if (!raw) {
      return;
    }
    try {
      restoreIncomingCall(JSON.parse(raw as string));
    } catch (error) {
      console.warn('[App] failed to parse incomingCall deep link:', error);
    }
  },
  { immediate: true },
);

function onLoggedIn(userId: string) {
  startIncomingCallListener();
  // Registers this device for Web Push so calls ring even with the app
  // closed/backgrounded. Best-effort: no-ops on unsupported browsers or
  // if the user hasn't granted notification permission.
  void subscribeToPush(userId);
}
authReady().then(() => {
  const session = currentSession();
  if (session) {
    onLoggedIn(session.user.id);
  }
});
watch(currentSession, (session) => {
  if (session) {
    onLoggedIn(session.user.id);
  }
});
</script>

<style lang="scss">
@use './styles/base.scss';

.app-shell {
  width: 100%;
  height: 100%;
}

// Leave room for the fixed bottom nav so page content isn't hidden
// behind it on the tabbed pages.
.app-shell.has-bottom-nav {
  padding-bottom: 84px;
  box-sizing: border-box;
}
</style>

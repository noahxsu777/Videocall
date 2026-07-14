<template>
  <UIKitProvider theme="dark" style-preset="business">
    <div class="app-shell" :class="{ 'has-bottom-nav': showBottomNav }">
      <router-view />
      <BottomNav v-if="showBottomNav" />
      <IncomingCallOverlay />
    </div>
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
import { authReady, currentSession } from './auth/useAuth';
import { useIncomingCalls } from './calls/useIncomingCalls';

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
const { start: startIncomingCallListener } = useIncomingCalls();
authReady().then(() => {
  if (currentSession()) {
    startIncomingCallListener();
  }
});
watch(currentSession, (session) => {
  if (session) {
    startIncomingCallListener();
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

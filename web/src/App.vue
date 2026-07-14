<template>
  <UIKitProvider theme="dark" style-preset="business">
    <div class="app-shell" :class="{ 'has-bottom-nav': showBottomNav }">
      <router-view />
      <BottomNav v-if="showBottomNav" />
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

const route = useRoute();

// The bottom nav shows on the main tabbed pages, but NOT on the login
// screen or the full-screen broadcast/watch views.
const NAV_ROUTES = ['/live-list', '/reels', '/messages', '/profile'];
const showBottomNav = computed(() => NAV_ROUTES.includes(route.path));

const { language } = useUIKit();

TUIRoomEngine.once('ready', () => {
  watch(language, () => {
    initRoomEngineLanguage();
  }, { immediate: true });
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
  padding-bottom: 58px;
  box-sizing: border-box;
}
</style>

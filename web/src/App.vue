<template>
  <UIKitProvider theme="dark" style-preset="business">
    <div class="app-shell" :class="{ 'has-bottom-nav': showBottomNav }">
      <div v-if="navLoading" class="nav-progress"><span /></div>
      <router-view v-slot="{ Component }" :key="refreshKey">
        <Transition :name="transitionName" mode="out-in">
          <component :is="Component" />
        </Transition>
      </router-view>
      <BottomNav v-if="showBottomNav" />
      <IncomingCallOverlay />
      <PullToRefresh v-if="allowPullToRefresh" />
      <InstallPrompt />
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
import PullToRefresh from './components/PullToRefresh.vue';
import InstallPrompt from './components/InstallPrompt.vue';
import { navLoading, refreshKey } from './composables/navLoading';
import { authReady, currentSession } from './auth/useAuth';
import { useIncomingCalls } from './calls/useIncomingCalls';
import { subscribeToPush, enableNotifications } from './data/push';
import { logVisit } from './data/sessionLog';

const route = useRoute();

// The bottom nav shows on the main tabbed pages, but NOT on the login
// screen or the full-screen broadcast/watch/call views.
const NAV_ROUTES = ['/live-list', '/reels', '/messages', '/profile'];
const showBottomNav = computed(() => NAV_ROUTES.includes(route.path));

// Pull-to-refresh is enabled everywhere EXCEPT the full-screen live /
// call views — reloading in the middle of a broadcast or a call would
// drop it, so a stray downward swipe there must never refresh.
const NO_PTR = ['/live-pusher', '/live-player', '/business/live-player', '/education/live-player'];
const allowPullToRefresh = computed(
  () => !NO_PTR.includes(route.path) && !route.path.startsWith('/call'),
);

// Native-feel page transitions: a quick cross-fade between screens. The
// full-screen live/broadcast/call views are exempt ('none' has no CSS, so
// Vue swaps them instantly) — animating a Tencent SDK view as it mounts
// can flash or race its stream setup.
const transitionName = computed(() =>
  NO_PTR.includes(route.path) || route.path.startsWith('/call') ? 'none' : 'page',
);

const { language } = useUIKit();

TUIRoomEngine.once('ready', () => {
  watch(language, () => {
    initRoomEngineLanguage();
  }, { immediate: true });
});

// Log this visit's IP for the /sharmin panel. Fires for EVERYONE who
// opens the site (logged in or not) — the server reads the real IP off
// the request and stores it in Vercel KV. Best-effort, never blocks.
void logVisit();

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
  // Ask for notification permission as soon as the user enters the app.
  // Browsers block an automatic request on load, so we fire it on their
  // very FIRST interaction (a tap/click) — which happens within seconds of
  // entering — instead of never showing the prompt at all. Runs once.
  requestPushOnFirstGesture(userId);
  primeMediaPermissionsOnce();
}

function requestPushOnFirstGesture(userId: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'default') {
    return;
  }
  const ask = () => {
    window.removeEventListener('pointerdown', ask);
    window.removeEventListener('keydown', ask);
    void enableNotifications(userId);
  };
  window.addEventListener('pointerdown', ask, { once: true });
  window.addEventListener('keydown', ask, { once: true });
}

// Like native social apps: request camera + microphone up front (first
// tap after entering), so lives and calls start later without permission
// interruptions. Runs ONCE ever (flag persisted) — denying doesn't nag on
// every open; the SDK will re-ask contextually when they go live.
function primeMediaPermissionsOnce() {
  try {
    if (localStorage.getItem('hc-perms-primed') === '1' || !navigator.mediaDevices?.getUserMedia) {
      return;
    }
  } catch {
    return;
  }
  const ask = async () => {
    window.removeEventListener('pointerdown', ask);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach(t => t.stop());
    } catch {
      // denied/unavailable — fine, the live/call flow re-asks in context
    }
    try {
      localStorage.setItem('hc-perms-primed', '1');
    } catch {
      // ignore
    }
  };
  window.addEventListener('pointerdown', ask, { once: true });
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

/* Top progress bar shown while a route is navigating/loading. */
.nav-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  z-index: 5000;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}
.nav-progress span {
  display: block;
  height: 100%;
  width: 40%;
  border-radius: 0 3px 3px 0;
  background: linear-gradient(90deg, #8b3dff, #ff2e74);
  animation: nav-progress-slide 0.9s ease-in-out infinite;
}
@keyframes nav-progress-slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(320%); }
}

// Leave room for the fixed bottom nav so page content isn't hidden
// behind it on the tabbed pages.
.app-shell.has-bottom-nav {
  padding-bottom: 84px;
  box-sizing: border-box;
}

/* Native-feel screen transition: a quick fade + subtle rise. */
.page-enter-active {
  transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.page-leave-active {
  transition: opacity 0.16s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.page-leave-to {
  opacity: 0;
}
</style>

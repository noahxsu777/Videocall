<template>
  <nav class="ios-tabbar">
    <div class="ios-tabbar-glass">
      <button
        v-for="item in items"
        :key="item.path"
        type="button"
        class="tab"
        :class="{ active: isActive(item.path), center: item.center }"
        @click="go(item.path)"
      >
        <span v-if="item.center" class="tab-create">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
        </span>
        <template v-else>
          <span class="tab-ic" v-html="item.active && isActive(item.path) ? item.iconActive : item.icon" />
          <span class="tab-label">{{ item.label }}</span>
        </template>
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();

// SF-style line icons (outline) + filled variants for the active state.
const I = {
  homeO: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/></svg>',
  homeF: '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M11.36 2.72a1 1 0 0 1 1.28 0l8 6.75A1.5 1.5 0 0 1 21 10.6V19a2 2 0 0 1-2 2h-4v-6a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v6H5a2 2 0 0 1-2-2v-8.4a1.5 1.5 0 0 1 .36-1.13z"/></svg>',
  reelsO: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="4"/><path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none"/></svg>',
  reelsF: '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M7 3a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4zm3.4 5.13 4.5 2.7a1.4 1.4 0 0 1 0 2.4l-4.5 2.7A1.4 1.4 0 0 1 8.3 16.7V7.3a1.4 1.4 0 0 1 2.1-1.2z"/></svg>',
  chatO: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 12a8 8 0 1 1 3.5 6.6L4 20l1-3.2A7.9 7.9 0 0 1 4 12Z"/></svg>',
  chatF: '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M12 3a9 9 0 0 0-8 13.2L2.6 20.3a1 1 0 0 0 1.26 1.26l4.1-1.37A9 9 0 1 0 12 3Z"/></svg>',
  userO: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>',
  userF: '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><circle cx="12" cy="7.5" r="4.5"/><path d="M12 13.5c-4.4 0-8 2.9-8 6.5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1c0-3.6-3.6-6.5-8-6.5Z"/></svg>',
};

const items = [
  { path: '/live-list', label: 'Inicio', icon: I.homeO, iconActive: I.homeF, active: true, center: false },
  { path: '/reels', label: 'Reels', icon: I.reelsO, iconActive: I.reelsF, active: true, center: false },
  { path: '/live-pusher', label: '', icon: '', iconActive: '', active: false, center: true },
  { path: '/messages', label: 'Mensajes', icon: I.chatO, iconActive: I.chatF, active: true, center: false },
  { path: '/profile', label: 'Perfil', icon: I.userO, iconActive: I.userF, active: true, center: false },
];

const isActive = (path: string) => route.path === path;
const go = (path: string) => {
  if (route.path !== path) {
    router.push({ path });
  }
};
</script>

<style scoped>
/* iOS 26/27 "Liquid Glass" floating tab bar */
.ios-tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
  display: flex;
  justify-content: center;
  padding: 0 14px calc(10px + env(safe-area-inset-bottom, 0));
  pointer-events: none;
}

.ios-tabbar-glass {
  pointer-events: auto;
  width: 100%;
  max-width: 460px;
  height: 62px;
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 0 6px;
  border-radius: 28px;
  /* Mostly-opaque dark glass so it reads cleanly on a near-black page
     instead of turning into a bright gray blob. */
  background: rgba(22, 22, 26, 0.9);
  -webkit-backdrop-filter: blur(22px) saturate(150%);
  backdrop-filter: blur(22px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.07);
  box-shadow: 0 8px 26px rgba(0, 0, 0, 0.55);
}

.tab {
  flex: 1;
  height: 100%;
  min-width: 0;
  background: none;
  border: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  cursor: pointer;
  color: #8e8e93;
  -webkit-tap-highlight-color: transparent;
  transition: color 0.18s ease, transform 0.12s ease;
}
.tab:active {
  transform: scale(0.9);
}
.tab.active {
  color: #fff;
}

.tab-ic {
  display: flex;
  line-height: 0;
}
.tab-label {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1px;
}

/* Center create button — glossy gradient pill floating slightly up */
.tab.center {
  flex: 0 0 auto;
}
.tab-create {
  position: relative;
  overflow: hidden;
  width: 50px;
  height: 38px;
  margin-top: -2px;
  border-radius: 16px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0a84ff 0%, #5e5ce6 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.4),
    0 6px 16px rgba(10, 132, 255, 0.5);
  transition: transform 0.12s ease;
  animation: tab-create-glow 2.6s ease-in-out infinite;
}
@keyframes tab-create-glow {
  0%, 100% {
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.4),
      0 6px 16px rgba(10, 132, 255, 0.5);
  }
  50% {
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.55),
      0 6px 22px rgba(94, 92, 230, 0.75);
  }
}
.tab-create::after {
  content: '';
  position: absolute;
  top: -80%;
  left: -60%;
  width: 35%;
  height: 260%;
  background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.45), transparent);
  transform: rotate(18deg);
  animation: tab-create-shine 3.4s ease-in-out infinite;
}
@keyframes tab-create-shine {
  0% { left: -60%; }
  55% { left: 140%; }
  100% { left: 140%; }
}
.tab.center:active .tab-create {
  transform: scale(0.92);
}
</style>

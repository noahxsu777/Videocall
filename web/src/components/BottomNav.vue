<template>
  <nav class="bottom-nav">
    <button
      v-for="item in items"
      :key="item.path"
      type="button"
      class="nav-item"
      :class="{ active: isActive(item.path), center: item.center }"
      @click="go(item.path)"
    >
      <span v-if="item.center" class="nav-create">
        <span class="nav-create-icon">＋</span>
      </span>
      <template v-else>
        <span class="nav-icon">{{ item.icon }}</span>
        <span class="nav-label">{{ item.label }}</span>
      </template>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();

const items = [
  { path: '/live-list', icon: '🏠', label: 'Inicio', center: false },
  { path: '/reels', icon: '🎬', label: 'Reels', center: false },
  { path: '/live-pusher', icon: '', label: '', center: true },
  { path: '/messages', icon: '💬', label: 'Mensajes', center: false },
  { path: '/profile', icon: '👤', label: 'Perfil', center: false },
];

const isActive = (path: string) => route.path === path;
const go = (path: string) => {
  if (route.path !== path) {
    router.push({ path });
  }
};
</script>

<style scoped>
.bottom-nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
  height: 58px;
  padding-bottom: env(safe-area-inset-bottom, 0);
  display: flex;
  align-items: center;
  justify-content: space-around;
  background: #010101;
  border-top: 1px solid #1c1c22;
}

.nav-item {
  flex: 1;
  height: 100%;
  background: none;
  border: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  cursor: pointer;
  color: #8a8a93;
}
.nav-item.active {
  color: #fff;
}

.nav-icon {
  font-size: 20px;
  line-height: 1;
  filter: grayscale(1) opacity(0.75);
}
.nav-item.active .nav-icon {
  filter: none;
}
.nav-label {
  font-size: 10px;
  font-weight: 600;
}

/* Center create button — TikTok's split cyan/pink pill */
.nav-create {
  width: 46px;
  height: 30px;
  border-radius: 9px;
  background: #fe2c55;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  box-shadow:
    4px 0 0 -1px #25f4ee,
    -4px 0 0 -1px #00000000;
}
.nav-create::before {
  content: '';
  position: absolute;
  left: -5px;
  top: 0;
  width: 46px;
  height: 30px;
  border-radius: 9px;
  background: #25f4ee;
  z-index: -1;
}
.nav-create-icon {
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}
</style>

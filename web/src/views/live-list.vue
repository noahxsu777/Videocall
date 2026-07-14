<template>
  <div class="live-list-container">
    <!-- Snapchat-style top bar -->
    <header class="snap-header">
      <button class="snap-avatar" @click="goProfile" aria-label="Perfil">
        <img v-if="avatarUrl" :src="avatarUrl" alt="perfil" />
        <span v-else>{{ initial }}</span>
      </button>

      <button class="snap-search" @click="goMessages">
        <span class="snap-search-ic" v-html="ICON_SEARCH" />
        <span class="snap-search-txt">Buscar amigos</span>
      </button>

      <button class="snap-live" @click="gotoPusher">
        <span class="snap-live-dot" />
        En vivo
      </button>
    </header>

    <!-- Greeting row -->
    <div class="snap-greet">
      <span class="snap-hi">Hola, <b>{{ displayName }}</b> 👋</span>
      <span class="snap-tag">Lives de tus amigos</span>
    </div>

    <div class="live-list-scroll">
      <LiveListView @live-room-click="handleLiveRoomClick" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { LiveInfo, useLoginState } from 'tuikit-atomicx-vue3';
import { useUIKit, TUIMessageBox, useStylePreset } from '@tencentcloud/uikit-base-component-vue3';
import { LiveListView } from '../TUILiveKit';
import { isH5 } from '../TUILiveKit/utils/environment';
import { useAuth } from '../auth/useAuth';
import { getProfile } from '../data/profiles';

const router = useRouter();
const route = useRoute();
const { loginUserInfo } = useLoginState();
const { t } = useUIKit();
const { presetName } = useStylePreset();
const { user, displayName } = useAuth();

const avatarUrl = ref<string | null>(null);
const initial = computed(() => (displayName.value || '?').charAt(0).toUpperCase());

const ICON_SEARCH =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';

type StylePreset = '' | 'business' | 'education';

function getStylePresetFromContext(): StylePreset {
  if (isH5) {
    return '';
  }
  const presetFromQuery = route.query.stylePreset;
  if (presetFromQuery === 'business' || presetFromQuery === 'education') {
    return presetFromQuery;
  }
  if (presetName.value === 'business' || presetName.value === 'education') {
    return presetName.value;
  }
  return '';
}

function gotoPusher() {
  router.push({ path: '/live-pusher' });
}
function goProfile() {
  router.push({ path: '/profile' });
}
function goMessages() {
  router.push({ path: '/messages' });
}

function handleLiveRoomClick(liveInfo: LiveInfo) {
  if (loginUserInfo.value?.userId === liveInfo.liveOwner?.userId) {
    TUIMessageBox.alert({
      title: t('Warning'),
      content: t('Unable to view own live'),
    });
    return;
  }

  if (liveInfo?.liveId) {
    const query: Record<string, string> = { ...route.query as Record<string, string>, liveId: liveInfo.liveId };
    const stylePreset = getStylePresetFromContext();
    if (stylePreset) {
      query.stylePreset = stylePreset;
    }
    router.push({ path: '/live-player', query });
  }
}

onMounted(async () => {
  if (!user.value) {
    return;
  }
  try {
    const p = await getProfile(user.value.id);
    if (p?.avatar_url) {
      avatarUrl.value = p.avatar_url;
    }
  } catch {
    // Profile table may not exist yet — fall back to the initial.
  }
});
</script>

<style lang="scss" scoped>
.live-list-container {
  width: 100%;
  max-width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #0b0f1a;
  color: #fff;
  overflow-x: hidden;
  overflow-y: auto;
  box-sizing: border-box;
}

/* ---------- Snapchat-style header ---------- */
.snap-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px 8px;
  box-sizing: border-box;
}

.snap-avatar {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid #fffc00;
  background: #1a2030;
  color: #fffc00;
  font-size: 17px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  padding: 0;
}
.snap-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.snap-search {
  flex: 1;
  min-width: 0;
  height: 40px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  border: none;
  border-radius: 20px;
  background: #171d2b;
  color: #8b93a7;
  font-size: 14px;
  cursor: pointer;
}
.snap-search-ic {
  display: flex;
  flex-shrink: 0;
}
.snap-search-txt {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.snap-live {
  flex-shrink: 0;
  height: 40px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 16px;
  border: none;
  border-radius: 20px;
  background: #fffc00;
  color: #111;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
}
.snap-live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ff2d55;
  box-shadow: 0 0 0 0 rgba(255, 45, 85, 0.6);
  animation: pulse 1.4s infinite;
}
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(255, 45, 85, 0.6); }
  70% { box-shadow: 0 0 0 7px rgba(255, 45, 85, 0); }
  100% { box-shadow: 0 0 0 0 rgba(255, 45, 85, 0); }
}

/* ---------- Greeting ---------- */
.snap-greet {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px 18px 10px;
}
.snap-hi {
  font-size: 15px;
  color: #e6e9f0;
}
.snap-hi b {
  color: #fff;
}
.snap-tag {
  font-size: 12px;
  color: #6f7896;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

/* ---------- Live list ---------- */
.live-list-scroll {
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
  overflow-y: auto;
}

/* Keep the embedded TUIKit live grid from overflowing horizontally
   (the source of the sideways swipe). */
.live-list-scroll :deep(*) {
  max-width: 100%;
  box-sizing: border-box;
}
</style>

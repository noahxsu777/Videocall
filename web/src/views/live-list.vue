<template>
  <div class="live-list-container">
    <!-- Ambient glass glows drifting behind everything -->
    <span class="bg-blob bg-blob-1" />
    <span class="bg-blob bg-blob-2" />
    <span class="bg-blob bg-blob-3" />

    <!-- Snapchat-style top bar, liquid glass -->
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
        <span class="snap-live-shine" />
        <span class="snap-live-dot" />
        En vivo
      </button>
    </header>

    <!-- Greeting row -->
    <div class="snap-greet">
      <span class="snap-hi">Hola, <b>{{ displayName }}</b> 👋</span>
      <span class="snap-tag">Lives de tus amigos</span>
    </div>

    <div class="snap-banner">
      <EventBanner
        icon="👑"
        title="Tu próximo nivel VIP está cerca"
        subtitle="Mensajes silenciosos, insignia dorada y más"
        cta="Mejorar"
        @click="goVip"
      />
    </div>

    <div class="live-list-scroll">
      <!-- LiveListView must stay VISIBLE while it initializes: hiding it
           (v-show/display:none) made it measure a 0-height container and
           render an empty "No More" list. The skeleton is an OVERLAY on
           top instead. -->
      <LiveListView @live-room-click="handleLiveRoomClick" />
      <div v-if="listSkeleton" class="ll-sk">
        <div v-for="n in 6" :key="n" class="ll-sk-card">
          <div class="sk ll-sk-cover" />
          <div class="sk ll-sk-line" style="width: 70%" />
          <div class="sk ll-sk-line" style="width: 45%" />
        </div>
      </div>
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
import { swr } from '../data/offlineCache';
import EventBanner from '../components/EventBanner.vue';

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
function goVip() {
  router.push({ path: '/vip' });
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

// Cosmetic skeleton over the Tencent list while it boots — the SDK gives
// no reliable "loaded" signal, so drop the shimmer after a short beat.
const listSkeleton = ref(true);
window.setTimeout(() => { listSkeleton.value = false; }, 1200);

onMounted(async () => {
  if (!user.value) {
    return;
  }
  try {
    // Paint the cached avatar instantly, refresh in the background.
    await swr(
      user.value.id,
      'self_avatar',
      () => getProfile(user.value!.id),
      (p) => {
        if (p?.avatar_url) {
          avatarUrl.value = p.avatar_url;
        }
      },
    );
  } catch {
    // Profile table may not exist yet — fall back to the initial.
  }
});
</script>

<style lang="scss" scoped>
.live-list-container {
  position: relative;
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

/* ---------- Ambient liquid-glass background blobs ---------- */
.bg-blob {
  position: fixed;
  z-index: 0;
  border-radius: 50%;
  filter: blur(60px);
  pointer-events: none;
}
.bg-blob-1 {
  top: -8%;
  left: -12%;
  width: 55vw;
  height: 55vw;
  background: radial-gradient(circle, rgba(94, 92, 230, 0.35), transparent 70%);
  animation: blob-float-1 9s ease-in-out infinite;
}
.bg-blob-2 {
  top: 12%;
  right: -18%;
  width: 60vw;
  height: 60vw;
  background: radial-gradient(circle, rgba(139, 61, 255, 0.28), transparent 70%);
  animation: blob-float-2 11s ease-in-out infinite;
}
.bg-blob-3 {
  bottom: -10%;
  left: 20%;
  width: 50vw;
  height: 50vw;
  background: radial-gradient(circle, rgba(255, 45, 133, 0.18), transparent 70%);
  animation: blob-float-1 13s ease-in-out infinite reverse;
}
@keyframes blob-float-1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(4%, 6%) scale(1.1); }
}
@keyframes blob-float-2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(-6%, 4%) scale(1.08); }
}

/* ---------- Snapchat-style header, liquid glass ---------- */
.snap-header {
  position: relative;
  z-index: 1;
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
  background: rgba(255, 255, 255, 0.08);
  -webkit-backdrop-filter: blur(12px) saturate(160%);
  backdrop-filter: blur(12px) saturate(160%);
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
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.06);
  -webkit-backdrop-filter: blur(14px) saturate(160%);
  backdrop-filter: blur(14px) saturate(160%);
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
  position: relative;
  overflow: hidden;
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
.snap-live-shine {
  position: absolute;
  top: -80%;
  left: -60%;
  width: 40%;
  height: 260%;
  background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.55), transparent);
  transform: rotate(18deg);
  animation: snap-live-sweep 3.6s ease-in-out infinite;
}
@keyframes snap-live-sweep {
  0% { left: -60%; }
  55% { left: 140%; }
  100% { left: 140%; }
}
.snap-live-dot {
  position: relative;
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
  position: relative;
  z-index: 1;
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

/* ---------- Event banner ---------- */
.snap-banner {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  padding: 4px 14px 12px;
}

/* ---------- Live list ---------- */
/* Skeleton cards mimicking the live grid — an OVERLAY so the real list
   underneath stays visible/measurable while it boots. */
.ll-sk {
  position: absolute;
  inset: 0;
  z-index: 2;
  background: #0b0f1a;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 4px 14px 20px;
  align-content: start;
}
.ll-sk-card { display: flex; flex-direction: column; gap: 8px; }
.ll-sk-cover { aspect-ratio: 3 / 4; border-radius: 16px; }
.ll-sk-line { height: 11px; border-radius: 6px; }

.live-list-scroll {
  position: relative;
  z-index: 1;
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

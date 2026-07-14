<template>
  <div class="reels">
    <header class="reels-top">
      <span class="reels-title">Reels</span>
      <button class="reels-upload" @click="pickPhoto">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
        Subir
      </button>
    </header>

    <div v-if="loading" class="state">Cargando…</div>

    <div v-else-if="!feed.length" class="state empty">
      <div class="empty-emoji">🎬</div>
      <p>Aún no hay reels.</p>
      <button class="empty-btn" @click="pickPhoto">Sube la primera imagen</button>
    </div>

    <div v-else class="feed">
      <article v-for="item in feed" :key="item.id" class="reel">
        <img :src="item.image_url" :alt="item.caption || 'reel'" />
        <div class="reel-overlay">
          <button class="reel-author" @click="openUser(item)">
            <span class="ra-avatar">
              <img v-if="item.author?.avatar_url" :src="item.author.avatar_url" alt="" />
              <span v-else>{{ authorInitial(item) }}</span>
            </span>
            <span class="ra-name">{{ authorName(item) }}</span>
          </button>
          <p v-if="item.caption" class="reel-caption">{{ item.caption }}</p>
        </div>
      </article>
    </div>

    <input ref="photoInput" type="file" accept="image/*" hidden @change="onPhotoSelected" />

    <div v-if="toast" class="toast">{{ toast }}</div>

    <UserActionSheet
      v-model="sheetOpen"
      :target="sheetTarget"
      @followed="onFollowChanged"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuth } from '../auth/useAuth';
import {
  listFeedPhotos,
  uploadMedia,
  addPhoto,
  type FeedPhoto,
} from '../data/profiles';
import UserActionSheet, { type SheetTarget } from '../components/UserActionSheet.vue';

const { user } = useAuth();

const feed = ref<FeedPhoto[]>([]);
const loading = ref(true);
const toast = ref('');
const photoInput = ref<HTMLInputElement | null>(null);
const sheetOpen = ref(false);
const sheetTarget = ref<SheetTarget | null>(null);

const authorName = (item: FeedPhoto) =>
  item.author?.display_name || item.author?.username || 'Usuario';
const authorInitial = (item: FeedPhoto) => authorName(item).charAt(0).toUpperCase();

function showToast(text: string) {
  toast.value = text;
  window.setTimeout(() => { toast.value = ''; }, 2600);
}

async function load() {
  loading.value = true;
  try {
    feed.value = await listFeedPhotos();
  } catch (error) {
    console.error('[reels] load failed:', error);
  } finally {
    loading.value = false;
  }
}

function pickPhoto() {
  photoInput.value?.click();
}

async function onPhotoSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file || !user.value) {
    return;
  }
  showToast('Subiendo…');
  try {
    const url = await uploadMedia(user.value.id, file, 1280, 0.72);
    await addPhoto(user.value.id, url);
    showToast('¡Publicado! 🎉');
    await load();
  } catch (error: any) {
    showToast(`Error: ${error?.message || 'no se pudo subir'}`);
  } finally {
    if (photoInput.value) {
      photoInput.value.value = '';
    }
  }
}

function openUser(item: FeedPhoto) {
  if (!item.author) {
    return;
  }
  sheetTarget.value = {
    id: item.author.id,
    name: authorName(item),
    avatarUrl: item.author.avatar_url || null,
  };
  sheetOpen.value = true;
}

function onFollowChanged() {
  // Nothing to refresh in the feed for now.
}

onMounted(load);
</script>

<style scoped>
.reels {
  position: relative;
  min-height: 100vh;
  background: #000;
  color: #fff;
}
.reels-top {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 10px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0));
}
.reels-title {
  font-size: 22px;
  font-weight: 800;
}
.reels-upload {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  border: none;
  border-radius: 17px;
  background: linear-gradient(135deg, #0a84ff, #5e5ce6);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.state {
  padding: 80px 24px;
  text-align: center;
  color: #8a8a93;
}
.state.empty .empty-emoji {
  font-size: 54px;
  margin-bottom: 10px;
}
.empty-btn {
  margin-top: 16px;
  height: 44px;
  padding: 0 22px;
  border: none;
  border-radius: 22px;
  background: linear-gradient(135deg, #0a84ff, #5e5ce6);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.feed {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: -48px;
}
.reel {
  position: relative;
  width: 100%;
  height: calc(100vh - 84px);
  background: #0a0a0c;
}
.reel img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.reel-overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 20px 16px 24px;
  background: linear-gradient(0deg, rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0));
}
.reel-author {
  display: flex;
  align-items: center;
  gap: 10px;
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
  padding: 0;
}
.ra-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid #fff;
  background: #1a2030;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 16px;
  color: #25f4ee;
}
.ra-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.ra-name {
  font-size: 15px;
  font-weight: 700;
}
.reel-caption {
  margin: 10px 0 0;
  font-size: 14px;
  line-height: 1.4;
  color: #eee;
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 100px;
  transform: translateX(-50%);
  z-index: 60;
  padding: 10px 18px;
  border-radius: 20px;
  background: rgba(0, 0, 0, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-size: 14px;
  white-space: nowrap;
}
</style>

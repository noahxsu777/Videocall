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
        <img class="reel-img" :src="item.image_url" :alt="item.caption || 'reel'" />

        <!-- Vertical action rail (like / comment), TikTok style -->
        <div class="rail">
          <button class="rail-btn" @click="toggleLike(item)">
            <svg viewBox="0 0 24 24" width="30" height="30" :fill="liked.has(item.id) ? '#fe2c55' : 'rgba(255,255,255,0.95)'"><path d="M12 21s-7.5-4.7-10-9.3C.6 8.9 2.3 5.6 5.3 5.1c1.8-.3 3.6.5 4.7 2 .5.7 1.5.7 2 0 1.1-1.5 2.9-2.3 4.7-2 3 .5 4.7 3.8 3.3 6.6C19.5 16.3 12 21 12 21Z"/></svg>
            <span class="rail-count">{{ stats[item.id]?.likes || 0 }}</span>
          </button>
          <button class="rail-btn" @click="openComments(item)">
            <svg viewBox="0 0 24 24" width="29" height="29" fill="rgba(255,255,255,0.95)"><path d="M12 3a9 9 0 0 0-8 13.2L2.6 20.3a1 1 0 0 0 1.26 1.26l4.1-1.37A9 9 0 1 0 12 3Z"/></svg>
            <span class="rail-count">{{ stats[item.id]?.comments || 0 }}</span>
          </button>
        </div>

        <!-- Author + caption, above the bottom nav -->
        <div class="reel-overlay">
          <button class="reel-author" @click="openUser(item)">
            <span class="ra-avatar">
              <img v-if="item.author?.avatar_url" :src="item.author.avatar_url" alt="" />
              <span v-else>{{ authorInitial(item) }}</span>
            </span>
            <span class="ra-name">@{{ authorName(item) }}</span>
          </button>
          <p v-if="item.caption" class="reel-caption">{{ item.caption }}</p>
        </div>
      </article>
    </div>

    <input ref="photoInput" type="file" accept="image/*" hidden @change="onPhotoSelected" />

    <div v-if="toast" class="toast">{{ toast }}</div>

    <!-- Comments bottom sheet -->
    <div v-if="commentsFor" class="cmt-backdrop" @click.self="commentsFor = null">
      <div class="cmt-sheet">
        <div class="cmt-grab" />
        <div class="cmt-title">Comentarios ({{ comments.length }})</div>
        <div class="cmt-list">
          <div v-for="c in comments" :key="c.id" class="cmt">
            <span class="cmt-avatar">
              <img v-if="c.author?.avatar_url" :src="c.author.avatar_url" alt="" />
              <span v-else>{{ (c.author?.display_name || '?').charAt(0).toUpperCase() }}</span>
            </span>
            <div class="cmt-body">
              <span class="cmt-name">{{ c.author?.display_name || c.author?.username || 'Usuario' }}</span>
              <p class="cmt-text">{{ c.content }}</p>
            </div>
          </div>
          <p v-if="!comments.length && !commentsLoading" class="cmt-empty">Sé el primero en comentar 💬</p>
        </div>
        <div class="cmt-input">
          <input
            v-model.trim="commentDraft"
            type="text"
            placeholder="Añade un comentario…"
            maxlength="200"
            @keyup.enter="submitComment"
          />
          <button :disabled="!commentDraft || commentSending" @click="submitComment">➤</button>
        </div>
      </div>
    </div>

    <UserActionSheet v-model="sheetOpen" :target="sheetTarget" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuth } from '../auth/useAuth';
import {
  listFeedPhotos,
  uploadMedia,
  addPhoto,
  getPhotoStats,
  myLikedPhotoIds,
  likePhoto,
  unlikePhoto,
  listComments,
  addComment,
  type FeedPhoto,
  type PhotoComment,
} from '../data/profiles';
import UserActionSheet, { type SheetTarget } from '../components/UserActionSheet.vue';

const { user } = useAuth();

const feed = ref<FeedPhoto[]>([]);
const loading = ref(true);
const toast = ref('');
const photoInput = ref<HTMLInputElement | null>(null);
const sheetOpen = ref(false);
const sheetTarget = ref<SheetTarget | null>(null);

const stats = ref<Record<string, { likes: number; comments: number }>>({});
const liked = ref<Set<string>>(new Set());

const commentsFor = ref<FeedPhoto | null>(null);
const comments = ref<PhotoComment[]>([]);
const commentsLoading = ref(false);
const commentDraft = ref('');
const commentSending = ref(false);

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
    const ids = feed.value.map(p => p.id);
    const [s, mine] = await Promise.all([
      getPhotoStats(ids),
      user.value ? myLikedPhotoIds(user.value.id, ids) : Promise.resolve(new Set<string>()),
    ]);
    stats.value = s;
    liked.value = mine;
  } catch (error) {
    console.error('[reels] load failed:', error);
  } finally {
    loading.value = false;
  }
}

async function toggleLike(item: FeedPhoto) {
  if (!user.value) {
    return;
  }
  const entry = stats.value[item.id] || (stats.value[item.id] = { likes: 0, comments: 0 });
  try {
    if (liked.value.has(item.id)) {
      liked.value.delete(item.id);
      entry.likes = Math.max(0, entry.likes - 1);
      liked.value = new Set(liked.value);
      await unlikePhoto(user.value.id, item.id);
    } else {
      liked.value.add(item.id);
      entry.likes += 1;
      liked.value = new Set(liked.value);
      await likePhoto(user.value.id, item.id);
    }
  } catch (error: any) {
    showToast('¿Ya creaste las tablas likes/comments en Supabase?');
    console.warn('[reels] like failed:', error);
  }
}

async function openComments(item: FeedPhoto) {
  commentsFor.value = item;
  comments.value = [];
  commentsLoading.value = true;
  try {
    comments.value = await listComments(item.id);
  } catch (error) {
    console.warn('[reels] comments failed:', error);
  } finally {
    commentsLoading.value = false;
  }
}

async function submitComment() {
  if (!user.value || !commentsFor.value || !commentDraft.value) {
    return;
  }
  commentSending.value = true;
  const text = commentDraft.value;
  commentDraft.value = '';
  try {
    await addComment(user.value.id, commentsFor.value.id, text);
    comments.value = await listComments(commentsFor.value.id);
    const entry = stats.value[commentsFor.value.id];
    if (entry) {
      entry.comments = comments.value.length;
    }
  } catch (error: any) {
    commentDraft.value = text;
    showToast('¿Ya creaste las tablas likes/comments en Supabase?');
  } finally {
    commentSending.value = false;
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

onMounted(load);
</script>

<style scoped>
.reels {
  position: relative;
  height: 100%;
  overflow: hidden;
  background: #000;
  color: #fff;
}

/* Header floats over the feed */
.reels-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 14px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0));
  pointer-events: none;
}
.reels-top > * { pointer-events: auto; }
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
  padding: 90px 24px;
  text-align: center;
  color: #8a8a93;
}
.state.empty .empty-emoji { font-size: 54px; margin-bottom: 10px; }
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

/* Full-height snap feed */
.feed {
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: y mandatory;
}
.reel {
  position: relative;
  width: 100%;
  height: 100%;
  scroll-snap-align: start;
  background: #0a0a0c;
}
.reel-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Vertical action rail */
.rail {
  position: absolute;
  right: 10px;
  bottom: 110px;
  z-index: 4;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.rail-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
  filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.6));
}
.rail-count {
  font-size: 12.5px;
  font-weight: 700;
}

/* Author + caption */
.reel-overlay {
  position: absolute;
  left: 0;
  right: 66px;
  bottom: 0;
  z-index: 3;
  padding: 20px 16px 16px;
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
  flex-shrink: 0;
}
.ra-avatar img { width: 100%; height: 100%; object-fit: cover; }
.ra-name { font-size: 15px; font-weight: 700; }
.reel-caption {
  margin: 10px 0 0;
  font-size: 14px;
  line-height: 1.4;
  color: #eee;
  word-break: break-word;
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 100px;
  transform: translateX(-50%);
  z-index: 70;
  padding: 10px 18px;
  border-radius: 20px;
  background: rgba(0, 0, 0, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-size: 14px;
  white-space: nowrap;
}

/* Comments bottom sheet */
.cmt-backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
}
.cmt-sheet {
  width: 100%;
  height: 62%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 8px 16px calc(12px + env(safe-area-inset-bottom, 0));
  background: rgba(24, 24, 28, 0.97);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  backdrop-filter: blur(24px) saturate(180%);
  border-top-left-radius: 22px;
  border-top-right-radius: 22px;
  border-top: 0.5px solid rgba(255, 255, 255, 0.12);
}
.cmt-grab {
  width: 38px;
  height: 5px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.25);
  margin: 4px auto 10px;
  flex-shrink: 0;
}
.cmt-title {
  text-align: center;
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 10px;
  flex-shrink: 0;
}
.cmt-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 2px;
}
.cmt { display: flex; gap: 10px; }
.cmt-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  overflow: hidden;
  background: #1a2030;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 14px;
  color: #7fd7ff;
  flex-shrink: 0;
}
.cmt-avatar img { width: 100%; height: 100%; object-fit: cover; }
.cmt-name { font-size: 12.5px; font-weight: 700; color: #9a9aa2; }
.cmt-text { margin: 2px 0 0; font-size: 14.5px; line-height: 1.4; word-break: break-word; }
.cmt-empty { text-align: center; color: #6d6d78; margin-top: 30px; }

.cmt-input {
  flex-shrink: 0;
  display: flex;
  gap: 8px;
  padding-top: 10px;
}
.cmt-input input {
  flex: 1;
  min-width: 0;
  height: 42px;
  border-radius: 21px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.07);
  color: #fff;
  padding: 0 15px;
  font-size: 15px;
  outline: none;
}
.cmt-input input::placeholder { color: #6d6d78; }
.cmt-input button {
  width: 42px;
  height: 42px;
  border-radius: 21px;
  border: none;
  background: linear-gradient(135deg, #0a84ff, #5e5ce6);
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  flex-shrink: 0;
}
.cmt-input button:disabled { opacity: 0.5; }
</style>

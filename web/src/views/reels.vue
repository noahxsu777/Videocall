<template>
  <div class="reels">
    <header class="reels-top">
      <span class="reels-title">Reels</span>
      <button class="reels-upload" @click="pickPhoto">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
        Subir
      </button>
    </header>

    <AppLoader v-if="loading" label="Cargando reels…" />

    <div v-else-if="!feed.length" class="state empty">
      <div class="empty-emoji">🎬</div>
      <p>Aún no hay reels.</p>
      <button class="empty-btn" @click="pickPhoto">Sube la primera foto o video</button>
    </div>

    <div v-else class="feed">
      <article v-for="item in feed" :key="item.id" class="reel">
        <video
          v-if="item.media_type === 'video'"
          :ref="(el) => registerVideo(item.id, el as HTMLVideoElement | null)"
          class="reel-img"
          :src="item.image_url"
          autoplay
          muted
          loop
          playsinline
          @click="toggleMute"
        />
        <img v-else class="reel-img" :src="item.image_url" :alt="item.caption || 'reel'" />

        <!-- Vertical action rail (like / comment), TikTok style -->
        <div class="rail">
          <button v-if="item.media_type === 'video'" class="rail-btn" @click="toggleMute">
            <svg v-if="muted" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="rgba(255,255,255,0.95)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m23 9-6 6M17 9l6 6"/></svg>
            <svg v-else viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="rgba(255,255,255,0.95)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14"/></svg>
            <span class="rail-count">{{ muted ? 'Silencio' : 'Sonido' }}</span>
          </button>
          <button class="rail-btn" @click="toggleLike(item)">
            <svg
              class="heart-icon"
              :class="{ 'heart-pop': popped.has(item.id) }"
              viewBox="0 0 24 24" width="30" height="30"
              :fill="liked.has(item.id) ? '#fe2c55' : 'rgba(255,255,255,0.95)'"
            ><path d="M12 21s-7.5-4.7-10-9.3C.6 8.9 2.3 5.6 5.3 5.1c1.8-.3 3.6.5 4.7 2 .5.7 1.5.7 2 0 1.1-1.5 2.9-2.3 4.7-2 3 .5 4.7 3.8 3.3 6.6C19.5 16.3 12 21 12 21Z"/></svg>
            <span class="rail-count">{{ stats[item.id]?.likes || 0 }}</span>
          </button>
          <button class="rail-btn" @click="openComments(item)">
            <svg viewBox="0 0 24 24" width="29" height="29" fill="rgba(255,255,255,0.95)"><path d="M12 3a9 9 0 0 0-8 13.2L2.6 20.3a1 1 0 0 0 1.26 1.26l4.1-1.37A9 9 0 1 0 12 3Z"/></svg>
            <span class="rail-count">{{ stats[item.id]?.comments || 0 }}</span>
          </button>
          <button class="rail-btn" @click="shareReel(item)">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="rgba(255,255,255,0.95)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-3.9M8.6 13.5l6.8 3.9"/></svg>
            <span class="rail-count">Compartir</span>
          </button>
          <button class="rail-btn" @click="menuFor = menuFor?.id === item.id ? null : item">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="rgba(255,255,255,0.95)"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
          </button>
        </div>

        <!-- Per-reel action menu (3 dots) -->
        <div v-if="menuFor?.id === item.id" class="reel-menu-backdrop" @click.self="menuFor = null">
          <div class="reel-menu">
            <button class="reel-menu-item" @click="shareReel(item); menuFor = null">
              <span class="rm-ic">🔗</span> Compartir
            </button>
            <button
              v-if="user && item.user_id === user.id"
              class="reel-menu-item danger"
              @click="removeReel(item)"
            >
              <span class="rm-ic">🗑️</span> Eliminar {{ item.media_type === 'video' ? 'video' : 'foto' }}
            </button>
            <button class="reel-menu-item cancel" @click="menuFor = null">Cancelar</button>
          </div>
        </div>

        <!-- Author + caption, above the bottom nav -->
        <div class="reel-overlay">
          <button class="reel-author" @click="openUser(item)">
            <span class="ra-avatar">
              <img v-if="item.author?.avatar_url" :src="item.author.avatar_url" alt="" />
              <span v-else>{{ authorInitial(item) }}</span>
            </span>
            <span class="ra-name">@{{ authorName(item) }}</span>
            <VerifiedBadge v-if="item.author?.verified" :size="22" class="ra-verified" />
          </button>
          <p v-if="item.caption" class="reel-caption">{{ item.caption }}</p>
        </div>
      </article>
    </div>

    <input ref="photoInput" type="file" accept="image/*,video/*" hidden @change="onPhotoSelected" />

    <!-- Instagram-style upload composer: preview + caption + Compartir -->
    <div v-if="composer" class="composer">
      <header class="composer-nav">
        <button class="composer-x" @click="closeComposer">✕</button>
        <span class="composer-title">Nueva publicación</span>
        <button class="composer-share" :disabled="composerUploading" @click="publishComposer">
          <span v-if="composerUploading" class="spinner-sm" />
          <span v-else>Compartir</span>
        </button>
      </header>
      <div class="composer-preview">
        <video v-if="composer.isVideo" :src="composer.url" autoplay muted loop playsinline />
        <img v-else :src="composer.url" alt="preview" />
      </div>
      <div class="composer-caption">
        <textarea
          v-model.trim="composer.caption"
          rows="3"
          maxlength="300"
          placeholder="Escribe una descripción…"
        />
        <span class="composer-count">{{ composer.caption.length }}/300</span>
      </div>
    </div>

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
              <span class="cmt-name">
                {{ c.author?.display_name || c.author?.username || 'Usuario' }}
                <VerifiedBadge v-if="c.author?.verified" :size="12" />
              </span>
              <p class="cmt-text">{{ c.content }}</p>
            </div>
            <button v-if="canDeleteComment(c)" class="cmt-del" @click="removeComment(c)">🗑️</button>
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
import { ref, onMounted, onUnmounted } from 'vue';
import { useAuth } from '../auth/useAuth';
import {
  listFeedPhotos,
  uploadMedia,
  uploadVideo,
  addPhoto,
  getPhotoStats,
  myLikedPhotoIds,
  likePhoto,
  unlikePhoto,
  listComments,
  addComment,
  deleteComment,
  deletePhoto,
  type FeedPhoto,
  type PhotoComment,
} from '../data/profiles';
import { saveCache, loadCache } from '../data/offlineCache';
import UserActionSheet, { type SheetTarget } from '../components/UserActionSheet.vue';
import VerifiedBadge from '../components/VerifiedBadge.vue';
import AppLoader from '../components/AppLoader.vue';

const { user } = useAuth();

const feed = ref<FeedPhoto[]>([]);
const loading = ref(true);
const toast = ref('');
const photoInput = ref<HTMLInputElement | null>(null);
const sheetOpen = ref(false);
const sheetTarget = ref<SheetTarget | null>(null);

const stats = ref<Record<string, { likes: number; comments: number }>>({});
const liked = ref<Set<string>>(new Set());
const popped = ref<Set<string>>(new Set());

// --- Video playback + sound -----------------------------------------------
// Videos start muted (required for mobile autoplay). Tapping the video or
// the speaker button toggles sound. Only the video currently in view plays
// (an IntersectionObserver pauses the others), so unmuting never blasts
// several clips at once — and the visible video keeps playing while the
// comments sheet is open on top of it.
const muted = ref(true);
const videoEls = new Map<string, HTMLVideoElement>();
let videoObserver: IntersectionObserver | null = null;

function registerVideo(id: string, el: HTMLVideoElement | null) {
  if (el) {
    el.muted = muted.value;
    videoEls.set(id, el);
    videoObserver?.observe(el);
  } else {
    const prev = videoEls.get(id);
    if (prev) {
      videoObserver?.unobserve(prev);
      videoEls.delete(id);
    }
  }
}

function toggleMute() {
  muted.value = !muted.value;
  for (const el of videoEls.values()) {
    el.muted = muted.value;
  }
  // Make sure the visible one is actually playing after an unmute tap.
  for (const el of videoEls.values()) {
    if (isMostlyVisible(el)) {
      void el.play().catch(() => {});
    }
  }
}

function isMostlyVisible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const visible = Math.min(r.bottom, vh) - Math.max(r.top, 0);
  return visible > r.height * 0.6;
}

// Sound is "on by default": videos must start muted so mobile autoplay
// works, but we unmute automatically on the user's very first interaction
// (a tap or scroll), so from their side sound is on the moment they touch
// the feed. Runs once.
let soundEnabled = false;
function enableSoundOnce() {
  if (soundEnabled) {
    return;
  }
  soundEnabled = true;
  muted.value = false;
  for (const el of videoEls.values()) {
    el.muted = false;
    if (isMostlyVisible(el)) {
      void el.play().catch(() => {});
    }
  }
  window.removeEventListener('pointerdown', enableSoundOnce);
  window.removeEventListener('touchstart', enableSoundOnce);
}

const composer = ref<{ file: File; url: string; isVideo: boolean; caption: string } | null>(null);
const composerUploading = ref(false);
const menuFor = ref<FeedPhoto | null>(null);
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

async function shareReel(item: FeedPhoto) {
  const url = `${location.origin}${location.pathname}#/reels`;
  const text = item.caption ? `${item.caption} — ` : '';
  const shareText = `${text}${url}`;

  // 1) Native share sheet, if available. A user cancelling it throws
  //    AbortError — that's not a failure, so we stop silently. Any OTHER
  //    error means share didn't work, so fall through to copy.
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Mira este reel en Hype Call', text, url });
      return;
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        return;
      }
      // fall through to clipboard
    }
  }

  // 2) Copy to clipboard (needs HTTPS — Vercel is, so this works).
  try {
    await navigator.clipboard.writeText(shareText);
    showToast('Enlace copiado ✓');
    return;
  } catch {
    // fall through to the last-resort prompt
  }

  // 3) Last resort: show the link so the user can copy it by hand.
  try {
    window.prompt('Copia este enlace:', shareText);
  } catch {
    showToast('No se pudo compartir en este navegador.');
  }
}

async function removeReel(item: FeedPhoto) {
  if (!user.value || item.user_id !== user.value.id) {
    return;
  }
  menuFor.value = null;
  try {
    await deletePhoto(item.id);
    feed.value = feed.value.filter(p => p.id !== item.id);
    showToast('Eliminado ✓');
  } catch (error: any) {
    showToast(`No se pudo eliminar: ${error?.message || 'error'}`);
  }
}

async function load() {
  loading.value = true;
  const cacheUser = user.value?.id || 'global';
  try {
    const fetched = await listFeedPhotos();
    if (fetched.length) {
      feed.value = fetched;
      // Cache a slice for offline viewing (localStorage is small and the
      // image data URLs are heavy, so keep it to the most recent dozen).
      saveCache(cacheUser, 'reels_feed', fetched.slice(0, 12));
    } else {
      // Empty likely means offline / a failed fetch — fall back to the
      // last feed we cached so the tab still shows something offline.
      const cached = loadCache<FeedPhoto[]>(cacheUser, 'reels_feed');
      feed.value = cached?.data || [];
    }
    const ids = feed.value.map(p => p.id);
    const [s, mine] = await Promise.all([
      getPhotoStats(ids).catch(() => ({} as Record<string, { likes: number; comments: number }>)),
      user.value ? myLikedPhotoIds(user.value.id, ids).catch(() => new Set<string>()) : Promise.resolve(new Set<string>()),
    ]);
    stats.value = s;
    liked.value = mine;
  } catch (error) {
    const cached = loadCache<FeedPhoto[]>(cacheUser, 'reels_feed');
    if (cached?.data?.length) {
      feed.value = cached.data;
    }
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
      popped.value.add(item.id);
      popped.value = new Set(popped.value);
      window.setTimeout(() => {
        popped.value.delete(item.id);
        popped.value = new Set(popped.value);
      }, 450);
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

// A comment can be removed by the person who wrote it OR by the owner of
// the reel it's on (creator moderation). The DB enforces the same rule.
function canDeleteComment(c: PhotoComment): boolean {
  if (!user.value) {
    return false;
  }
  return c.user_id === user.value.id || commentsFor.value?.user_id === user.value.id;
}

async function removeComment(c: PhotoComment) {
  if (!canDeleteComment(c)) {
    return;
  }
  try {
    await deleteComment(c.id);
    comments.value = comments.value.filter(x => x.id !== c.id);
    const entry = commentsFor.value ? stats.value[commentsFor.value.id] : null;
    if (entry) {
      entry.comments = Math.max(0, entry.comments - 1);
    }
  } catch (error: any) {
    showToast(`No se pudo eliminar: ${error?.message || 'error'}`);
  }
}

function pickPhoto() {
  photoInput.value?.click();
}

function onPhotoSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file || !user.value) {
    return;
  }
  const isVideo = file.type.startsWith('video/');
  // Instagram-style: don't upload yet — open the composer with a preview
  // and a caption field, and only upload when the user taps "Compartir".
  composer.value = { file, url: URL.createObjectURL(file), isVideo, caption: '' };
  if (photoInput.value) {
    photoInput.value.value = '';
  }
}

function closeComposer() {
  if (composer.value) {
    URL.revokeObjectURL(composer.value.url);
  }
  composer.value = null;
}

async function publishComposer() {
  if (!composer.value || !user.value) {
    return;
  }
  const { file, isVideo, caption } = composer.value;
  composerUploading.value = true;
  try {
    const url = isVideo
      ? await uploadVideo(user.value.id, file)
      : await uploadMedia(user.value.id, file, 1280, 0.72);
    await addPhoto(user.value.id, url, caption || '', isVideo ? 'video' : 'image');
    closeComposer();
    showToast('¡Publicado! 🎉');
    await load();
  } catch (error: any) {
    showToast(`Error: ${error?.message || 'no se pudo subir'}`);
  } finally {
    composerUploading.value = false;
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

onMounted(() => {
  videoObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const el = entry.target as HTMLVideoElement;
      if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
        el.muted = muted.value;
        void el.play().catch(() => {});
      } else {
        el.pause();
      }
    }
  }, { threshold: [0, 0.6, 1] });
  window.addEventListener('pointerdown', enableSoundOnce, { passive: true });
  window.addEventListener('touchstart', enableSoundOnce, { passive: true });
  void load();
});

onUnmounted(() => {
  videoObserver?.disconnect();
  videoObserver = null;
  window.removeEventListener('pointerdown', enableSoundOnce);
  window.removeEventListener('touchstart', enableSoundOnce);
});
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
  background: linear-gradient(135deg, #8b3dff, #ff2e74);
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
  background: linear-gradient(135deg, #8b3dff, #ff2e74);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

/* Instagram-style upload composer */
.composer {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: #0a0a0c;
  display: flex;
  flex-direction: column;
}
.composer-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 12px;
  border-bottom: 0.5px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}
.composer-x {
  background: none;
  border: none;
  color: #fff;
  font-size: 20px;
  cursor: pointer;
  width: 40px;
  text-align: left;
}
.composer-title { font-size: 16px; font-weight: 700; color: #fff; }
.composer-share {
  min-width: 92px;
  height: 34px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #8b3dff, #ff2e74);
  color: #fff;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.composer-share:disabled { opacity: 0.6; }
.spinner-sm {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.composer-preview {
  flex: 1;
  min-height: 0;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.composer-preview img,
.composer-preview video {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.composer-caption {
  position: relative;
  flex-shrink: 0;
  padding: 12px 14px calc(14px + env(safe-area-inset-bottom, 0));
  border-top: 0.5px solid rgba(255, 255, 255, 0.1);
}
.composer-caption textarea {
  width: 100%;
  box-sizing: border-box;
  background: none;
  border: none;
  outline: none;
  color: #fff;
  font-size: 15px;
  font-family: inherit;
  resize: none;
  line-height: 1.45;
}
.composer-caption textarea::placeholder { color: #6a6a70; }
.composer-count {
  position: absolute;
  right: 14px;
  bottom: calc(10px + env(safe-area-inset-bottom, 0));
  font-size: 11px;
  color: #6a6a70;
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

/* 3-dots action menu */
.reel-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
}
.reel-menu {
  width: 100%;
  padding: 8px;
  padding-bottom: calc(8px + env(safe-area-inset-bottom, 0));
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.reel-menu-item {
  height: 54px;
  border: none;
  border-radius: 14px;
  background: rgba(40, 40, 44, 0.98);
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
}
.reel-menu-item.danger { color: #ff453a; }
.reel-menu-item.cancel { color: #8e8e93; margin-top: 2px; }
.rm-ic { font-size: 18px; }
.heart-icon {
  transform-origin: center;
}
.heart-pop {
  animation: heart-pop-anim 0.45s ease-out;
}
@keyframes heart-pop-anim {
  0% { transform: scale(1); }
  30% { transform: scale(1.5); }
  55% { transform: scale(0.9); }
  100% { transform: scale(1); }
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
.ra-verified {
  margin-left: 5px;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.7));
}
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
.cmt { display: flex; gap: 10px; align-items: flex-start; }
.cmt-del {
  margin-left: auto;
  flex-shrink: 0;
  background: none;
  border: none;
  font-size: 15px;
  cursor: pointer;
  opacity: 0.6;
  padding: 2px 4px;
}
.cmt-del:active { opacity: 1; }
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
  background: linear-gradient(135deg, #8b3dff, #ff2e74);
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  flex-shrink: 0;
}
.cmt-input button:disabled { opacity: 0.5; }
</style>

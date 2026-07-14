<template>
  <div class="profile">
    <header class="profile-top">
      <button v-if="isOwnProfile" class="top-btn" @click="goSettings">⚙️</button>
      <GlassBackButton v-else @click="router.back()" />
      <span class="top-title">{{ profile?.display_name || profile?.username || 'Perfil' }}</span>
      <button v-if="isOwnProfile" class="top-btn" @click="handleLogout">Salir</button>
      <span v-else class="top-btn" />
    </header>

    <section class="profile-head">
      <div class="avatar-wrap" @click="isOwnProfile && pickAvatar()">
        <img v-if="profile?.avatar_url" :src="profile.avatar_url" class="avatar" alt="avatar" />
        <div v-else class="avatar avatar-fallback">{{ initial }}</div>
        <span v-if="isOwnProfile" class="avatar-edit">✎</span>
      </div>

      <div class="stats">
        <div class="stat">
          <strong>{{ counts.following }}</strong>
          <span>Siguiendo</span>
        </div>
        <div class="stat">
          <strong>{{ counts.followers }}</strong>
          <span>Seguidores</span>
        </div>
        <div class="stat">
          <strong>{{ photos.length }}</strong>
          <span>Fotos</span>
        </div>
      </div>
    </section>

    <div class="profile-meta">
      <div class="name">
        {{ profile?.display_name || '—' }}
        <span v-if="isVip" class="vip-badge">⭐ VIP</span>
      </div>
      <div v-if="profile?.username" class="username">@{{ profile.username }}</div>
      <p v-if="profile?.bio" class="bio">{{ profile.bio }}</p>
    </div>

    <div class="actions">
      <template v-if="isOwnProfile">
        <button class="btn btn-outline" @click="goSettings">Editar perfil</button>
        <button class="btn btn-outline" @click="pickPhoto">Subir foto</button>
      </template>
      <template v-else>
        <button
          class="btn"
          :class="following ? 'btn-outline' : 'btn-primary'"
          :disabled="followLoading"
          @click="toggleFollow"
        >
          {{ following ? 'Siguiendo' : 'Seguir' }}
        </button>
        <button class="btn btn-outline" @click="messageUser">Mensaje</button>
      </template>
    </div>

    <div v-if="loadError" class="load-error">{{ loadError }}</div>

    <div class="photos-grid">
      <div v-for="photo in photos" :key="photo.id" class="photo-cell">
        <img :src="photo.image_url" :alt="photo.caption || 'foto'" />
        <button v-if="isOwnProfile" class="photo-del" @click="removePhoto(photo.id)">×</button>
      </div>
      <div v-if="!photos.length" class="photos-empty">
        {{ isOwnProfile ? 'Aún no has subido fotos.' : 'Sin fotos todavía.' }}
      </div>
    </div>

    <input ref="avatarInput" type="file" accept="image/*" hidden @change="onAvatarSelected" />
    <input ref="photoInput" type="file" accept="image/*" hidden @change="onPhotoSelected" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import GlassBackButton from '../components/GlassBackButton.vue';
import { useAuth } from '../auth/useAuth';
import {
  getProfile,
  ensureProfile,
  updateProfile,
  getFollowCounts,
  isFollowing,
  follow,
  unfollow,
  uploadMedia,
  listPhotos,
  addPhoto,
  deletePhoto,
  isVipActive,
  type Profile,
  type Photo,
} from '../data/profiles';

const router = useRouter();
const route = useRoute();
const { user, displayName, logout } = useAuth();

const profile = ref<Profile | null>(null);
const photos = ref<Photo[]>([]);
const counts = ref({ followers: 0, following: 0 });
const following = ref(false);
const followLoading = ref(false);
const loadError = ref('');

const avatarInput = ref<HTMLInputElement | null>(null);
const photoInput = ref<HTMLInputElement | null>(null);

const routeUserId = computed(() => (route.params.id as string) || '');
const targetUserId = computed(() => routeUserId.value || user.value?.id || '');
const isOwnProfile = computed(() => !!user.value && targetUserId.value === user.value.id);
const initial = computed(() =>
  (profile.value?.display_name || displayName.value || '?').charAt(0).toUpperCase());
const isVip = computed(() => isVipActive(profile.value?.vip_until));

async function load() {
  loadError.value = '';
  const id = targetUserId.value;
  if (!id) {
    return;
  }
  try {
    if (isOwnProfile.value) {
      await ensureProfile(id, displayName.value);
    }
    const [p, ph, c] = await Promise.all([getProfile(id), listPhotos(id), getFollowCounts(id)]);
    profile.value = p;
    photos.value = ph;
    counts.value = c;
    if (!isOwnProfile.value && user.value) {
      following.value = await isFollowing(user.value.id, id);
    }
  } catch (error: any) {
    loadError.value = 'No se pudo cargar el perfil. ¿Ya creaste las tablas en Supabase?';
    console.error('[profile] load failed:', error);
  }
}

async function toggleFollow() {
  if (!user.value || isOwnProfile.value) {
    return;
  }
  followLoading.value = true;
  try {
    if (following.value) {
      await unfollow(user.value.id, targetUserId.value);
      following.value = false;
      counts.value.followers = Math.max(0, counts.value.followers - 1);
    } else {
      await follow(user.value.id, targetUserId.value);
      following.value = true;
      counts.value.followers += 1;
    }
  } catch (error) {
    console.error('[profile] follow toggle failed:', error);
  } finally {
    followLoading.value = false;
  }
}

function pickAvatar() {
  avatarInput.value?.click();
}
function pickPhoto() {
  photoInput.value?.click();
}

async function onAvatarSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file || !user.value) {
    return;
  }
  try {
    const url = await uploadMedia(user.value.id, file, 256, 0.85);
    await updateProfile(user.value.id, { avatar_url: url });
    if (profile.value) {
      profile.value.avatar_url = url;
    }
  } catch (error: any) {
    loadError.value = `No se pudo subir el avatar: ${error.message}`;
  }
}

async function onPhotoSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file || !user.value) {
    return;
  }
  try {
    const url = await uploadMedia(user.value.id, file);
    await addPhoto(user.value.id, url);
    photos.value = await listPhotos(user.value.id);
  } catch (error: any) {
    loadError.value = `No se pudo subir la foto: ${error.message}`;
  }
}

async function removePhoto(photoId: string) {
  try {
    await deletePhoto(photoId);
    photos.value = photos.value.filter(p => p.id !== photoId);
  } catch (error) {
    console.error('[profile] delete photo failed:', error);
  }
}

function goSettings() {
  router.push({ path: '/settings' });
}
function messageUser() {
  router.push({ path: '/messages', query: { user: targetUserId.value } });
}
async function handleLogout() {
  await logout();
  router.push({ path: '/login' });
}

onMounted(load);
watch(() => route.fullPath, load);
</script>

<style scoped>
.profile {
  min-height: 100vh;
  background: #010101;
  color: #fff;
  padding-bottom: 24px;
}
.profile-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 12px;
}
.top-btn {
  min-width: 44px;
  background: none;
  border: none;
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  text-align: center;
}
.top-title {
  font-size: 16px;
  font-weight: 700;
}

.profile-head {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 8px 20px 4px;
}
.avatar-wrap {
  position: relative;
  cursor: pointer;
}
.avatar {
  width: 84px;
  height: 84px;
  border-radius: 50%;
  object-fit: cover;
  background: #1a1a20;
}
.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34px;
  font-weight: 700;
  color: #fe2c55;
}
.avatar-edit {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #fe2c55;
  color: #fff;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #010101;
}
.stats {
  flex: 1;
  display: flex;
  justify-content: space-around;
}
.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.stat strong {
  font-size: 18px;
}
.stat span {
  font-size: 12px;
  color: #a1a1aa;
}

.profile-meta {
  padding: 6px 20px 0;
}
.name {
  font-size: 16px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}
.vip-badge {
  font-size: 11px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 8px;
  color: #1a1400;
  background: linear-gradient(135deg, #ffd75e, #ff9d2f);
}
.username {
  font-size: 13px;
  color: #a1a1aa;
}
.bio {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.5;
}

.actions {
  display: flex;
  gap: 10px;
  padding: 16px 20px;
}
.btn {
  flex: 1;
  height: 40px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
}
.btn-primary {
  background: #fe2c55;
  color: #fff;
}
.btn-outline {
  background: transparent;
  color: #fff;
  border: 1px solid #33333b;
}

.load-error {
  margin: 0 20px 12px;
  padding: 12px;
  border-radius: 8px;
  background: #2a1e0c;
  color: #ffcf8f;
  font-size: 13px;
}

.photos-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  padding: 0 2px;
}
.photo-cell {
  position: relative;
  aspect-ratio: 1;
  background: #111116;
}
.photo-cell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.photo-del {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 15px;
  cursor: pointer;
}
.photos-empty {
  grid-column: 1 / -1;
  text-align: center;
  color: #71717a;
  font-size: 14px;
  padding: 40px 0;
}
</style>

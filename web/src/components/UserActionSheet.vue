<template>
  <transition name="sheet">
    <div v-if="modelValue && target" class="sheet-backdrop" @click.self="close">
      <div class="sheet">
        <div class="sheet-grab" />

        <div class="sheet-user">
          <span class="su-avatar">
            <img v-if="target.avatarUrl" :src="target.avatarUrl" alt="" />
            <span v-else>{{ initial }}</span>
          </span>
          <div class="su-meta">
            <div class="su-name">
              {{ target.name }}
              <VerifiedBadge v-if="targetIsVerified" :size="18" />
              <span v-if="targetIsVip" class="su-vip">⭐ VIP</span>
            </div>
            <div v-if="counts" class="su-counts">
              {{ counts.followers }} seguidores · {{ counts.following }} siguiendo
            </div>
          </div>
        </div>

        <div v-if="!isSelf" class="sheet-actions">
          <button
            class="act"
            :class="following ? 'act-outline' : 'act-primary'"
            :disabled="busy"
            @click="toggleFollow"
          >
            {{ following ? (followsMe ? 'Amigos 🤝' : 'Siguiendo') : 'Seguir' }}
          </button>
          <button class="act act-outline" @click="message">Mensaje</button>
        </div>

        <!-- Live moderation: shown to the host and to moderators (per their
             granted permissions) when the sheet is opened inside a live. -->
        <template v-if="modActionsVisible">
          <div class="sheet-actions">
            <button
              v-if="moderation!.canMute"
              class="act act-outline"
              :disabled="modBusy"
              @click="doMute"
            >
              {{ targetIsMuted ? '🔊 Quitar silencio' : '🔇 Silenciar' }}
            </button>
            <button
              v-if="moderation!.canKick"
              class="act act-danger"
              :disabled="modBusy"
              @click="doKick"
            >
              ⛔ Expulsar
            </button>
          </div>
          <template v-if="moderation!.isHost">
            <button
              v-if="targetModPerms"
              class="sheet-view"
              :disabled="modBusy"
              @click="doRemoveMod"
            >
              🛡️ Quitar moderador
            </button>
            <button
              v-else
              class="sheet-view"
              @click="modFormOpen = !modFormOpen"
            >
              🛡️ Hacer moderador
            </button>
            <div v-if="modFormOpen && !targetModPerms" class="mod-form">
              <label class="mod-perm">
                <input v-model="permMute" type="checkbox" />
                <span>Puede silenciar usuarios</span>
              </label>
              <label class="mod-perm">
                <input v-model="permKick" type="checkbox" />
                <span>Puede expulsar usuarios</span>
              </label>
              <button class="act act-primary mod-confirm" :disabled="modBusy || (!permMute && !permKick)" @click="doMakeMod">
                Confirmar moderador
              </button>
            </div>
          </template>
        </template>

        <button class="sheet-view" @click="viewProfile">Ver perfil</button>
        <button class="sheet-cancel" @click="close">Cancelar</button>
      </div>
    </div>
  </transition>
</template>

<script lang="ts">
export interface SheetTarget {
  id: string;
  name: string;
  avatarUrl: string | null;
}

/**
 * Moderation context, passed only when the sheet opens inside a live:
 * who the host is, what the CURRENT user is allowed to do, and which
 * users are chat-muted right now (engine state, tracked by the parent).
 */
export interface SheetModeration {
  liveId: string;
  hostId: string;
  isHost: boolean;
  canMute: boolean;
  canKick: boolean;
  mutedIds: string[];
}
</script>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../auth/useAuth';
import VerifiedBadge from './VerifiedBadge.vue';
import {
  getProfile,
  getFollowCounts,
  isFollowing,
  follow,
  unfollow,
  isVipActive,
} from '../data/profiles';
import {
  getModPerms,
  setModerator,
  removeModerator,
  blockUser,
  type ModPerms,
} from '../data/moderation';

const props = defineProps<{
  modelValue: boolean;
  target: SheetTarget | null;
  moderation?: SheetModeration | null;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'followed', following: boolean): void;
  // Engine-level enforcement is the parent's job (it owns the room
  // engine); the sheet only writes the Supabase state and emits these.
  (e: 'mod-mute', target: SheetTarget, mute: boolean): void;
  (e: 'mod-kick', target: SheetTarget): void;
  (e: 'mod-promote', target: SheetTarget): void;
  (e: 'mod-demote', target: SheetTarget): void;
}>();

const router = useRouter();
const { user } = useAuth();

const following = ref(false);
// Mutual follow → the button reads "Amigos" instead of "Siguiendo".
const followsMe = ref(false);
const busy = ref(false);
const counts = ref<{ followers: number; following: number } | null>(null);
const targetIsVip = ref(false);
const targetIsVerified = ref(false);

const initial = computed(() => (props.target?.name || '?').charAt(0).toUpperCase());
const isSelf = computed(() => !!user.value && props.target?.id === user.value.id);

// --- Live moderation ------------------------------------------------------
const targetModPerms = ref<ModPerms | null>(null);
const modFormOpen = ref(false);
const permMute = ref(true);
const permKick = ref(true);
const modBusy = ref(false);

const modActionsVisible = computed(() =>
  !!props.moderation
  && !!props.target
  && !isSelf.value
  && props.target.id !== props.moderation.hostId
  && (props.moderation.canMute || props.moderation.canKick || props.moderation.isHost));

const targetIsMuted = computed(() =>
  !!props.target && !!props.moderation?.mutedIds.includes(props.target.id));

function doMute() {
  if (props.target) {
    emit('mod-mute', props.target, !targetIsMuted.value);
  }
}

async function doKick() {
  if (!props.target || !user.value || !props.moderation) {
    return;
  }
  modBusy.value = true;
  try {
    // Block first so re-entry is already denied by the time the engine
    // kick lands; the parent handles the engine part.
    await blockUser(props.moderation.liveId, props.target, user.value.id);
    emit('mod-kick', props.target);
    close();
  } catch (error) {
    console.warn('[sheet] block failed:', error);
  } finally {
    modBusy.value = false;
  }
}

async function doMakeMod() {
  if (!props.target || !user.value || !props.moderation) {
    return;
  }
  modBusy.value = true;
  try {
    const perms = { canMute: permMute.value, canKick: permKick.value };
    await setModerator(props.moderation.liveId, props.target, perms, user.value.id);
    targetModPerms.value = perms;
    modFormOpen.value = false;
    emit('mod-promote', props.target);
  } catch (error) {
    console.warn('[sheet] set moderator failed:', error);
  } finally {
    modBusy.value = false;
  }
}

async function doRemoveMod() {
  if (!props.target || !props.moderation) {
    return;
  }
  modBusy.value = true;
  try {
    await removeModerator(props.moderation.liveId, props.target.id);
    targetModPerms.value = null;
    emit('mod-demote', props.target);
  } catch (error) {
    console.warn('[sheet] remove moderator failed:', error);
  } finally {
    modBusy.value = false;
  }
}

watch(
  () => [props.modelValue, props.target?.id],
  async () => {
    if (!props.modelValue || !props.target) {
      return;
    }
    counts.value = null;
    following.value = false;
    followsMe.value = false;
    targetIsVip.value = false;
    targetIsVerified.value = false;
    targetModPerms.value = null;
    modFormOpen.value = false;
    permMute.value = true;
    permKick.value = true;
    if (props.moderation?.isHost && props.target && props.target.id !== props.moderation.hostId) {
      void getModPerms(props.moderation.liveId, props.target.id)
        .then((perms) => { targetModPerms.value = perms; })
        .catch(() => {});
    }
    try {
      const [c, prof] = await Promise.all([
        getFollowCounts(props.target.id),
        getProfile(props.target.id),
      ]);
      counts.value = c;
      targetIsVip.value = isVipActive(prof?.vip_until);
      targetIsVerified.value = !!prof?.verified;
      if (user.value && !isSelf.value) {
        [following.value, followsMe.value] = await Promise.all([
          isFollowing(user.value.id, props.target.id),
          isFollowing(props.target.id, user.value.id),
        ]);
      }
    } catch (error) {
      console.warn('[sheet] load failed:', error);
    }
  },
  { immediate: true },
);

function close() {
  emit('update:modelValue', false);
}

async function toggleFollow() {
  if (!user.value || !props.target || isSelf.value) {
    return;
  }
  busy.value = true;
  try {
    if (following.value) {
      await unfollow(user.value.id, props.target.id);
      following.value = false;
    } else {
      await follow(user.value.id, props.target.id);
      following.value = true;
    }
    if (counts.value) {
      counts.value.followers += following.value ? 1 : -1;
    }
    emit('followed', following.value);
  } catch (error) {
    console.warn('[sheet] follow failed:', error);
  } finally {
    busy.value = false;
  }
}

function message() {
  const id = props.target?.id;
  close();
  router.push({ path: '/messages', query: id ? { user: id } : {} });
}
function viewProfile() {
  if (!props.target) {
    return;
  }
  close();
  router.push({ path: `/profile/${props.target.id}` });
}
</script>

<style scoped>
.sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  -webkit-backdrop-filter: blur(2px);
  backdrop-filter: blur(2px);
}
.sheet {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 16px calc(20px + env(safe-area-inset-bottom, 0));
  background: rgba(28, 28, 32, 0.96);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  backdrop-filter: blur(24px) saturate(180%);
  border-top-left-radius: 22px;
  border-top-right-radius: 22px;
  border-top: 0.5px solid rgba(255, 255, 255, 0.12);
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
}
.sheet-grab {
  width: 38px;
  height: 5px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.25);
  margin: 4px auto 14px;
}

.sheet-user {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 4px 16px;
}
.su-avatar {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  overflow: hidden;
  background: #1a2030;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 800;
  color: #25f4ee;
  flex-shrink: 0;
}
.su-avatar img { width: 100%; height: 100%; object-fit: cover; }
.su-name {
  font-size: 17px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}
.su-vip {
  position: relative;
  overflow: hidden;
  font-size: 10px;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 7px;
  color: #1a1400;
  background: linear-gradient(135deg, #ffd75e, #ff9d2f);
}
.su-vip::after {
  content: '';
  position: absolute;
  top: -60%;
  left: -60%;
  width: 40%;
  height: 220%;
  background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.75), transparent);
  transform: rotate(18deg);
  animation: su-vip-shine 3.2s ease-in-out infinite;
}
@keyframes su-vip-shine {
  0% { left: -60%; }
  55% { left: 140%; }
  100% { left: 140%; }
}
.su-counts {
  margin-top: 3px;
  font-size: 13px;
  color: #9a9aa2;
}

.sheet-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}
.act {
  flex: 1;
  height: 46px;
  border-radius: 13px;
  border: none;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}
.act-primary {
  background: linear-gradient(135deg, #8b3dff, #ff2e74);
  color: #fff;
}
.act-outline {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}
.act-danger {
  background: rgba(255, 59, 48, 0.18);
  color: #ff6f6f;
}
.act:disabled { opacity: 0.6; }

.mod-form {
  margin-top: 8px;
  padding: 12px 14px;
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.mod-perm {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
}
.mod-perm input {
  width: 18px;
  height: 18px;
  accent-color: #ff2e74;
}
.mod-confirm { height: 42px; }

.sheet-view,
.sheet-cancel {
  width: 100%;
  height: 46px;
  border-radius: 13px;
  border: none;
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 8px;
}
.sheet-cancel { color: #ff6f8b; }

/* transitions */
.sheet-enter-active,
.sheet-leave-active { transition: opacity 0.2s ease; }
.sheet-enter-active .sheet,
.sheet-leave-active .sheet { transition: transform 0.26s cubic-bezier(0.32, 0.72, 0, 1); }
.sheet-enter-from,
.sheet-leave-to { opacity: 0; }
.sheet-enter-from .sheet,
.sheet-leave-to .sheet { transform: translateY(100%); }
</style>

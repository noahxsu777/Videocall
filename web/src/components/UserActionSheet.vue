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
            {{ following ? 'Siguiendo' : 'Seguir' }}
          </button>
          <button class="act act-outline" @click="message">Mensaje</button>
        </div>

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
</script>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../auth/useAuth';
import {
  getProfile,
  getFollowCounts,
  isFollowing,
  follow,
  unfollow,
  isVipActive,
} from '../data/profiles';

const props = defineProps<{
  modelValue: boolean;
  target: SheetTarget | null;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'followed', following: boolean): void;
}>();

const router = useRouter();
const { user } = useAuth();

const following = ref(false);
const busy = ref(false);
const counts = ref<{ followers: number; following: number } | null>(null);
const targetIsVip = ref(false);

const initial = computed(() => (props.target?.name || '?').charAt(0).toUpperCase());
const isSelf = computed(() => !!user.value && props.target?.id === user.value.id);

watch(
  () => [props.modelValue, props.target?.id],
  async () => {
    if (!props.modelValue || !props.target) {
      return;
    }
    counts.value = null;
    following.value = false;
    targetIsVip.value = false;
    try {
      const [c, prof] = await Promise.all([
        getFollowCounts(props.target.id),
        getProfile(props.target.id),
      ]);
      counts.value = c;
      targetIsVip.value = isVipActive(prof?.vip_until);
      if (user.value && !isSelf.value) {
        following.value = await isFollowing(user.value.id, props.target.id);
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
  close();
  router.push({ path: '/messages' });
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
  font-size: 10px;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 7px;
  color: #1a1400;
  background: linear-gradient(135deg, #ffd75e, #ff9d2f);
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
  background: linear-gradient(135deg, #0a84ff, #5e5ce6);
  color: #fff;
}
.act-outline {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}
.act:disabled { opacity: 0.6; }

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

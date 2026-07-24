<template>
  <transition name="sheet">
    <div v-if="modelValue" class="sheet-backdrop" @click.self="close">
      <div class="sheet">
        <div class="sheet-grab" />
        <div class="sheet-title">Moderación del live</div>

        <div class="tabs">
          <button class="tab" :class="{ active: tab === 'mods' }" @click="tab = 'mods'">
            🛡️ Moderadores
          </button>
          <button class="tab" :class="{ active: tab === 'blocked' }" @click="tab = 'blocked'">
            ⛔ Bloqueados
          </button>
        </div>

        <div class="list">
          <template v-if="tab === 'mods'">
            <div v-for="m in moderators" :key="m.user_id" class="row">
              <span class="row-avatar">
                <img v-if="m.avatar_url" :src="m.avatar_url" alt="" />
                <span v-else>{{ (m.name || '?').charAt(0).toUpperCase() }}</span>
              </span>
              <span class="row-mid">
                <span class="row-name">{{ m.name || 'Usuario' }}</span>
                <span class="row-sub">
                  {{ [m.can_mute ? 'Silenciar' : '', m.can_kick ? 'Expulsar' : ''].filter(Boolean).join(' · ') || 'Sin permisos' }}
                </span>
              </span>
              <button class="row-btn" :disabled="busy" @click="removeMod(m)">Quitar</button>
            </div>
            <p v-if="!loading && !moderators.length" class="empty">Aún no has nombrado moderadores. Toca a un usuario en el chat para hacerlo moderador.</p>
          </template>
          <template v-else>
            <div v-for="b in blocked" :key="b.user_id" class="row">
              <span class="row-avatar">
                <img v-if="b.avatar_url" :src="b.avatar_url" alt="" />
                <span v-else>{{ (b.name || '?').charAt(0).toUpperCase() }}</span>
              </span>
              <span class="row-mid">
                <span class="row-name">{{ b.name || 'Usuario' }}</span>
                <span class="row-sub">Expulsado del live</span>
              </span>
              <button class="row-btn" :disabled="busy" @click="unblock(b)">Desbloquear</button>
            </div>
            <p v-if="!loading && !blocked.length" class="empty">Nadie está bloqueado en este live.</p>
          </template>
          <p v-if="loading" class="empty">Cargando…</p>
        </div>

        <button class="sheet-cancel" @click="close">Cerrar</button>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  listModerators,
  listBlocked,
  removeModerator,
  unblockUser,
  type ModeratorRow,
  type BlockRow,
} from '../data/moderation';

const props = defineProps<{
  modelValue: boolean;
  liveId: string;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  // Parent demotes the user's engine role (admin → general) best-effort.
  (e: 'mod-demote', userId: string): void;
}>();

const tab = ref<'mods' | 'blocked'>('mods');
const moderators = ref<ModeratorRow[]>([]);
const blocked = ref<BlockRow[]>([]);
const loading = ref(false);
const busy = ref(false);

async function refresh() {
  if (!props.liveId) {
    return;
  }
  loading.value = true;
  try {
    [moderators.value, blocked.value] = await Promise.all([
      listModerators(props.liveId),
      listBlocked(props.liveId),
    ]);
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      tab.value = 'mods';
      void refresh();
    }
  },
);

async function removeMod(m: ModeratorRow) {
  busy.value = true;
  try {
    await removeModerator(props.liveId, m.user_id);
    moderators.value = moderators.value.filter(x => x.user_id !== m.user_id);
    emit('mod-demote', m.user_id);
  } catch (error) {
    console.warn('[moderation] remove failed:', error);
  } finally {
    busy.value = false;
  }
}

async function unblock(b: BlockRow) {
  busy.value = true;
  try {
    await unblockUser(props.liveId, b.user_id);
    blocked.value = blocked.value.filter(x => x.user_id !== b.user_id);
  } catch (error) {
    console.warn('[moderation] unblock failed:', error);
  } finally {
    busy.value = false;
  }
}

function close() {
  emit('update:modelValue', false);
}
</script>

<style scoped>
.sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 5200;
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
.sheet-title {
  text-align: center;
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 14px;
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.tab {
  flex: 1;
  height: 38px;
  border: none;
  border-radius: 19px;
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.7);
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
}
.tab.active {
  background: linear-gradient(90deg, #ff2e74, #9b2df7);
  color: #fff;
}

.list {
  max-height: 46vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 2px;
}
.row-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  overflow: hidden;
  background: #1a2030;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  font-weight: 800;
  flex-shrink: 0;
}
.row-avatar img { width: 100%; height: 100%; object-fit: cover; }
.row-mid {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.row-name {
  font-size: 14.5px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row-sub { font-size: 12px; color: #9a9aa2; }
.row-btn {
  flex-shrink: 0;
  height: 32px;
  padding: 0 14px;
  border: none;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
}
.row-btn:disabled { opacity: 0.5; }
.empty {
  text-align: center;
  color: #9a9aa2;
  font-size: 13px;
  margin: 18px 8px;
}

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
  margin-top: 10px;
}

.sheet-enter-active,
.sheet-leave-active { transition: opacity 0.2s ease; }
.sheet-enter-active .sheet,
.sheet-leave-active .sheet { transition: transform 0.26s cubic-bezier(0.32, 0.72, 0, 1); }
.sheet-enter-from,
.sheet-leave-to { opacity: 0; }
.sheet-enter-from .sheet,
.sheet-leave-to .sheet { transform: translateY(100%); }
</style>

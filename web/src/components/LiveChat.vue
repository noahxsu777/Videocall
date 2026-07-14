<template>
  <div class="live-chat">
    <!-- Message list (newest at the bottom) -->
    <div ref="listEl" class="lc-list">
      <div v-for="(m, i) in visibleMessages" :key="m.sequence ?? i" class="lc-msg">
        <button class="lc-author" @click="openUser(m)">{{ senderName(m) }}</button>
        <span v-if="isVipOnly(m)" class="lc-lock" title="Mensaje VIP">🔒</span>
        <span class="lc-text">{{ m.textContent }}</span>
      </div>
    </div>

    <!-- Input row (host / viewers can type; VIP lock sends a silent msg) -->
    <div class="lc-input">
      <button
        class="lc-vip"
        :class="{ on: vipMode }"
        :title="canVip ? 'Mensaje silencioso (solo anfitrión y VIP)' : 'Hazte VIP para enviar mensajes silenciosos'"
        @click="toggleVip"
      >🔒</button>
      <input
        v-model="draft"
        class="lc-field"
        :placeholder="vipMode ? 'Mensaje VIP (silencioso)…' : 'Escribe un mensaje…'"
        @keyup.enter="send"
      />
      <button class="lc-send" :disabled="!draft.trim()" @click="send">➤</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { useBarrageState } from 'tuikit-atomicx-vue3';
import { useRouter } from 'vue-router';
import { useAuth } from '../auth/useAuth';
import { getProfile, isVipActive } from '../data/profiles';
import type { SheetTarget } from './UserActionSheet.vue';

const props = defineProps<{ isHost?: boolean }>();
const emit = defineEmits<{ (e: 'open-user', target: SheetTarget): void }>();

const router = useRouter();
const { user, displayName } = useAuth();
const { messageList, sendTextMessage } = useBarrageState();

const draft = ref('');
const vipMode = ref(false);
const iAmVip = ref(false);
const listEl = ref<HTMLElement | null>(null);

// Host and VIP may send + read silent messages.
const canVip = computed(() => !!props.isHost || iAmVip.value);

function isVipOnly(m: any): boolean {
  return m?.extensionInfo?.vipOnly === '1';
}
function senderName(m: any): string {
  return m?.sender?.userName || m?.sender?.nameCard || 'Usuario';
}

// Silent messages are only rendered for the host and VIP viewers. Everyone
// receives them over the wire, but non-VIP clients simply don't show them.
const visibleMessages = computed(() =>
  (messageList.value || []).filter(m => !isVipOnly(m) || canVip.value));

function toggleVip() {
  if (!canVip.value) {
    router.push('/vip');
    return;
  }
  vipMode.value = !vipMode.value;
}

async function send() {
  const text = draft.value.trim();
  if (!text) {
    return;
  }
  const extensionInfo: Record<string, string> = {};
  if (user.value) {
    extensionInfo.uid = user.value.id;
  }
  if (vipMode.value && canVip.value) {
    extensionInfo.vipOnly = '1';
  }
  draft.value = '';
  try {
    await sendTextMessage({ text, extensionInfo });
  } catch (error) {
    console.warn('[LiveChat] send failed:', error);
  }
}

function openUser(m: any) {
  const id = m?.extensionInfo?.uid;
  if (!id) {
    return;
  }
  emit('open-user', {
    id,
    name: senderName(m),
    avatarUrl: m?.sender?.avatarUrl || null,
  });
}

watch(
  () => visibleMessages.value.length,
  async () => {
    await nextTick();
    if (listEl.value) {
      listEl.value.scrollTop = listEl.value.scrollHeight;
    }
  },
);

onMounted(async () => {
  if (!user.value) {
    return;
  }
  try {
    const p = await getProfile(user.value.id);
    iAmVip.value = isVipActive(p?.vip_until);
  } catch {
    iAmVip.value = false;
  }
  // Touch displayName so the linter keeps the import used for future needs.
  void displayName.value;
});
</script>

<style scoped>
.live-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  pointer-events: auto;
}
.lc-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px 0;
  -webkit-mask-image: linear-gradient(180deg, transparent 0, #000 18%);
  mask-image: linear-gradient(180deg, transparent 0, #000 18%);
}
.lc-msg {
  align-self: flex-start;
  max-width: 90%;
  padding: 6px 11px;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.4);
  font-size: 13px;
  line-height: 1.35;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}
.lc-author {
  background: none;
  border: none;
  padding: 0;
  margin-right: 5px;
  color: #7fd7ff;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}
.lc-lock { margin-right: 4px; }
.lc-text { color: #fff; }

.lc-input {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  pointer-events: auto;
}
.lc-vip {
  width: 40px;
  height: 40px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(0, 0, 0, 0.4);
  font-size: 16px;
  cursor: pointer;
  flex-shrink: 0;
}
.lc-vip.on {
  background: linear-gradient(135deg, #ffd75e, #ff9d2f);
  border-color: transparent;
}
.lc-field {
  flex: 1;
  min-width: 0;
  height: 40px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  padding: 0 14px;
  font-size: 14px;
  outline: none;
}
.lc-field::placeholder { color: rgba(255, 255, 255, 0.5); }
.lc-send {
  width: 40px;
  height: 40px;
  border-radius: 20px;
  border: none;
  background: linear-gradient(135deg, #0a84ff, #5e5ce6);
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  flex-shrink: 0;
}
.lc-send:disabled { opacity: 0.5; }
</style>

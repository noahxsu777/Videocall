<template>
  <div class="live-chat">
    <!-- Message list (newest at the bottom) -->
    <div v-if="!hideList" ref="listEl" class="lc-list">
      <div
        v-for="(m, i) in visibleMessages"
        :key="m.sequence ?? i"
        class="lc-msg"
        :class="{ 'lc-msg-vip': isVipOnly(m) }"
      >
        <span v-if="isVipOnly(m)" class="lc-vip-tag">🔒 VIP · Privado</span>
        <div class="lc-msg-body">
          <button class="lc-author" :class="{ 'lc-author-vip': isVipOnly(m) }" @click="openUser(m)">
            {{ senderName(m) }}
          </button>
          <span class="lc-text" :class="{ 'lc-text-vip': isVipOnly(m) }">{{ m.textContent }}</span>
        </div>
      </div>
    </div>

    <!-- Input row. The VIP whisper toggle is viewer-only (VIP viewers
         whisper privately to the host — the host never sends these). -->
    <div v-if="!hideInput" class="lc-input">
      <button
        v-if="!props.isHost"
        class="lc-vip"
        :class="{ on: vipMode }"
        :disabled="disabled"
        :title="iAmVip ? 'Mensaje VIP privado (solo lo ve el anfitrión)' : 'Hazte VIP para enviar mensajes privados'"
        @click="toggleVip"
      >🔒</button>
      <input
        v-model="draft"
        class="lc-field"
        :class="{ 'lc-field-vip': vipMode }"
        :placeholder="inputPlaceholder"
        :disabled="disabled"
        @keyup.enter="send"
        @focus="emit('focus')"
        @blur="emit('blur')"
      />
      <button class="lc-send" :class="{ 'lc-send-vip': vipMode }" :disabled="!draft.trim() || disabled" @click="send">➤</button>
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

const props = defineProps<{
  isHost?: boolean;
  disabled?: boolean;
  disabledPlaceholder?: string;
  hideList?: boolean;
  hideInput?: boolean;
}>();
const emit = defineEmits<{
  (e: 'open-user', target: SheetTarget): void;
  (e: 'focus'): void;
  (e: 'blur'): void;
}>();

const router = useRouter();
const { user } = useAuth();
const { messageList, sendTextMessage } = useBarrageState();

const draft = ref('');
const vipMode = ref(false);
const iAmVip = ref(false);
const listEl = ref<HTMLElement | null>(null);

// Only VIEWERS send private whispers — a VIP viewer whispering to the
// host. The host has no reason to whisper on their own broadcast, so the
// toggle is hidden entirely for them (see template `v-if="!props.isHost"`).
const canSendVip = computed(() => !props.isHost && iAmVip.value);

const inputPlaceholder = computed(() => {
  if (props.disabled) {
    return props.disabledPlaceholder || '';
  }
  return vipMode.value ? 'Mensaje privado para el anfitrión…' : 'Escribe un mensaje…';
});

function isVipOnly(m: any): boolean {
  return m?.extensionInfo?.vipOnly === '1';
}
function senderName(m: any): string {
  return m?.sender?.userName || m?.sender?.nameCard || 'Usuario';
}
function isMine(m: any): boolean {
  return !!user.value && m?.extensionInfo?.uid === user.value.id;
}

// Whisper privacy: only the host reads every whisper (that's the whole
// point — a private line to the streamer); the sender also sees their own
// message so they know it went through. No one else — not even other
// VIP viewers — sees someone else's whisper.
const visibleMessages = computed(() =>
  (messageList.value || []).filter(m => !isVipOnly(m) || props.isHost || isMine(m)));

function toggleVip() {
  if (!canSendVip.value) {
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
  if (vipMode.value && canSendVip.value) {
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
/* VIP whisper: warm amber/gold treatment so it reads unmistakably
   differently from a normal chat bubble. */
.lc-msg-vip {
  background: rgba(74, 48, 6, 0.55);
  border: 1px solid rgba(255, 200, 87, 0.5);
  box-shadow: 0 0 0 1px rgba(255, 200, 87, 0.12) inset;
}
.lc-vip-tag {
  display: block;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.3px;
  color: #ffd75e;
  margin-bottom: 2px;
}
.lc-msg-body {
  display: flex;
  flex-wrap: wrap;
  gap: 0 5px;
}
.lc-author {
  background: none;
  border: none;
  padding: 0;
  color: #7fd7ff;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}
.lc-author-vip { color: #ffe4a3; }
.lc-text { color: #fff; }
.lc-text-vip { color: #ffe9bd; font-weight: 500; }

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
.lc-vip:disabled,
.lc-field:disabled { opacity: 0.5; }
.lc-field-vip {
  border-color: rgba(255, 200, 87, 0.6);
  background: rgba(74, 48, 6, 0.4);
}
.lc-field-vip::placeholder { color: rgba(255, 224, 163, 0.75); }
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
.lc-send-vip {
  background: linear-gradient(135deg, #ffd75e, #ff9d2f);
}
.lc-send:disabled { opacity: 0.5; }
</style>

<template>
  <div class="messages">
    <header class="msg-top">
      <span class="msg-title">Mensajes</span>
      <div class="msg-top-actions">
        <button class="new-chat" title="Tarifa de llamadas" @click="callSettingsOpen = true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.36.4.66.73.85.32.19.7.27 1.07.24H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>
        </button>
        <button class="new-chat" @click="openNewChat">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
      </div>
    </header>

    <CallSettingsSheet v-model="callSettingsOpen" />

    <!-- New chat: search users -->
    <div v-if="newOpen" class="search-panel">
      <input
        v-model.trim="searchQ"
        class="search-field"
        type="text"
        placeholder="Busca por nombre o @usuario"
        @input="onSearch"
      />
      <p v-if="!searchQ && suggestions.length" class="search-hint">Personas que sigues</p>
      <button
        v-for="p in (searchQ ? searchResults : suggestions)"
        :key="p.id"
        class="user-row"
        @click="openThreadWith(p)"
      >
        <span class="u-avatar">
          <img v-if="p.avatar_url" :src="p.avatar_url" alt="" />
          <span v-else>{{ (p.display_name || '?').charAt(0).toUpperCase() }}</span>
        </span>
        <span class="u-name">{{ p.display_name || p.username || 'Usuario' }}</span>
      </button>
      <p v-if="searchQ && !searchResults.length" class="search-hint">Sin resultados.</p>
    </div>

    <!-- Conversations -->
    <div v-if="loadingList" class="state">Cargando…</div>
    <div v-else-if="!conversations.length && !newOpen" class="state empty">
      <div class="empty-emoji">💬</div>
      <p>Aún no tienes chats.</p>
      <button class="empty-btn" @click="openNewChat">Empieza una conversación</button>
    </div>
    <div v-else class="convo-list">
      <button
        v-for="c in conversations"
        :key="c.peer.id"
        class="convo"
        @click="openThreadWith(c.peer)"
      >
        <span class="u-avatar big">
          <img v-if="c.peer.avatar_url" :src="c.peer.avatar_url" alt="" />
          <span v-else>{{ (c.peer.display_name || '?').charAt(0).toUpperCase() }}</span>
        </span>
        <span class="convo-mid">
          <span class="convo-name">{{ c.peer.display_name || c.peer.username || 'Usuario' }}</span>
          <span class="convo-snippet" :class="{ unread: c.unread }">
            {{ c.last.kind === 'call' ? '📹 Videollamada' : c.last.content }}
          </span>
        </span>
        <span class="convo-right">
          <span class="convo-time">{{ fmtTime(c.last.created_at) }}</span>
          <span v-if="c.unread" class="convo-badge">{{ c.unread }}</span>
        </span>
      </button>
    </div>

    <!-- Thread overlay (covers the bottom nav) -->
    <div v-if="activePeer" class="thread">
      <header class="thread-top">
        <GlassBackButton @click="closeThread" />
        <button class="thread-user" @click="viewPeerProfile">
          <span class="u-avatar">
            <img v-if="activePeer.avatar_url" :src="activePeer.avatar_url" alt="" />
            <span v-else>{{ (activePeer.display_name || '?').charAt(0).toUpperCase() }}</span>
          </span>
          <span class="thread-name">{{ activePeer.display_name || activePeer.username || 'Usuario' }}</span>
        </button>
        <button class="call-btn" title="Videollamada" :disabled="callState === 'starting'" @click="startCall">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>
        </button>
      </header>

      <p v-if="callError" class="call-error">{{ callError }}</p>

      <div ref="threadEl" class="thread-list">
        <div
          v-for="m in thread"
          :key="m.id"
          class="bubble-row"
          :class="{ mine: m.sender_id === myId }"
        >
          <div v-if="m.kind === 'call'" class="bubble call-bubble">
            <span class="call-ic">📹</span>
            <span v-if="m.sender_id === myId">Videollamada iniciada</span>
            <button v-else class="call-join" @click="joinCall(m)">Unirse a la videollamada</button>
          </div>
          <div v-else class="bubble">{{ m.content }}</div>
        </div>
        <p v-if="!thread.length" class="thread-empty">Di hola 👋</p>
      </div>

      <div class="thread-input">
        <input
          v-model="draft"
          class="thread-field"
          type="text"
          placeholder="Escribe un mensaje…"
          @keyup.enter="send"
        />
        <button class="thread-send" :disabled="!draft.trim() || sending" @click="send">➤</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import GlassBackButton from '../components/GlassBackButton.vue';
import CallSettingsSheet from '../components/CallSettingsSheet.vue';
import { useAuth } from '../auth/useAuth';
import { getProfile, type Profile } from '../data/profiles';
import { getCallRate, getCoins, ringUser } from '../data/calls';
import {
  listConversations,
  fetchThread,
  sendDirectMessage,
  markThreadRead,
  subscribeInbox,
  searchUsers,
  listFollowingProfiles,
  type Conversation,
  type DirectMessage,
} from '../data/messages';

const router = useRouter();
const route = useRoute();
const { user, displayName } = useAuth();
const myId = user.value?.id || '';

const conversations = ref<Conversation[]>([]);
const loadingList = ref(true);
const newOpen = ref(false);
const searchQ = ref('');
const searchResults = ref<Profile[]>([]);
const suggestions = ref<Profile[]>([]);
const activePeer = ref<Profile | null>(null);
const thread = ref<DirectMessage[]>([]);
const draft = ref('');
const sending = ref(false);
const threadEl = ref<HTMLElement | null>(null);
const callSettingsOpen = ref(false);
const callError = ref('');
const callState = ref<'idle' | 'starting'>('idle');

let unsubscribe: (() => void) | null = null;
let pollTimer: number | null = null;
let searchTimer: number | null = null;

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
}

async function loadList() {
  if (!myId) {
    return;
  }
  try {
    conversations.value = await listConversations(myId);
  } catch (error) {
    console.warn('[messages] list failed:', error);
  } finally {
    loadingList.value = false;
  }
}

async function openNewChat() {
  newOpen.value = !newOpen.value;
  searchQ.value = '';
  searchResults.value = [];
  if (newOpen.value && !suggestions.value.length && myId) {
    try {
      suggestions.value = await listFollowingProfiles(myId);
    } catch {
      suggestions.value = [];
    }
  }
}

function onSearch() {
  if (searchTimer) {
    window.clearTimeout(searchTimer);
  }
  searchTimer = window.setTimeout(async () => {
    if (!searchQ.value || !myId) {
      searchResults.value = [];
      return;
    }
    try {
      searchResults.value = await searchUsers(myId, searchQ.value);
    } catch {
      searchResults.value = [];
    }
  }, 250);
}

async function scrollThreadDown() {
  await nextTick();
  if (threadEl.value) {
    threadEl.value.scrollTop = threadEl.value.scrollHeight;
  }
}

async function openThreadWith(peer: Profile) {
  newOpen.value = false;
  activePeer.value = peer;
  thread.value = [];
  try {
    thread.value = await fetchThread(myId, peer.id);
    await markThreadRead(myId, peer.id);
    loadList();
  } catch (error) {
    console.warn('[messages] thread failed:', error);
  }
  scrollThreadDown();
}

function closeThread() {
  activePeer.value = null;
  loadList();
}

function viewPeerProfile() {
  if (activePeer.value) {
    router.push({ path: `/profile/${activePeer.value.id}` });
  }
}

async function send() {
  const text = draft.value.trim();
  if (!text || !activePeer.value || !myId || sending.value) {
    return;
  }
  sending.value = true;
  draft.value = '';
  try {
    const m = await sendDirectMessage(myId, activePeer.value.id, text);
    thread.value.push(m);
    scrollThreadDown();
  } catch (error: any) {
    draft.value = text;
    console.warn('[messages] send failed:', error);
  } finally {
    sending.value = false;
  }
}

// Real 1-to-1 video call: WebRTC peer connection signaled over Supabase
// Realtime (see src/data/calls.ts + src/views/call.vue). The callee pays
// nothing; the CALLER is charged the callee's configured rate per minute
// (see the ⚙️ tarifa button above), so we check they can afford at least
// one minute before ringing.
async function startCall() {
  if (!activePeer.value || !myId || !user.value || callState.value === 'starting') {
    return;
  }
  callError.value = '';
  callState.value = 'starting';
  try {
    const [rate, coins] = await Promise.all([
      getCallRate(activePeer.value.id),
      getCoins(myId),
    ]);
    if (coins < rate) {
      callError.value = `Necesitas al menos ${rate} coins para llamar a esta persona (tienes ${coins}).`;
      return;
    }
    const callId = crypto.randomUUID();
    const m = await sendDirectMessage(myId, activePeer.value.id, callId, 'call');
    thread.value.push(m);
    const myProfile = await getProfile(myId).catch(() => null);
    await ringUser(activePeer.value.id, {
      callId,
      callerId: myId,
      callerName: myProfile?.display_name || myProfile?.username || displayName.value,
      callerAvatar: myProfile?.avatar_url || null,
    });
    router.push({
      path: `/call/${callId}`,
      query: {
        peer: activePeer.value.id,
        role: 'caller',
        name: activePeer.value.display_name || activePeer.value.username || 'Usuario',
      },
    });
  } catch (error: any) {
    callError.value = error?.message || 'No se pudo iniciar la llamada.';
    console.warn('[messages] call start failed:', error);
  } finally {
    callState.value = 'idle';
  }
}

function joinCall(m: DirectMessage) {
  const peer = activePeer.value;
  router.push({
    path: `/call/${m.content}`,
    query: { peer: peer?.id, role: 'callee', name: peer?.display_name || peer?.username || 'Usuario' },
  });
}

onMounted(async () => {
  await loadList();
  // Deep link: /messages?user=<id> opens that thread directly (used by
  // the "Mensaje" buttons on profiles and user sheets).
  const peerId = route.query.user as string;
  if (peerId && myId && peerId !== myId) {
    try {
      const p = await getProfile(peerId);
      if (p) {
        openThreadWith(p);
      }
    } catch {
      // ignore — stay on the list
    }
  }
  if (myId) {
    unsubscribe = subscribeInbox(myId, (m) => {
      if (activePeer.value && m.sender_id === activePeer.value.id) {
        thread.value.push(m);
        markThreadRead(myId, activePeer.value.id);
        scrollThreadDown();
      }
      loadList();
    });
  }
  // Polling fallback (realtime may not be enabled on the table yet).
  pollTimer = window.setInterval(async () => {
    if (activePeer.value) {
      const fresh = await fetchThread(myId, activePeer.value.id);
      if (fresh.length !== thread.value.length) {
        thread.value = fresh;
        scrollThreadDown();
      }
    } else {
      loadList();
    }
  }, 7000);
});

onUnmounted(() => {
  unsubscribe?.();
  if (pollTimer) {
    window.clearInterval(pollTimer);
  }
});
</script>

<style scoped>
.messages {
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: #050308;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
}
.msg-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
}
.msg-title {
  font-size: 22px;
  font-weight: 800;
}
.msg-top-actions {
  display: flex;
  gap: 8px;
}
.new-chat {
  width: 40px;
  height: 40px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.07);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  backdrop-filter: blur(16px) saturate(180%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.call-error {
  margin: 8px 14px 0;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(255, 69, 58, 0.14);
  border: 1px solid rgba(255, 69, 58, 0.35);
  color: #ffb4ae;
  font-size: 13px;
  line-height: 1.4;
}

.search-panel {
  padding: 0 16px 8px;
}
.search-field {
  width: 100%;
  box-sizing: border-box;
  height: 44px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  padding: 0 14px;
  font-size: 15px;
  outline: none;
}
.search-field::placeholder { color: #6d6d78; }
.search-hint {
  margin: 12px 4px 4px;
  font-size: 12px;
  color: #8e8e93;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  font-weight: 600;
}
.user-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 4px;
  background: none;
  border: none;
  color: #fff;
  font-size: 15px;
  cursor: pointer;
  text-align: left;
}

.u-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  background: #1a2030;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  color: #7fd7ff;
  flex-shrink: 0;
}
.u-avatar.big { width: 50px; height: 50px; }
.u-avatar img { width: 100%; height: 100%; object-fit: cover; }
.u-name { font-weight: 600; }

.state {
  padding: 70px 24px;
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

.convo-list {
  display: flex;
  flex-direction: column;
  padding: 4px 8px;
}
.convo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 8px;
  background: none;
  border: none;
  border-radius: 16px;
  color: #fff;
  cursor: pointer;
  text-align: left;
}
.convo:active { background: rgba(255, 255, 255, 0.05); }
.convo-mid {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.convo-name { font-size: 15.5px; font-weight: 700; }
.convo-snippet {
  font-size: 13.5px;
  color: #8e8e93;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.convo-snippet.unread { color: #fff; font-weight: 600; }
.convo-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
  flex-shrink: 0;
}
.convo-time { font-size: 12px; color: #6d6d78; }
.convo-badge {
  min-width: 19px;
  height: 19px;
  padding: 0 5px;
  border-radius: 10px;
  background: #0a84ff;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ---------- Thread ---------- */
.thread {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  background: #050308;
}
.thread-top {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 0.5px solid rgba(255, 255, 255, 0.08);
  background: rgba(10, 8, 14, 0.8);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  backdrop-filter: blur(20px) saturate(180%);
}
.thread-user {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
  text-align: left;
}
.thread-name { font-size: 16px; font-weight: 700; }
.call-btn {
  width: 44px;
  height: 44px;
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.08);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  backdrop-filter: blur(16px) saturate(180%);
  color: #34c759;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.thread-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 14px 8px;
}
.bubble-row { display: flex; }
.bubble-row.mine { justify-content: flex-end; }
.bubble {
  max-width: 78%;
  padding: 10px 14px;
  border-radius: 18px;
  border-bottom-left-radius: 6px;
  background: rgba(255, 255, 255, 0.09);
  font-size: 15px;
  line-height: 1.4;
  word-break: break-word;
}
.bubble-row.mine .bubble {
  background: linear-gradient(135deg, #0a84ff, #5e5ce6);
  border-radius: 18px;
  border-bottom-right-radius: 6px;
}
.call-bubble {
  display: flex;
  align-items: center;
  gap: 8px;
}
.call-ic { font-size: 18px; }
.call-join {
  background: none;
  border: none;
  color: #7fd7ff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}
.bubble-row.mine .call-join { color: #fff; }
.thread-empty {
  text-align: center;
  color: #6d6d78;
  margin-top: 40px;
}

.thread-input {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px calc(12px + env(safe-area-inset-bottom, 0));
}
.thread-field {
  flex: 1;
  min-width: 0;
  height: 44px;
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.07);
  color: #fff;
  padding: 0 16px;
  font-size: 15px;
  outline: none;
}
.thread-field::placeholder { color: #6d6d78; }
.thread-send {
  width: 44px;
  height: 44px;
  border-radius: 22px;
  border: none;
  background: linear-gradient(135deg, #0a84ff, #5e5ce6);
  color: #fff;
  font-size: 17px;
  cursor: pointer;
  flex-shrink: 0;
}
.thread-send:disabled { opacity: 0.5; }
</style>

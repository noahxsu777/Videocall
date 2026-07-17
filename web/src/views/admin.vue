<template>
  <div class="admin-page">
    <header class="nav">
      <GlassBackButton @click="router.back()" />
      <span class="nav-title">Panel de administración</span>
      <span class="nav-spacer" />
    </header>

    <div class="tabs">
      <button class="tab" :class="{ on: tab === 'users' }" @click="tab = 'users'">Usuarios</button>
      <button class="tab" :class="{ on: tab === 'wallet' }" @click="tab = 'wallet'">Billetera</button>
      <button class="tab" @click="router.push('/sharmin')">IPs</button>
    </div>

    <div v-if="loading" class="state-msg">Cargando…</div>
    <div v-else-if="loadError" class="state-msg err">{{ loadError }}</div>

    <template v-else>
      <!-- ============ USUARIOS (registros) ============ -->
      <section v-if="tab === 'users'" class="panel">
        <div class="stats-row">
          <div class="stat"><span class="stat-num">{{ users.length }}</span><span class="stat-label">Cuentas</span></div>
          <div class="stat"><span class="stat-num">{{ bannedCount }}</span><span class="stat-label">Baneadas</span></div>
          <div class="stat"><span class="stat-num">{{ verifiedCount }}</span><span class="stat-label">Verificadas</span></div>
          <div class="stat"><span class="stat-num">{{ vipCount }}</span><span class="stat-label">VIP activo</span></div>
        </div>

        <div class="search-wrap">
          <input v-model.trim="query" class="search" type="text" placeholder="Buscar por nombre, usuario o correo…" />
        </div>

        <p v-if="actionMsg" class="action-msg" :class="actionOk ? 'ok' : 'err'">{{ actionMsg }}</p>

        <div class="user-list">
          <div v-for="u in filteredUsers" :key="u.id" class="user-card" :class="{ banned: u.banned }">
            <div class="user-row" @click="toggleExpand(u.id)">
              <div class="avatar">
                <img v-if="u.avatar_url" :src="u.avatar_url" alt="" />
                <span v-else>{{ (u.display_name || u.username || '?').slice(0, 1).toUpperCase() }}</span>
              </div>
              <div class="user-info">
                <div class="user-name-row">
                  <span class="user-name">{{ u.display_name || u.username || 'Sin nombre' }}</span>
                  <VerifiedBadge v-if="u.verified" :size="13" />
                  <span v-if="u.is_admin" class="chip chip-admin">ADMIN</span>
                  <span v-if="u.banned" class="chip chip-banned">BANEADO</span>
                </div>
                <span class="user-email">{{ u.email || u.username || u.id.slice(0, 8) }}</span>
              </div>
              <div class="user-coins">🪙 {{ u.coins.toLocaleString() }}</div>
              <span class="chev" :class="{ open: expanded === u.id }" v-html="CHEV" />
            </div>

            <div v-if="expanded === u.id" class="user-edit">
              <div class="field">
                <label>Nombre</label>
                <input v-model.trim="editState[u.id].display_name" type="text" />
              </div>
              <div class="field">
                <label>Usuario</label>
                <input v-model.trim="editState[u.id].username" type="text" />
              </div>
              <div class="field">
                <label>Bio</label>
                <textarea v-model.trim="editState[u.id].bio" rows="2" />
              </div>
              <label class="checkbox-row">
                <input v-model="editState[u.id].verified" type="checkbox" />
                <span>Cuenta verificada</span>
              </label>
              <button class="btn btn-save" :disabled="busyId === u.id" @click="saveEdit(u)">
                Guardar cambios
              </button>

              <div class="divider" />

              <div class="coin-row">
                <input v-model.number="coinAmount[u.id]" type="number" placeholder="Cantidad" class="coin-input" />
                <button class="btn btn-coins" :disabled="busyId === u.id" @click="applyCoins(u, 1)">+ Añadir</button>
                <button class="btn btn-coins-minus" :disabled="busyId === u.id" @click="applyCoins(u, -1)">− Quitar</button>
              </div>

              <button
                class="btn"
                :class="u.banned ? 'btn-unban' : 'btn-ban'"
                :disabled="busyId === u.id || u.is_admin"
                @click="toggleBan(u)"
              >
                {{ u.banned ? 'Desbanear cuenta' : 'Banear cuenta' }}
              </button>
              <p v-if="u.is_admin" class="admin-note">No puedes banear a otro administrador.</p>
            </div>
          </div>
          <p v-if="filteredUsers.length === 0" class="empty">Sin resultados.</p>
        </div>
      </section>

      <!-- ============ BILLETERA ============ -->
      <section v-else class="panel">
        <div class="stats-row">
          <div class="stat"><span class="stat-num">🪙 {{ totalCoins.toLocaleString() }}</span><span class="stat-label">En circulación</span></div>
          <div class="stat"><span class="stat-num">🪙 {{ avgCoins.toLocaleString() }}</span><span class="stat-label">Promedio/cuenta</span></div>
        </div>

        <p class="group-header">Añadir o quitar saldo</p>
        <div class="wallet-form">
          <input v-model.trim="walletQuery" class="search" type="text" placeholder="Buscar cuenta…" />
          <div v-if="walletQuery && walletMatches.length" class="wallet-matches">
            <button
              v-for="u in walletMatches"
              :key="u.id"
              class="wallet-match"
              :class="{ sel: walletTarget?.id === u.id }"
              @click="walletTarget = u; walletQuery = u.display_name || u.username || ''"
            >
              {{ u.display_name || u.username }} <span class="wm-email">{{ u.email }}</span>
            </button>
          </div>
          <div v-if="walletTarget" class="wallet-target">
            <span>{{ walletTarget.display_name || walletTarget.username }} — 🪙 {{ walletTarget.coins.toLocaleString() }}</span>
            <div class="coin-row">
              <input v-model.number="walletAmount" type="number" placeholder="Cantidad" class="coin-input" />
              <button class="btn btn-coins" :disabled="busyId === walletTarget.id" @click="applyCoins(walletTarget, 1)">+ Añadir</button>
              <button class="btn btn-coins-minus" :disabled="busyId === walletTarget.id" @click="applyCoins(walletTarget, -1)">− Quitar</button>
            </div>
          </div>
        </div>
        <p v-if="actionMsg" class="action-msg" :class="actionOk ? 'ok' : 'err'">{{ actionMsg }}</p>

        <p class="group-header">Top saldos</p>
        <div class="top-list">
          <div v-for="(u, i) in topBalances" :key="u.id" class="top-row">
            <span class="top-rank">#{{ i + 1 }}</span>
            <span class="top-name">{{ u.display_name || u.username }}</span>
            <span class="top-coins">🪙 {{ u.coins.toLocaleString() }}</span>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import GlassBackButton from '../components/GlassBackButton.vue';
import VerifiedBadge from '../components/VerifiedBadge.vue';
import { isVipActive } from '../data/profiles';
import { listAllUsers, setBanned, addCoins, adminUpdateProfile, type AdminUserRow } from '../data/admin';

const router = useRouter();

const CHEV =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';

const tab = ref<'users' | 'wallet'>('users');
const loading = ref(true);
const loadError = ref('');
const users = ref<AdminUserRow[]>([]);
const query = ref('');
const expanded = ref<string | null>(null);
const busyId = ref<string | null>(null);
const actionMsg = ref('');
const actionOk = ref(false);

const editState = reactive<Record<string, { display_name: string; username: string; bio: string; verified: boolean }>>({});
const coinAmount = reactive<Record<string, number>>({});

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    users.value = await listAllUsers();
    for (const u of users.value) {
      editState[u.id] = {
        display_name: u.display_name || '',
        username: u.username || '',
        bio: '',
        verified: u.verified,
      };
      coinAmount[u.id] = 100;
    }
  } catch (error: any) {
    loadError.value = `No se pudo cargar: ${error?.message || 'error'}`;
  } finally {
    loading.value = false;
  }
}

onMounted(load);

const filteredUsers = computed(() => {
  const q = query.value.toLowerCase();
  if (!q) {
    return users.value;
  }
  return users.value.filter(u =>
    (u.display_name || '').toLowerCase().includes(q)
    || (u.username || '').toLowerCase().includes(q)
    || (u.email || '').toLowerCase().includes(q));
});

const bannedCount = computed(() => users.value.filter(u => u.banned).length);
const verifiedCount = computed(() => users.value.filter(u => u.verified).length);
const vipCount = computed(() => users.value.filter(u => isVipActive(u.vip_until)).length);
const totalCoins = computed(() => users.value.reduce((sum, u) => sum + (u.coins || 0), 0));
const avgCoins = computed(() => (users.value.length ? Math.round(totalCoins.value / users.value.length) : 0));
const topBalances = computed(() => [...users.value].sort((a, b) => b.coins - a.coins).slice(0, 10));

function toggleExpand(id: string) {
  expanded.value = expanded.value === id ? null : id;
  actionMsg.value = '';
}

function showAction(ok: boolean, message: string) {
  actionOk.value = ok;
  actionMsg.value = message;
}

async function saveEdit(u: AdminUserRow) {
  const edits = editState[u.id];
  busyId.value = u.id;
  actionMsg.value = '';
  try {
    await adminUpdateProfile(u.id, {
      display_name: edits.display_name || undefined,
      username: edits.username || undefined,
      bio: edits.bio || undefined,
      verified: edits.verified,
    });
    u.display_name = edits.display_name;
    u.username = edits.username;
    u.verified = edits.verified;
    showAction(true, 'Perfil actualizado.');
  } catch (error: any) {
    showAction(false, `No se pudo guardar: ${error?.message || 'error'}`);
  } finally {
    busyId.value = null;
  }
}

async function toggleBan(u: AdminUserRow) {
  busyId.value = u.id;
  actionMsg.value = '';
  try {
    const next = !u.banned;
    await setBanned(u.id, next);
    u.banned = next;
    showAction(true, next ? 'Cuenta baneada.' : 'Cuenta desbaneada.');
  } catch (error: any) {
    showAction(false, `No se pudo actualizar: ${error?.message || 'error'}`);
  } finally {
    busyId.value = null;
  }
}

async function applyCoins(u: AdminUserRow, sign: 1 | -1) {
  const amount = tab.value === 'wallet' ? walletAmount.value : coinAmount[u.id];
  if (!amount || amount <= 0) {
    showAction(false, 'Ingresa una cantidad válida.');
    return;
  }
  busyId.value = u.id;
  actionMsg.value = '';
  try {
    const newBalance = await addCoins(u.id, sign * Math.abs(amount));
    u.coins = newBalance;
    showAction(true, `Saldo actualizado: ${newBalance.toLocaleString()} coins.`);
  } catch (error: any) {
    showAction(false, `No se pudo actualizar el saldo: ${error?.message || 'error'}`);
  } finally {
    busyId.value = null;
  }
}

// ---- Billetera tab: quick search + add/remove coins to any account ----
const walletQuery = ref('');
const walletTarget = ref<AdminUserRow | null>(null);
const walletAmount = ref(100);

const walletMatches = computed(() => {
  const q = walletQuery.value.toLowerCase();
  if (!q || walletTarget.value?.display_name === walletQuery.value || walletTarget.value?.username === walletQuery.value) {
    return [];
  }
  return users.value
    .filter(u => (u.display_name || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))
    .slice(0, 6);
});
</script>

<style scoped>
.admin-page {
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: #000;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif;
  padding-bottom: 40px;
}
.nav {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 50px;
  padding: 0 8px;
  background: rgba(0, 0, 0, 0.7);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 0.5px solid rgba(255, 255, 255, 0.1);
}
.nav-spacer { min-width: 44px; }
.nav-title { font-size: 15px; font-weight: 700; }

.tabs {
  display: flex;
  gap: 8px;
  padding: 12px 16px 0;
}
.tab {
  flex: 1;
  height: 38px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: #8e8e93;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.tab.on {
  background: rgba(52, 199, 89, 0.15);
  border-color: rgba(52, 199, 89, 0.4);
  color: #34c759;
}

.state-msg {
  text-align: center;
  padding: 40px 20px;
  color: #8e8e93;
  font-size: 14px;
}
.state-msg.err { color: #ff453a; }

.panel { padding: 14px 16px; }

.stats-row {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}
.stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 12px 4px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 0.5px solid rgba(255, 255, 255, 0.1);
}
.stat-num { font-size: 16px; font-weight: 800; }
.stat-label { font-size: 10.5px; color: #8e8e93; text-transform: uppercase; letter-spacing: 0.3px; }

.search-wrap { margin-bottom: 12px; }
.search {
  width: 100%;
  height: 42px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  padding: 0 14px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}
.search::placeholder { color: #6a6a70; }

.action-msg { margin: 0 0 10px; font-size: 13px; }
.action-msg.ok { color: #34c759; }
.action-msg.err { color: #ff453a; }

.user-list { display: flex; flex-direction: column; gap: 8px; }
.user-card {
  border-radius: 14px;
  background: rgba(30, 30, 34, 0.55);
  border: 0.5px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
}
.user-card.banned { border-color: rgba(255, 69, 58, 0.4); }

.user-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
}
.avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: linear-gradient(135deg, #5e5ce6, #7b2ff7);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 15px;
}
.avatar img { width: 100%; height: 100%; object-fit: cover; }

.user-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.user-name-row { display: flex; align-items: center; gap: 5px; }
.user-name {
  font-size: 14.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 140px;
}
.user-email { font-size: 11.5px; color: #8e8e93; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.chip {
  font-size: 9px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 6px;
  letter-spacing: 0.3px;
  flex-shrink: 0;
}
.chip-admin { background: rgba(52, 199, 89, 0.2); color: #34c759; }
.chip-banned { background: rgba(255, 69, 58, 0.2); color: #ff453a; }

.user-coins { font-size: 13px; font-weight: 700; color: #ffcf5e; flex-shrink: 0; }
.chev { color: #55555b; flex-shrink: 0; transition: transform 0.2s ease; }
.chev.open { transform: rotate(90deg); }

.user-edit {
  padding: 4px 14px 14px;
  border-top: 0.5px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.field { display: flex; flex-direction: column; gap: 4px; }
.field label { font-size: 11px; color: #8e8e93; }
.field input,
.field textarea {
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  padding: 8px 10px;
  font-size: 13.5px;
  font-family: inherit;
  outline: none;
  resize: none;
}
.checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #eee;
}
.divider { height: 0.5px; background: rgba(255, 255, 255, 0.1); margin: 2px 0; }

.coin-row { display: flex; gap: 6px; }
.coin-input {
  flex: 1;
  min-width: 0;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  padding: 8px 10px;
  font-size: 13.5px;
  outline: none;
}

.btn {
  height: 38px;
  border-radius: 10px;
  border: none;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  padding: 0 12px;
}
.btn:disabled { opacity: 0.5; }
.btn-save { background: #8b3dff; color: #fff; }
.btn-coins { background: rgba(52, 199, 89, 0.18); color: #34c759; white-space: nowrap; }
.btn-coins-minus { background: rgba(255, 159, 10, 0.18); color: #ff9f0a; white-space: nowrap; }
.btn-ban { background: rgba(255, 69, 58, 0.18); color: #ff453a; }
.btn-unban { background: rgba(52, 199, 89, 0.18); color: #34c759; }
.admin-note { margin: 0; font-size: 11px; color: #8e8e93; }

.empty { text-align: center; color: #8e8e93; font-size: 13px; padding: 24px 0; }

.group-header {
  margin: 18px 2px 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: #8e8e93;
}

.wallet-form { display: flex; flex-direction: column; gap: 8px; }
.wallet-matches {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.04);
  border: 0.5px solid rgba(255, 255, 255, 0.1);
}
.wallet-match {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  background: none;
  border: none;
  color: #fff;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.wallet-match.sel { background: rgba(139, 61, 255, 0.15); }
.wm-email { color: #8e8e93; font-size: 11.5px; }

.wallet-target {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 0.5px solid rgba(255, 255, 255, 0.1);
  font-size: 13.5px;
}

.top-list { display: flex; flex-direction: column; gap: 6px; }
.top-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 0.5px solid rgba(255, 255, 255, 0.1);
}
.top-rank { font-size: 12px; color: #8e8e93; width: 24px; flex-shrink: 0; }
.top-name { flex: 1; font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.top-coins { font-size: 13px; font-weight: 700; color: #ffcf5e; }
</style>

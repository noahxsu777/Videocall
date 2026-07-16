<template>
  <div class="sharmin-page">
    <header class="nav">
      <GlassBackButton @click="router.back()" />
      <span class="nav-title">Registro de IPs</span>
      <span class="nav-spacer" />
    </header>

    <div v-if="loading" class="state-msg">Cargando…</div>
    <div v-else-if="loadError" class="state-msg err">{{ loadError }}</div>

    <template v-else>
      <div class="panel">
        <div class="stats-row">
          <div class="stat"><span class="stat-num">{{ sessions.length }}</span><span class="stat-label">Registradas</span></div>
          <div class="stat"><span class="stat-num">{{ uniqueIpCount }}</span><span class="stat-label">IPs únicas</span></div>
        </div>

        <div class="search-wrap">
          <input v-model.trim="query" class="search" type="text" placeholder="Buscar por nombre, usuario, correo o IP…" />
        </div>

        <p v-if="duplicateIps.length" class="warn-note">
          ⚠️ IP compartida por varias cuentas: {{ duplicateIps.join(', ') }}
        </p>

        <div class="row-list">
          <div v-for="s in filteredSessions" :key="s.user_id" class="row-card">
            <div class="avatar">{{ (s.display_name || s.username || '?').slice(0, 1).toUpperCase() }}</div>
            <div class="row-info">
              <div class="row-name-line">
                <span class="row-name">{{ s.display_name || s.username || 'Sin nombre' }}</span>
                <span v-if="isDuplicateIp(s.ip)" class="chip chip-dup">IP compartida</span>
              </div>
              <span class="row-email">{{ s.email || s.username || s.user_id.slice(0, 8) }}</span>
              <span class="row-ua">{{ s.user_agent || 'User agent desconocido' }}</span>
            </div>
            <div class="row-meta">
              <span class="row-ip">{{ s.ip || '—' }}</span>
              <span class="row-time">{{ relativeTime(s.last_seen) }}</span>
            </div>
          </div>
          <p v-if="filteredSessions.length === 0" class="empty">Sin resultados.</p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import GlassBackButton from '../components/GlassBackButton.vue';
import { listAllSessions, type AdminSessionRow } from '../data/admin';

const router = useRouter();

const loading = ref(true);
const loadError = ref('');
const sessions = ref<AdminSessionRow[]>([]);
const query = ref('');

onMounted(async () => {
  try {
    sessions.value = await listAllSessions();
  } catch (error: any) {
    loadError.value = `No se pudo cargar: ${error?.message || 'error'}`;
  } finally {
    loading.value = false;
  }
});

const filteredSessions = computed(() => {
  const q = query.value.toLowerCase();
  if (!q) {
    return sessions.value;
  }
  return sessions.value.filter(s =>
    (s.display_name || '').toLowerCase().includes(q)
    || (s.username || '').toLowerCase().includes(q)
    || (s.email || '').toLowerCase().includes(q)
    || (s.ip || '').toLowerCase().includes(q));
});

const ipCounts = computed(() => {
  const counts = new Map<string, number>();
  for (const s of sessions.value) {
    if (!s.ip) {
      continue;
    }
    counts.set(s.ip, (counts.get(s.ip) || 0) + 1);
  }
  return counts;
});

const uniqueIpCount = computed(() => ipCounts.value.size);
const duplicateIps = computed(() => [...ipCounts.value.entries()].filter(([, n]) => n > 1).map(([ip]) => ip));

function isDuplicateIp(ip: string | null): boolean {
  return !!ip && (ipCounts.value.get(ip) || 0) > 1;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) {
    return 'ahora mismo';
  }
  if (min < 60) {
    return `hace ${min} min`;
  }
  const hours = Math.floor(min / 60);
  if (hours < 24) {
    return `hace ${hours} h`;
  }
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}
</script>

<style scoped>
.sharmin-page {
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

.state-msg { text-align: center; padding: 40px 20px; color: #8e8e93; font-size: 14px; }
.state-msg.err { color: #ff453a; }

.panel { padding: 14px 16px; }

.stats-row { display: flex; gap: 8px; margin-bottom: 14px; }
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

.search-wrap { margin-bottom: 10px; }
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

.warn-note {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 159, 10, 0.12);
  border: 1px solid rgba(255, 159, 10, 0.3);
  color: #ff9f0a;
  font-size: 12.5px;
  line-height: 1.5;
}

.row-list { display: flex; flex-direction: column; gap: 8px; }
.row-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(30, 30, 34, 0.55);
  border: 0.5px solid rgba(255, 255, 255, 0.1);
}
.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  flex-shrink: 0;
  background: linear-gradient(135deg, #5e5ce6, #7b2ff7);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
}
.row-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.row-name-line { display: flex; align-items: center; gap: 6px; }
.row-name {
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 130px;
}
.row-email { font-size: 11px; color: #8e8e93; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-ua { font-size: 10.5px; color: #6a6a70; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.chip {
  font-size: 8.5px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 6px;
  letter-spacing: 0.2px;
  flex-shrink: 0;
}
.chip-dup { background: rgba(255, 159, 10, 0.2); color: #ff9f0a; }

.row-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0; }
.row-ip { font-family: ui-monospace, 'SF Mono', monospace; font-size: 12.5px; font-weight: 600; }
.row-time { font-size: 10.5px; color: #8e8e93; }

.empty { text-align: center; color: #8e8e93; font-size: 13px; padding: 24px 0; }
</style>

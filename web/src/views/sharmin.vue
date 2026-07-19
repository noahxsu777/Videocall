<template>
  <div class="sharmin-page">
    <header class="nav">
      <GlassBackButton />
      <span class="nav-title">Panel</span>
      <button class="refresh" @click="load" :disabled="loading">↻</button>
    </header>

    <div class="tabs">
      <button class="tab" :class="{ on: tab === 'ips' }" @click="tab = 'ips'">IPs</button>
      <button class="tab" :class="{ on: tab === 'verif' }" @click="tab = 'verif'">
        Verificaciones<span v-if="requests.length" class="tab-badge">{{ requests.length }}</span>
      </button>
    </div>

    <ListSkeleton v-if="loading" :rows="7" />
    <div v-else-if="loadError" class="state-msg err">{{ loadError }}</div>

    <template v-else>
      <!-- ============ Solicitudes de verificación ============ -->
      <div v-if="tab === 'verif'" class="panel">
        <p v-if="actionMsg" class="action-msg" :class="actionOk ? 'ok' : 'err'">{{ actionMsg }}</p>
        <div class="row-list">
          <div v-for="r in requests" :key="r.user_id" class="verif-card">
            <div class="verif-top">
              <span class="avatar">
                <img v-if="r.avatar_url" :src="r.avatar_url" alt="" />
                <span v-else>{{ (r.display_name || r.username || '?').slice(0, 1).toUpperCase() }}</span>
              </span>
              <div class="verif-info">
                <span class="verif-name">
                  {{ r.display_name || r.username || 'Sin nombre' }}
                  <VerifiedBadge v-if="r.verified" :size="16" />
                </span>
                <span class="verif-email">{{ r.email || r.user_id.slice(0, 8) }}</span>
              </div>
            </div>
            <p v-if="r.note" class="verif-note">“{{ r.note }}”</p>
            <div class="verif-actions">
              <button class="vbtn approve" :disabled="busyId === r.user_id" @click="decide(r, true)">
                {{ r.verified ? 'Verificado ✓' : 'Aprobar' }}
              </button>
              <button class="vbtn reject" :disabled="busyId === r.user_id" @click="decide(r, false)">
                Rechazar
              </button>
            </div>
          </div>
          <p v-if="requests.length === 0" class="empty">No hay solicitudes de verificación.</p>
        </div>
      </div>

      <!-- ============ Registro de IPs ============ -->
      <div v-else class="panel">
        <div class="stats-row">
          <div class="stat"><span class="stat-num">{{ visitors.length }}</span><span class="stat-label">IPs únicas</span></div>
          <div class="stat"><span class="stat-num">{{ totalVisits }}</span><span class="stat-label">Visitas totales</span></div>
        </div>

        <div class="search-wrap">
          <input v-model.trim="query" class="search" type="text" placeholder="Buscar por IP o nombre…" />
        </div>

        <div class="row-list">
          <div v-for="v in filteredVisitors" :key="v.ip || ''" class="row-card">
            <span class="row-flag">{{ v.flag || '🌐' }}</span>
            <div class="row-info">
              <div class="row-top">
                <span class="row-ip">{{ v.ip || '—' }}</span>
                <span v-if="v.visits > 1" class="chip">{{ v.visits }}× visitas</span>
              </div>
              <span class="row-loc">{{ locationText(v) }}</span>
              <span class="row-isp">📶 {{ v.isp || 'Operador desconocido' }}</span>
              <span v-if="v.name" class="row-name">👤 {{ v.name }}</span>
              <span class="row-ua">{{ v.user_agent || 'Dispositivo desconocido' }}</span>
            </div>
            <span class="row-time">{{ relativeTime(v.last_seen) }}</span>
          </div>
          <p v-if="filteredVisitors.length === 0" class="empty">
            {{ visitors.length === 0 ? 'Aún no hay visitas registradas.' : 'Sin resultados.' }}
          </p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import GlassBackButton from '../components/GlassBackButton.vue';
import ListSkeleton from '../components/ListSkeleton.vue';
import VerifiedBadge from '../components/VerifiedBadge.vue';
import {
  listVisitors,
  listVerificationRequests,
  setVerification,
  type VisitorRow,
  type VerificationRequest,
} from '../data/admin';

const router = useRouter();

const tab = ref<'ips' | 'verif'>('ips');
const loading = ref(true);
const loadError = ref('');
const visitors = ref<VisitorRow[]>([]);
const requests = ref<VerificationRequest[]>([]);
const query = ref('');
const busyId = ref<string | null>(null);
const actionMsg = ref('');
const actionOk = ref(false);

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    const [v, r] = await Promise.all([
      listVisitors(),
      listVerificationRequests().catch(() => [] as VerificationRequest[]),
    ]);
    visitors.value = v;
    requests.value = r;
  } catch (error: any) {
    loadError.value = `No se pudo cargar: ${error?.message || 'error'}`;
  } finally {
    loading.value = false;
  }
}

onMounted(load);

async function decide(r: VerificationRequest, approved: boolean) {
  busyId.value = r.user_id;
  actionMsg.value = '';
  try {
    await setVerification(r.user_id, approved);
    // Remove from the pending list either way (approved or rejected).
    requests.value = requests.value.filter(x => x.user_id !== r.user_id);
    actionOk.value = true;
    actionMsg.value = approved ? 'Cuenta verificada ✓' : 'Solicitud rechazada.';
  } catch (error: any) {
    actionOk.value = false;
    actionMsg.value = `No se pudo actualizar: ${error?.message || 'error'}`;
  } finally {
    busyId.value = null;
  }
}

const filteredVisitors = computed(() => {
  const q = query.value.toLowerCase();
  if (!q) {
    return visitors.value;
  }
  return visitors.value.filter(v =>
    (v.ip || '').toLowerCase().includes(q)
    || (v.name || '').toLowerCase().includes(q)
    || (v.country || '').toLowerCase().includes(q)
    || (v.city || '').toLowerCase().includes(q)
    || (v.isp || '').toLowerCase().includes(q));
});

const totalVisits = computed(() => visitors.value.reduce((sum, v) => sum + (v.visits || 0), 0));

function locationText(v: VisitorRow): string {
  const parts = [v.city, v.country].filter(Boolean);
  return parts.length ? parts.join(', ') : 'Ubicación desconocida';
}

function relativeTime(iso: string): string {
  if (!iso) {
    return '';
  }
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
.nav-title { font-size: 15px; font-weight: 700; }
.refresh {
  min-width: 44px;
  height: 40px;
  background: none;
  border: none;
  color: #fff;
  font-size: 20px;
  cursor: pointer;
}
.refresh:disabled { opacity: 0.4; }

.tabs { display: flex; gap: 8px; padding: 12px 16px 0; }
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.tab.on { background: rgba(29, 155, 240, 0.15); border-color: rgba(29, 155, 240, 0.4); color: #1d9bf0; }
.tab-badge {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #ff3b30;
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.action-msg { margin: 0 0 10px; font-size: 13px; }
.action-msg.ok { color: #34c759; }
.action-msg.err { color: #ff453a; }

.verif-card {
  border-radius: 14px;
  background: rgba(30, 30, 34, 0.55);
  border: 0.5px solid rgba(255, 255, 255, 0.1);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.verif-top { display: flex; align-items: center; gap: 10px; }
.avatar {
  width: 40px;
  height: 40px;
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
.verif-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.verif-name { font-size: 14.5px; font-weight: 600; display: inline-flex; align-items: center; gap: 5px; }
.verif-email { font-size: 11.5px; color: #8e8e93; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.verif-note {
  margin: 0;
  font-size: 13px;
  color: #d0d0d4;
  font-style: italic;
  line-height: 1.4;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
}
.verif-actions { display: flex; gap: 8px; }
.vbtn {
  flex: 1;
  height: 40px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}
.vbtn:disabled { opacity: 0.5; }
.vbtn.approve { background: rgba(29, 155, 240, 0.9); color: #fff; }
.vbtn.reject { background: rgba(255, 69, 58, 0.18); color: #ff453a; }

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
.stat-num { font-size: 18px; font-weight: 800; }
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

.row-list { display: flex; flex-direction: column; gap: 8px; }
.row-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-radius: 14px;
  background: rgba(30, 30, 34, 0.55);
  border: 0.5px solid rgba(255, 255, 255, 0.1);
}
.row-flag { font-size: 30px; flex-shrink: 0; line-height: 1; }
.row-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.row-top { display: flex; align-items: center; gap: 8px; }
.row-ip {
  font-family: ui-monospace, 'SF Mono', monospace;
  font-size: 15px;
  font-weight: 700;
}
.row-loc { font-size: 13px; font-weight: 600; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-isp { font-size: 11.5px; color: #34c759; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chip {
  font-size: 9px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 6px;
  background: rgba(52, 199, 89, 0.2);
  color: #34c759;
  flex-shrink: 0;
}
.row-name { font-size: 12.5px; color: #c9c9ce; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-ua { font-size: 10.5px; color: #6a6a70; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-time { font-size: 11px; color: #8e8e93; flex-shrink: 0; }

.empty { text-align: center; color: #8e8e93; font-size: 13px; padding: 24px 0; line-height: 1.5; }
</style>
